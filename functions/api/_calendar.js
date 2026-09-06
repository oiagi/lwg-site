// functions/api/_calendar.js
// Shared Google Calendar helpers for course management.

import {
  isDateBlocked,
  zurichParts,
  exdateLine,
  planWeeklySchedule,
  extendSeries,
  excludedSlotKeys,
  isSlotExcluded,
  slotKey,
} from './_blocked-dates.js';

// Levels that are bookkeeping codes rather than something a student would
// recognise as a level: 'CH' for Swiss German, 'SUB' for tutoring, 'XX' for
// unknown. They are left out of the title — "Apple Swiss German", not
// "Apple Swiss German CH".
const NON_DISPLAY_LEVEL = /^(CH|SUB|XX)/i;

// Separates the descriptive part of a title from the course code. Stripped
// from every other part so a company literally named "A · B" cannot forge a
// second boundary and confuse a human reading the calendar.
const CODE_SEPARATOR = ' · ';

function titlePart(value, max = 60) {
  if (value === null || value === undefined) return null;
  const cleaned = String(value)
    .replace(/[·\n\r\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned ? cleaned.slice(0, max) : null;
}

function displayLevel(level) {
  const value = titlePart(level, 12);
  if (!value || NON_DISPLAY_LEVEL.test(value)) return null;
  return value.toUpperCase();
}

/**
 * The Google Calendar title for a course.
 *
 * Leads with whatever identifies the course at a glance, and keeps the course
 * code as a trailing token so sync can still find the event (see
 * summaryMatchesCourseCode) and so a teacher adding a session by hand can copy
 * the title verbatim:
 *
 *   company    "Apple German B1.2 · 12345", "Apple Swiss German · 12345"
 *   private    "Bharat German A2 · 47182", "Angelina Mathematics · 47182"
 *   duo/group  "German B1.2 class · 90341"
 *
 * Duo takes the group branch deliberately — the only special case is `private`.
 *
 * Returns null when there is nothing descriptive to say: no company, no name,
 * no subject and no displayable level. Callers treat that as "leave the title
 * alone", because renaming a teacher's event to a bare "class · 12345" is
 * worse than whatever they had written there.
 *
 * Pure — no I/O. The caller resolves companyName and participantName, since
 * where those come from differs between creating a course and renaming one.
 *
 * Careful with participantName: get-courses.js overwrites `participant_names`
 * with *full* names in its API response, while the database column holds first
 * names. Feed this the raw course row, never a get-courses object.
 *
 * @param {object} opts
 * @param {string} opts.courseCode
 * @param {string|null} [opts.subject]
 * @param {string|null} [opts.level]
 * @param {string|null} [opts.groupType] — 'private' | 'duo' | 'group'
 * @param {string|null} [opts.companyName]
 * @param {string|null} [opts.participantName] — first name, private courses only
 * @returns {string|null}
 */
export function courseEventTitle({
  courseCode,
  subject,
  level,
  groupType,
  companyName = null,
  participantName = null,
}) {
  const code = titlePart(courseCode, 20);
  if (!code) return null;

  const company = titlePart(companyName);
  const parts = [];
  if (company) parts.push(company);
  else if (groupType === 'private') {
    const name = titlePart(participantName);
    if (name) parts.push(name);
  }

  const subjectPart = titlePart(subject, 40);
  if (subjectPart) parts.push(subjectPart);
  const levelPart = displayLevel(level);
  if (levelPart) parts.push(levelPart);

  // "class" marks an open group but says nothing on its own, so it never
  // counts towards the title being descriptive enough to write.
  if (!parts.length) return null;
  if (!company && groupType !== 'private') parts.push('class');

  return `${parts.join(' ')}${CODE_SEPARATOR}${code}`;
}

/**
 * Whether an event summary carries this course code as a standalone token.
 *
 * Deliberately position-independent. The title format puts the code last
 * ("German B1.2 class · 90341") while every event created before that change
 * puts it first ("90341 — Anna <> Gioia"), and both have to keep matching: an
 * event that stops matching is an event whose session row the deletion pass in
 * sync-calendar.js removes.
 *
 * The boundaries are what stop "12345" matching "123456" or "X12345". Note the
 * escape has to cover '-', because legacy codes look like "P-A1-001".
 */
export function summaryMatchesCourseCode(summary, courseCode) {
  const code = String(courseCode || '');
  if (!code) return false;
  const escaped = code.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
  return new RegExp(`(?:^|[^A-Za-z0-9])${escaped}(?![A-Za-z0-9])`).test(String(summary || ''));
}

/**
 * Create a recurring Google Calendar event for a course.
 *
 * @param {object} opts
 * @param {string} opts.accessToken  — Google OAuth access token
 * @param {string} opts.calendarId   — Teacher's calendar ID
 * @param {string} opts.courseCode   — e.g. "P-A1-001"
 * @param {object} opts.booking      — Booking data (service, level, language, exam)
 * @param {object} opts.contact      — Contact data (lead, participants)
 * @param {string|null} opts.subject — Course subject, for the title
 * @param {string|null} opts.level   — Level code as stored on the course
 * @param {string|null} opts.groupType — 'private' | 'duo' | 'group'
 * @param {string|null} opts.companyName — Linked company, for the title
 * @param {string} opts.firstSessionAt — ISO datetime for first session
 * @param {number} opts.durationMinutes — Session duration (default 50)
 * @param {number|null} opts.sessionsTotal — Block size or null for open-ended
 * @param {boolean} opts.singleSession — If true, create only the first session
 *   (no RRULE). Teachers add subsequent sessions manually in Google Calendar,
 *   keeping the course code in the event title so sync picks them up.
 * @param {object[]} opts.blockedPeriods — Blocked date ranges
 *   ({ start_date, end_date }); weekly occurrences on these dates are
 *   excluded via EXDATE and appended after the last scheduled session.
 * @returns {Promise<string>} Calendar event ID
 */
export async function createCourseCalendarEvent({
  accessToken,
  calendarId,
  courseCode,
  booking,
  contact,
  subject = null,
  level = null,
  groupType = null,
  companyName = null,
  firstSessionAt,
  durationMinutes = 50,
  sessionsTotal,
  singleSession = false,
  blockedPeriods = [],
}) {
  const participants = contact.participants || [];
  const participantNames = participants.map((p) => p.firstName).filter(Boolean);
  const startTime = new Date(firstSessionAt);
  const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);

  // The bare code is the last resort: a course with nothing to say about
  // itself still needs a summary sync can find.
  const eventTitle =
    courseEventTitle({
      courseCode,
      subject,
      level,
      groupType,
      companyName,
      participantName: participantNames[0],
    }) || String(courseCode);

  const sessionsLine = singleSession
    ? `Sessions: ${sessionsTotal ? sessionsTotal + ' planned manually' : 'planned manually'}\n`
    : sessionsTotal
      ? `Sessions: ${sessionsTotal} × 50min\n`
      : 'Sessions: open-ended\n';

  let recurrence;
  if (!singleSession) {
    const dayNames = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
    const rruleDay = dayNames[startTime.getDay()];
    const { count, excluded } = planWeeklySchedule({
      firstSessionAt,
      sessionsTotal,
      blockedPeriods,
    });
    recurrence = count
      ? [`RRULE:FREQ=WEEKLY;BYDAY=${rruleDay};COUNT=${count}`]
      : [`RRULE:FREQ=WEEKLY;BYDAY=${rruleDay}`];
    if (excluded.length) recurrence.push(exdateLine(excluded));
  }

  const eventBody = {
    summary: eventTitle,
    description:
      `Course: ${courseCode}\n` +
      (booking.lessonType
        ? `What: ${booking.lessonType}\n`
        : `Course type: ${booking.course_type || ''}\n`) +
      (booking.level ? `Level: ${booking.level}\n` : '') +
      (booking.language ? `Language: ${booking.language}\n` : '') +
      (booking.exam ? `Exam: ${booking.exam}\n` : '') +
      sessionsLine +
      `\nLead: ${contact.lead?.firstName || ''} ${contact.lead?.lastName || ''}` +
      `\nEmail: ${contact.lead?.email || ''}` +
      `\nPhone: ${contact.lead?.phone || ''}`,
    start: { dateTime: startTime.toISOString(), timeZone: 'Europe/Zurich' },
    end: { dateTime: endTime.toISOString(), timeZone: 'Europe/Zurich' },
  };
  if (recurrence) eventBody.recurrence = recurrence;

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?sendUpdates=none`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(eventBody),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error('Calendar error:', err);
    throw new Error('Could not create calendar event');
  }

  const data = await res.json();
  return {
    eventId: data.id,
    recurrenceRule: recurrence ? recurrence[0].replace('RRULE:', '') : null,
  };
}

/**
 * Query Google FreeBusy for a single calendar.
 *
 * Used to keep the public 15-minute call picker in step with the teacher's
 * real calendar. Note that Google only reports events marked *busy*: events
 * set to "free" — which is the default for all-day events — come back as
 * available, so a half-day absence has to be entered as a busy event (or as
 * a blocked date).
 *
 * Never returns [] on failure: an empty busy list reads as "everything is
 * free", which is exactly how a visitor ends up booked over a lesson.
 *
 * @param {object} opts
 * @param {string} opts.accessToken
 * @param {string} opts.calendarId
 * @param {string} opts.timeMin — ISO
 * @param {string} opts.timeMax — ISO, less than ~3 months after timeMin
 * @returns {Promise<{start: string, end: string}[]>} busy intervals
 */
export async function fetchFreeBusy({ accessToken, calendarId, timeMin, timeMax }) {
  const res = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      timeMin,
      timeMax,
      timeZone: 'Europe/Zurich',
      items: [{ id: calendarId }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error('FreeBusy error:', res.status, body);
    const error = new Error(`FreeBusy API error (${res.status}): ${body.slice(0, 200)}`);
    error.statusCode = res.status >= 500 ? 502 : res.status;
    throw error;
  }

  const data = await res.json();
  // Google normalises 'primary' to the real address, so the key does not
  // always match what auth-callback stored — fall back to the only entry.
  const entry = data.calendars?.[calendarId] || Object.values(data.calendars || {})[0];
  if (!entry) {
    const error = new Error('FreeBusy returned no calendar entry');
    error.statusCode = 502;
    throw error;
  }
  if (entry.errors?.length) {
    const reason = entry.errors.map((e) => e.reason).join(', ');
    console.error('FreeBusy calendar error:', reason);
    const error = new Error(`FreeBusy calendar error: ${reason}`);
    error.statusCode = 502;
    throw error;
  }

  return entry.busy || [];
}

/**
 * Create a 15-minute intro call on the teacher's calendar with the visitor
 * as an attendee and an auto-generated Google Meet link.
 *
 * `sendUpdates: 'all'` is what makes Google email the visitor a real
 * invitation they can accept or decline. Pass 'none' from test scripts to
 * create the event silently.
 *
 * Meet creation can fail on account types where Meet is disabled — Google
 * still returns the event, just without a conference. Callers must treat a
 * null meetLink as normal.
 *
 * @param {object} opts
 * @param {string} opts.accessToken
 * @param {string} opts.calendarId
 * @param {string} opts.bookingId — call_bookings.id; doubles as Google's
 *   conference idempotency key, so a retry reuses the same Meet room.
 * @param {string} opts.startIso
 * @param {number} [opts.durationMinutes]
 * @param {string} opts.visitorName
 * @param {string} opts.visitorEmail
 * @param {string} [opts.visitorPhone]
 * @param {string} [opts.topic]
 * @param {string} [opts.language]
 * @param {string} [opts.teacherName]
 * @param {string} [opts.sendUpdates]
 * @returns {Promise<{eventId: string, meetLink: string|null, htmlLink: string|null}>}
 */
export async function createCallCalendarEvent({
  accessToken,
  calendarId,
  bookingId,
  startIso,
  durationMinutes = 15,
  visitorName,
  visitorEmail,
  visitorPhone,
  topic,
  language = 'en',
  teacherName = 'learning with gioia',
  sendUpdates = 'all',
}) {
  const startTime = new Date(startIso);
  const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);

  const eventBody = {
    summary: `${durationMinutes}min call — ${visitorName} <> ${teacherName}`,
    description:
      `Intro call (${durationMinutes} min)\n` +
      `Name: ${visitorName}\n` +
      `Email: ${visitorEmail}\n` +
      (visitorPhone ? `Phone: ${visitorPhone}\n` : '') +
      `Language: ${language.toUpperCase()}\n` +
      (topic ? `Topic: ${topic}\n` : '') +
      `\nBooked via learningwithgioia.ch\nBooking: ${bookingId}`,
    start: { dateTime: startTime.toISOString(), timeZone: 'Europe/Zurich' },
    end: { dateTime: endTime.toISOString(), timeZone: 'Europe/Zurich' },
    attendees: [{ email: visitorEmail, displayName: visitorName }],
    guestsCanInviteOthers: false,
    guestsCanModify: false,
    guestsCanSeeOtherGuests: false,
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email', minutes: 60 },
        { method: 'popup', minutes: 10 },
      ],
    },
    conferenceData: {
      createRequest: {
        requestId: bookingId,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    },
  };

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events` +
      `?conferenceDataVersion=1&sendUpdates=${encodeURIComponent(sendUpdates)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(eventBody),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    console.error('Call calendar error:', res.status, body);
    const error = new Error(`Could not create call event (${res.status})`);
    error.statusCode = res.status >= 500 ? 502 : res.status;
    throw error;
  }

  const data = await res.json();
  const meetLink =
    data.hangoutLink ||
    data.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')?.uri ||
    null;

  return { eventId: data.id, meetLink, htmlLink: data.htmlLink || null };
}

// How far back fetchCourseEvents looks. Events older than this are not
// reported, so callers must treat the window as "what Google was asked
// about" rather than "everything that exists" — see the `since` field of
// the return value.
const EVENT_WINDOW_DAYS = 90;

/**
 * Fetch expanded single events from Google Calendar matching a course code.
 *
 * Starts from 90 days ago so we don't blow past the per-page cap with legacy
 * sessions, and keeps only the events whose summary carries the course code as
 * a standalone token — see summaryMatchesCourseCode for why position does not
 * matter.
 *
 * Follows nextPageToken to the end: a truncated list looks exactly like a
 * set of deleted events to a caller that reconciles by absence, and silently
 * dropping the tail of a long course is worse than one extra request.
 *
 * @param {object} opts
 * @param {string} opts.accessToken
 * @param {string} opts.calendarId
 * @param {string} opts.courseCode
 * @returns {Promise<{active: object[], cancelled: object[], since: string}>}
 *   `since` is the ISO lower bound of the window that was searched; nothing
 *   before it was considered, so its absence proves nothing.
 */
export async function fetchCourseEvents({ accessToken, calendarId, courseCode }) {
  const timeMin = new Date(Date.now() - EVENT_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const items = [];
  let pageToken = null;
  do {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?` +
        `q=${encodeURIComponent(courseCode)}` +
        `&singleEvents=true&orderBy=startTime&maxResults=250` +
        `&timeMin=${encodeURIComponent(timeMin)}` +
        (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''),
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error('Calendar fetch error:', err);
      const error = new Error(`Calendar API error (${res.status}): ${err.slice(0, 200)}`);
      error.statusCode = res.status >= 500 ? 502 : res.status;
      throw error;
    }

    const data = await res.json();
    items.push(...(data.items || []));
    pageToken = data.nextPageToken || null;
  } while (pageToken);

  const matches = (e) => summaryMatchesCourseCode(e.summary, courseCode);

  return {
    active: items.filter((e) => matches(e) && e.status !== 'cancelled'),
    cancelled: items.filter((e) => matches(e) && e.status === 'cancelled'),
    since: timeMin,
  };
}

// Upper bound on the calendar writes one rename may issue. Sync already spends
// a subrequest per session on the upsert loop, and Google meters writes per
// calendar, so a course with dozens of hand-edited lessons must not be allowed
// to eat the whole budget. Whatever is left over is picked up next sync — every
// step below is a diff against the current state, so stopping early is safe.
const MAX_TITLE_PATCHES = 40;

async function patchEventSummary({ accessToken, calendarId, eventId, summary }) {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=none`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ summary }),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    console.error('Title patch error:', res.status, err.slice(0, 200));
    const error = new Error(`Could not rename event (${res.status})`);
    error.statusCode = res.status;
    throw error;
  }
  return res.json();
}

/**
 * Bring a course's calendar events in line with `desiredTitle`.
 *
 * The title is derived from the course record rather than stored, so linking a
 * company or correcting a level has to be pushed to Google by something. That
 * something is sync — this runs on every press and is a no-op once the titles
 * agree.
 *
 * Three facts about Google's model drive the algorithm:
 *
 *  1. Ordinary instances of a recurring event are expanded from the parent on
 *     every read; they hold no summary of their own. So one PATCH of the master
 *     renames the entire series, past occurrences included, however old.
 *  2. An instance the teacher edited or dragged is an *override* — a real event
 *     resource, created as a full copy of the parent at the moment of the edit,
 *     with its own materialised summary. The parent PATCH does not reach it, so
 *     it needs one of its own.
 *  3. PATCHing an ordinary instance *creates* an override. That is the thing to
 *     never do by accident: a spurious override collides with the EXDATE logic
 *     above, whose failure modes are documented on applyBlockedDatesToSeries.
 *
 * Hence: patch the master, re-read, and then only touch what is left — which by
 * construction is either already an override or not part of this series at all.
 * An instance that did not inherit and is not an override is Google lagging
 * behind its own write; it is logged and left for the next sync.
 *
 * Renaming never changes an event id, so nothing downstream in sync — the
 * session upsert, the deletion pass, sessions_completed — can be affected.
 *
 * @param {object} opts
 * @param {string} opts.accessToken
 * @param {string} opts.calendarId
 * @param {string} opts.courseCode
 * @param {string|null} opts.masterEventId — courses.calendar_event_id
 * @param {string|null} opts.desiredTitle — from courseEventTitle(); null = leave alone
 * @param {object[]} opts.activeEvents — expanded instances from fetchCourseEvents
 * @param {number} [opts.maxPatches]
 * @returns {Promise<{title: string|null, patched: number, failed: number,
 *   skipped: string[], capped: boolean, rateLimited: boolean}>}
 */
export async function renameCourseEvents({
  accessToken,
  calendarId,
  courseCode,
  masterEventId,
  desiredTitle,
  activeEvents = [],
  maxPatches = MAX_TITLE_PATCHES,
}) {
  const result = {
    title: desiredTitle || null,
    patched: 0,
    failed: 0,
    skipped: [],
    capped: false,
    rateLimited: false,
  };
  if (!desiredTitle) return result;

  const isStale = (e) => e.status !== 'cancelled' && (e.summary || '') !== desiredTitle;

  // Nothing to do, and — importantly — not a single request spent finding that
  // out. The admin presses sync repeatedly; the steady state has to be free.
  if (!activeEvents.some(isStale)) return result;

  // Google rejects further writes long before it stops answering reads, so a
  // quota error means stop, not retry.
  const halt = (err) => {
    if (err?.statusCode === 403 || err?.statusCode === 429) {
      result.rateLimited = true;
      return true;
    }
    return false;
  };

  let master = null;
  let masterPatched = false;
  if (masterEventId) {
    const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(masterEventId)}`;
    const masterRes = await fetch(base, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!masterRes.ok) {
      throw new Error(`Could not load recurring event (${masterRes.status})`);
    }
    master = await masterRes.json();
    if ((master.summary || '') !== desiredTitle) {
      try {
        // Keep the patched copy: its `updated` stamp is what tells an
        // override apart from an instance that merely inherited.
        master = await patchEventSummary({
          accessToken,
          calendarId,
          eventId: masterEventId,
          summary: desiredTitle,
        });
        masterPatched = true;
        result.patched++;
      } catch (err) {
        if (halt(err)) return result;
        result.failed++;
      }
    }
  }

  // Re-read so everything that inherited the new title drops out below. This
  // is what keeps the loop from mistaking an ordinary instance for an override.
  let events = activeEvents;
  if (masterPatched) {
    ({ active: events } = await fetchCourseEvents({ accessToken, calendarId, courseCode }));
  }

  const parentsToPatch = new Set();
  for (const event of events) {
    if (result.patched + result.failed >= maxPatches) {
      result.capped = true;
      break;
    }
    if (!isStale(event) || event.id === masterEventId) continue;

    // An instance of some other series carrying this code. Patch that series'
    // master once, never the instance — that would plant an override in a
    // recurrence this course does not own.
    if (event.recurringEventId && event.recurringEventId !== masterEventId) {
      parentsToPatch.add(event.recurringEventId);
      continue;
    }

    // A standalone one-off: the sessions a teacher adds by hand for a course
    // created with singleSession. Its own resource, safe to patch directly.
    const standalone = !event.recurringEventId;
    const isOverride =
      standalone ||
      isMovedInstance(event) ||
      (master?.updated && event.updated && event.updated !== master.updated);

    if (!isOverride) {
      // Google has not finished propagating the master patch. Patching here
      // would manufacture the override this whole function exists to avoid.
      result.skipped.push(event.id);
      continue;
    }

    try {
      await patchEventSummary({
        accessToken,
        calendarId,
        eventId: event.id,
        summary: desiredTitle,
      });
      result.patched++;
    } catch (err) {
      if (halt(err)) return result;
      result.failed++;
    }
  }

  for (const parentId of parentsToPatch) {
    if (result.patched + result.failed >= maxPatches) {
      result.capped = true;
      break;
    }
    try {
      await patchEventSummary({
        accessToken,
        calendarId,
        eventId: parentId,
        summary: desiredTitle,
      });
      result.patched++;
    } catch (err) {
      if (halt(err)) return result;
      result.failed++;
    }
  }

  if (result.skipped.length) {
    console.warn(
      'Calendar rename: instances did not inherit the new title, left for the next sync:',
      result.skipped.join(', ')
    );
  }

  return result;
}

/**
 * Enforce blocked dates on an existing recurring course event.
 *
 * Scans the expanded instances of the course's master event for future
 * occurrences that fall on a blocked date. If any are found, the master
 * event is patched: those occurrences are excluded via EXDATE and the
 * RRULE COUNT is extended so the skipped sessions reappear after the last
 * scheduled one (replacement slots that themselves land on blocked dates
 * are excluded and pushed out too). Manually created one-off events are
 * left alone — only instances of the recurring series are touched, and
 * only strictly-future ones.
 *
 * This runs on every sync, so it has to be idempotent, and two things that
 * look harmless individually are what stopped it from being:
 *
 *  1. It re-excluded slots the recurrence already excluded. Extending COUNT
 *     for an exclusion that was already paid for appends one extra
 *     occurrence, and since the trigger does not go away the next sync does
 *     it again — the series grew by a session per sync, which is why the
 *     tail of a blocked course showed duplicates.
 *  2. It excluded instances the teacher had moved by hand. Those are
 *     overrides keyed by their *original* slot, so the exclusion names a
 *     date that is not the blocked one; Google's handling of an EXDATE that
 *     collides with an override is not specified, and both outcomes are
 *     wrong here — either a deliberate reschedule silently disappears, or it
 *     survives and feeds loop (1) forever.
 *
 * So: only genuinely new exclusions count, and manually moved instances are
 * reported rather than rewritten. Google's own guidance for dropping a
 * single occurrence is to cancel the instance resource, not to edit the
 * parent's EXDATE, which is the right shape for a future change here.
 *
 * Telling the two apart is the subtle part — see isMovedInstance below.
 *
 * @param {object} opts
 * @param {string} opts.accessToken
 * @param {string} opts.calendarId
 * @param {string} opts.masterEventId — courses.calendar_event_id
 * @param {object[]} opts.activeEvents — expanded instances from fetchCourseEvents
 * @param {object[]} opts.blockedPeriods
 * @returns {Promise<{patched: boolean, recurrenceRule: string|null,
 *   excludedCount: number, movedOntoBlockedDates: string[]}>}
 *   `patched` says whether the master event was rewritten; the caller should
 *   only re-read the series and persist recurrenceRule when it is true.
 *   `movedOntoBlockedDates` lists the dates of hand-moved instances now
 *   sitting on a blocked date, for the admin to resolve.
 */
/**
 * Whether an expanded instance sits somewhere other than the slot its
 * recurrence generated — i.e. a teacher dragged it.
 *
 * `originalStartTime` is *not* the marker: Google sets it on every instance
 * of a recurring event, moved or not, so its mere presence classifies the
 * whole series as hand-moved. That is what silently switched blocked-date
 * enforcement off — nothing was ever a candidate for exclusion, and every
 * blocked occurrence was reported to the admin as an untouchable manual
 * reschedule instead.
 *
 * The times are compared as instants, since Google is free to report the
 * same moment as a UTC 'Z' stamp in one field and a Zurich offset in the
 * other.
 */
function isMovedInstance(ev) {
  const original = ev.originalStartTime?.dateTime;
  if (!original) return false;
  return new Date(original).getTime() !== new Date(ev.start.dateTime).getTime();
}

export async function applyBlockedDatesToSeries({
  accessToken,
  calendarId,
  masterEventId,
  activeEvents,
  blockedPeriods,
}) {
  const unchanged = (movedOntoBlockedDates = []) => ({
    patched: false,
    recurrenceRule: null,
    excludedCount: 0,
    movedOntoBlockedDates,
  });

  if (!blockedPeriods.length) return unchanged();
  const today = zurichParts(new Date()).date;

  // Strictly-future instances of this series sitting on a blocked date.
  const candidates = [];
  const movedOntoBlockedDates = [];
  for (const ev of activeEvents) {
    if (ev.recurringEventId !== masterEventId || !ev.start?.dateTime) continue;
    const actualDate = zurichParts(ev.start.dateTime).date;
    if (actualDate <= today || !isDateBlocked(actualDate, blockedPeriods)) continue;
    if (isMovedInstance(ev)) {
      movedOntoBlockedDates.push(actualDate);
      continue;
    }
    candidates.push(zurichParts(ev.start.dateTime));
  }
  if (!candidates.length) return unchanged(movedOntoBlockedDates);

  // Load the master event for the authoritative recurrence array.
  const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(masterEventId)}`;
  const masterRes = await fetch(base, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!masterRes.ok) {
    throw new Error(`Could not load recurring event (${masterRes.status})`);
  }
  const master = await masterRes.json();
  const recurrence = master.recurrence || [];
  const rruleIndex = recurrence.findIndex((line) => line.startsWith('RRULE:'));
  if (rruleIndex === -1) return unchanged(movedOntoBlockedDates);

  // Drop anything the recurrence already excludes, and anything listed twice
  // in this batch, so COUNT is only ever extended for occurrences that are
  // actually being given up now.
  const alreadyExcluded = excludedSlotKeys(recurrence);
  const seen = new Set();
  const newExclusions = candidates.filter((slot) => {
    if (isSlotExcluded(slot, alreadyExcluded) || seen.has(slotKey(slot))) return false;
    seen.add(slotKey(slot));
    return true;
  });
  if (!newExclusions.length) {
    // An instance is on a blocked date yet its slot is already excluded:
    // Google is still serving an occurrence the recurrence says is gone.
    // Leave it be — re-excluding is what used to inflate the series.
    console.warn(
      'Blocked dates: already-excluded occurrences still present on',
      candidates.map((s) => s.date).join(', ')
    );
    return unchanged(movedOntoBlockedDates);
  }

  let rrule = recurrence[rruleIndex];
  const countMatch = rrule.match(/COUNT=(\d+)/);
  const excluded = [...newExclusions];
  if (countMatch) {
    const masterStart = zurichParts(master.start.dateTime || master.start.date);
    const extension = extendSeries({
      startDate: masterStart.date,
      startTime: masterStart.time,
      count: parseInt(countMatch[1], 10),
      needed: newExclusions.length,
      blockedPeriods,
    });
    excluded.push(...extension.excluded);
    rrule = rrule.replace(/COUNT=\d+/, `COUNT=${extension.count}`);
  }

  const newRecurrence = [...recurrence];
  newRecurrence[rruleIndex] = rrule;
  newRecurrence.push(exdateLine(excluded));

  const patchRes = await fetch(`${base}?sendUpdates=none`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ recurrence: newRecurrence }),
  });
  if (!patchRes.ok) {
    const err = await patchRes.text();
    console.error('Blocked-dates patch error:', patchRes.status, err);
    throw new Error(`Could not update recurring event (${patchRes.status})`);
  }

  return {
    patched: true,
    recurrenceRule: rrule.replace('RRULE:', ''),
    excludedCount: newExclusions.length,
    movedOntoBlockedDates,
  };
}
