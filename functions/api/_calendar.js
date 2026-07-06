// functions/api/_calendar.js
// Shared Google Calendar helpers for course management.

import {
  isDateBlocked,
  zurichParts,
  exdateLine,
  planWeeklySchedule,
  extendSeries,
} from './_blocked-dates.js';

/**
 * Create a recurring Google Calendar event for a course.
 *
 * @param {object} opts
 * @param {string} opts.accessToken  — Google OAuth access token
 * @param {string} opts.calendarId   — Teacher's calendar ID
 * @param {string} opts.courseCode   — e.g. "P-A1-001"
 * @param {object} opts.booking      — Booking data (service, level, language, exam)
 * @param {object} opts.contact      — Contact data (lead, participants)
 * @param {string} opts.teacherName  — Teacher display name
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
  teacherName,
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

  const eventTitle = participantNames.length
    ? `${courseCode} — ${participantNames.join('+')} <> ${teacherName}`
    : `${courseCode} <> ${teacherName}`;

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
 * Fetch expanded single events from Google Calendar matching a course code.
 *
 * Starts from 90 days ago so we don't blow past the 250-event cap with
 * legacy sessions, and matches the course code as a prefix followed by a
 * non-alphanumeric boundary — otherwise "12345" would false-positive on a
 * summary starting with "123456".
 *
 * @param {object} opts
 * @param {string} opts.accessToken
 * @param {string} opts.calendarId
 * @param {string} opts.courseCode
 * @returns {Promise<{active: object[], cancelled: object[]}>}
 */
export async function fetchCourseEvents({ accessToken, calendarId, courseCode }) {
  const timeMin = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?` +
      `q=${encodeURIComponent(courseCode)}` +
      `&singleEvents=true&orderBy=startTime&maxResults=250` +
      `&timeMin=${encodeURIComponent(timeMin)}`,
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
  const items = data.items || [];

  const matches = (e) => {
    const s = e.summary || '';
    if (!s.startsWith(courseCode)) return false;
    const next = s.charAt(courseCode.length);
    return next === '' || /[^A-Za-z0-9]/.test(next);
  };

  return {
    active: items.filter((e) => matches(e) && e.status !== 'cancelled'),
    cancelled: items.filter((e) => matches(e) && e.status === 'cancelled'),
  };
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
 * @param {object} opts
 * @param {string} opts.accessToken
 * @param {string} opts.calendarId
 * @param {string} opts.masterEventId — courses.calendar_event_id
 * @param {object[]} opts.activeEvents — expanded instances from fetchCourseEvents
 * @param {object[]} opts.blockedPeriods
 * @returns {Promise<{recurrenceRule: string, excludedCount: number}|null>}
 *   null when nothing needed patching.
 */
export async function applyBlockedDatesToSeries({
  accessToken,
  calendarId,
  masterEventId,
  activeEvents,
  blockedPeriods,
}) {
  if (!blockedPeriods.length) return null;
  const today = zurichParts(new Date()).date;

  // Future instances of this series sitting on blocked dates. EXDATE must
  // reference the original series slot, so use originalStartTime for
  // instances a teacher has manually moved (their moved date is what
  // decides whether they are blocked).
  const newExclusions = [];
  for (const ev of activeEvents) {
    if (ev.recurringEventId !== masterEventId || !ev.start?.dateTime) continue;
    const actualDate = zurichParts(ev.start.dateTime).date;
    if (actualDate <= today || !isDateBlocked(actualDate, blockedPeriods)) continue;
    newExclusions.push(zurichParts(ev.originalStartTime?.dateTime || ev.start.dateTime));
  }
  if (!newExclusions.length) return null;

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
  if (rruleIndex === -1) return null;

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

  return { recurrenceRule: rrule.replace('RRULE:', ''), excludedCount: newExclusions.length };
}
