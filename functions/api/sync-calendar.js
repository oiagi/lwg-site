// functions/api/sync-calendar.js
// POST /api/sync-calendar
// Body: { course_id }
//
// On-demand Google Calendar sync for a course.
// Driven by the "sync" button on a course in the admin dashboard — there is
// no webhook and no automatic refresh, so anything a teacher changes in
// Google Calendar shows up only once somebody syncs. Fetches all calendar
// events matching the course code, upserts session records in Supabase, and
// updates sessions_completed.
//
// The admin presses this button repeatedly, so every step has to be
// idempotent: see applyBlockedDatesToSeries in _calendar.js for the two ways
// that went wrong, and the deletion loop below for why an event's absence is
// only meaningful inside the window that was actually searched.
//
// Idempotent is not the same as self-healing, though, and the rows a broken
// sync already wrote are nobody else's job to clear up — hence the duplicate
// collapse before the upsert.
//
// Environment variables:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY, SUPABASE_ANON_KEY,
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET

import {
  supabaseHeaders,
  requireAdminAuth,
  getValidAccessToken,
  jsonResponse,
  errorResponse,
  withErrorHandling,
  parseJsonBody,
} from './_utils.js';
import {
  fetchCourseEvents,
  applyBlockedDatesToSeries,
  courseEventTitle,
  renameCourseEvents,
} from './_calendar.js';
import { loadBlockedPeriods } from './_blocked-dates.js';

function dbEq(value) {
  return encodeURIComponent(String(value));
}

async function readJson(res, fallback = null) {
  const text = await res.text();
  if (!text) return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

async function expectSupabase(res, message) {
  if (res.ok) return readJson(res, []);
  const body = await res.text();
  console.error(`${message}:`, res.status, body);
  const err = new Error(message);
  err.statusCode = 502;
  throw err;
}

// Session ids that already carry attendance records, so collapsing a set of
// duplicates never throws away the one row a lesson was actually logged
// against. Returns null when the lookup fails — the caller then leaves the
// duplicates alone rather than guessing which copy is disposable.
async function sessionIdsWithAttendance(SUPABASE_URL, headers, sessionIds) {
  const filter = sessionIds.map((id) => `session_id.eq.${dbEq(id)}`).join(',');
  const res = await fetch(`${SUPABASE_URL}/rest/v1/attendance?or=(${filter})&select=session_id`, {
    headers,
  });
  if (!res.ok) {
    console.error(
      'Could not load attendance for duplicate sessions:',
      res.status,
      await res.text()
    );
    return null;
  }
  const rows = await readJson(res, []);
  return new Set(rows.map((r) => r.session_id));
}

/**
 * The company name and student first name the calendar title needs.
 *
 * Neither is on the course row: the company is a foreign key, and the row's
 * own participant_names is a snapshot from the day the course was created, so
 * a student who has since changed their name would keep the old one in the
 * title. Enrolments are the live answer.
 *
 * Never throws. A lookup that fails costs the title one part; it must not cost
 * the admin their sync.
 */
async function loadTitleContext(course, SUPABASE_URL, headers) {
  const isPrivate = course.group_type === 'private';
  let companyName = null;
  let participantName = null;

  if (course.company_id) {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/companies?id=eq.${dbEq(course.company_id)}&select=name`,
        { headers }
      );
      if (res.ok) companyName = (await readJson(res, []))[0]?.name || null;
      else console.error('Title company lookup failed:', res.status);
    } catch (err) {
      console.error('Title company lookup error:', err);
    }
  }
  // The free-text venue name stands in for an unlinked company, but only where
  // it cannot be mistaken for one: a private lesson at the student's office
  // stays titled by the student.
  if (!companyName && !isPrivate) companyName = course.location_company || null;

  if (isPrivate && !companyName) {
    try {
      const enrolRes = await fetch(
        `${SUPABASE_URL}/rest/v1/enrolments?course_id=eq.${dbEq(course.id)}&select=student_id`,
        { headers }
      );
      const enrolments = enrolRes.ok ? await readJson(enrolRes, []) : [];
      const studentId = enrolments[0]?.student_id;
      if (studentId) {
        const studRes = await fetch(
          `${SUPABASE_URL}/rest/v1/students?id=eq.${dbEq(studentId)}&select=first_name`,
          { headers }
        );
        if (studRes.ok) participantName = (await readJson(studRes, []))[0]?.first_name || null;
      }
    } catch (err) {
      console.error('Title student lookup error:', err);
    }
    if (!participantName) participantName = course.participant_names?.[0] || null;
  }

  return { companyName, participantName };
}

/**
 * Delete surplus session rows that share a calendar_event_id, keeping one.
 *
 * The survivor is whichever copy holds something worth keeping: attendance
 * first, then a status the admin set by hand ('completed'/'cancelled' both
 * outrank the 'scheduled' a sync would have written anyway), then the lowest
 * id so repeated runs agree. A group with attendance on more than one copy is
 * left untouched and logged — merging attendance is not a decision to make
 * silently behind a sync button.
 *
 * @returns {Promise<string[]>} ids of the rows that were deleted
 */
async function collapseDuplicateSessions({ sessions, SUPABASE_URL, headers }) {
  const groups = new Map();
  for (const s of sessions) {
    if (!s.calendar_event_id) continue;
    const group = groups.get(s.calendar_event_id);
    if (group) group.push(s);
    else groups.set(s.calendar_event_id, [s]);
  }
  const duplicates = [...groups.values()].filter((g) => g.length > 1);
  if (!duplicates.length) return [];

  const logged = await sessionIdsWithAttendance(
    SUPABASE_URL,
    headers,
    duplicates.flat().map((s) => s.id)
  );
  if (!logged) return [];

  const rank = (s) => (logged.has(s.id) ? 2 : s.status === 'scheduled' ? 0 : 1);
  const removed = [];
  for (const group of duplicates) {
    if (group.filter((s) => logged.has(s.id)).length > 1) {
      console.warn(
        'Duplicate sessions share attendance, left for a human:',
        group.map((s) => s.id).join(', ')
      );
      continue;
    }
    const ordered = [...group].sort(
      (a, b) => rank(b) - rank(a) || String(a.id).localeCompare(String(b.id))
    );
    for (const dupe of ordered.slice(1)) {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/sessions?id=eq.${dbEq(dupe.id)}`, {
        method: 'DELETE',
        headers,
      });
      if (!res.ok) await expectSupabase(res, 'Could not remove duplicate session');
      removed.push(dupe.id);
    }
  }
  return removed;
}

export const onRequestPost = withErrorHandling(async ({ request, env }) => {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;
  const headers = supabaseHeaders(SUPABASE_SERVICE_KEY);

  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  const { body, error } = await parseJsonBody(request);
  if (error) return error;

  const { course_id } = body;
  if (!course_id) return errorResponse('Missing course_id', 400);

  // ── Load course ──────────────────────────────────────────────────────
  const cr = await fetch(`${SUPABASE_URL}/rest/v1/courses?id=eq.${dbEq(course_id)}&select=*`, {
    headers,
  });
  const courses = await expectSupabase(cr, 'Could not load course');
  if (!courses.length) return errorResponse('Course not found', 404);
  const course = courses[0];

  // ── Load teacher ─────────────────────────────────────────────────────
  const tr = await fetch(
    `${SUPABASE_URL}/rest/v1/teachers?id=eq.${dbEq(course.teacher_id)}&select=*`,
    {
      headers,
    }
  );
  const teachers = await expectSupabase(tr, 'Could not load teacher');
  if (!teachers.length) return errorResponse('Teacher not found', 404);
  const teacher = teachers[0];
  if (!teacher.refresh_token)
    return errorResponse('Teacher has not authorised Google Calendar', 400);
  if (!teacher.calendar_id) return errorResponse('Teacher has no Google Calendar selected', 400);

  // ── Get access token ─────────────────────────────────────────────────
  let accessToken;
  try {
    accessToken = await getValidAccessToken(teacher, env);
  } catch (err) {
    console.error('Token error:', err);
    return errorResponse(err.message, err.statusCode || 500);
  }

  // ── Fetch events from Google Calendar matching this course code ───────
  // `since` is the start of the window Google was asked about; sessions
  // before it are simply not reported and must not be mistaken for deleted.
  let activeEvents, cancelledEvents, fetchedSince;
  try {
    ({
      active: activeEvents,
      cancelled: cancelledEvents,
      since: fetchedSince,
    } = await fetchCourseEvents({
      accessToken,
      calendarId: teacher.calendar_id,
      courseCode: course.course_code,
    }));
  } catch (err) {
    return errorResponse(err.message || 'Calendar API error', err.statusCode || 502);
  }

  // ── Enforce blocked dates on the recurring series ──────────────────────
  // Future occurrences of the course's recurring event that fall on blocked
  // dates are excluded (EXDATE) and the RRULE COUNT extended, so the skipped
  // sessions reappear after the last scheduled one. On success the events
  // are re-fetched so the sync below mirrors the corrected series.
  let blockedApplied = null;
  if (course.calendar_event_id) {
    try {
      const blockedPeriods = await loadBlockedPeriods(SUPABASE_URL, headers);
      blockedApplied = await applyBlockedDatesToSeries({
        accessToken,
        calendarId: teacher.calendar_id,
        masterEventId: course.calendar_event_id,
        activeEvents,
        blockedPeriods,
      });
      if (blockedApplied.patched) {
        ({
          active: activeEvents,
          cancelled: cancelledEvents,
          since: fetchedSince,
        } = await fetchCourseEvents({
          accessToken,
          calendarId: teacher.calendar_id,
          courseCode: course.course_code,
        }));
        const recUpdateRes = await fetch(
          `${SUPABASE_URL}/rest/v1/courses?id=eq.${dbEq(course.id)}`,
          {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ recurrence_rule: blockedApplied.recurrenceRule }),
          }
        );
        if (!recUpdateRes.ok)
          console.error('Could not store updated recurrence rule:', await recUpdateRes.text());
      }
    } catch (err) {
      // Non-fatal: sync still mirrors the calendar as-is; the next sync
      // retries the blocked-date enforcement.
      console.error('Blocked-date enforcement error:', err);
    }
  }

  // ── Keep the calendar title in step with the course record ────────────
  // The title is derived from the course, not stored, so linking a company or
  // fixing a level on the edit page reaches Google only when somebody syncs.
  // Renaming preserves event ids, so nothing below this point — the upsert, the
  // deletion pass, sessions_completed — can be disturbed by it.
  let renamed = null;
  try {
    const { companyName, participantName } = await loadTitleContext(course, SUPABASE_URL, headers);
    renamed = await renameCourseEvents({
      accessToken,
      calendarId: teacher.calendar_id,
      courseCode: course.course_code,
      masterEventId: course.calendar_event_id || null,
      desiredTitle: courseEventTitle({
        courseCode: course.course_code,
        subject: course.subject,
        level: course.level,
        groupType: course.group_type,
        companyName,
        participantName,
      }),
      activeEvents,
    });
  } catch (err) {
    // Non-fatal, exactly like blocked-date enforcement above: a sync that could
    // not rename is still a correct sync, and the next press retries.
    console.error('Calendar title rename error:', err);
  }

  const activeEventIds = new Set(activeEvents.map((e) => e.id));

  // ── Load existing session records once ────────────────────────────────
  const allDbRes = await fetch(
    `${SUPABASE_URL}/rest/v1/sessions?course_id=eq.${dbEq(course.id)}&select=id,calendar_event_id,status,scheduled_at`,
    { headers }
  );
  let allDbSessions = await expectSupabase(allDbRes, 'Could not load course sessions');

  // ── Collapse rows that describe the same calendar event ───────────────
  // Two rows carrying one calendar_event_id are one lesson recorded twice.
  // Nothing downstream removes them: the upsert below looks sessions up in a
  // Map, where the duplicate is simply overwritten and never visited, and the
  // deletion pass spares every row whose event is still on the calendar. So a
  // duplicate — from two syncs racing, or from the series inflation this
  // branch fixes — outlives every future sync unless it is collapsed here.
  const deduplicated = await collapseDuplicateSessions({
    sessions: allDbSessions,
    SUPABASE_URL,
    headers,
  });
  if (deduplicated.length) {
    const dropped = new Set(deduplicated);
    allDbSessions = allDbSessions.filter((s) => !dropped.has(s.id));
  }

  const sessionsByCalendarId = new Map(
    allDbSessions.filter((s) => s.calendar_event_id).map((s) => [s.calendar_event_id, s])
  );

  // ── Upsert active session records ────────────────────────────────────
  const now = new Date();
  let updatedCount = 0;
  let createdCount = 0;
  let removedCount = 0;
  let keptCancelledCount = 0;

  // Statuses after this sync, so sessions_completed can be derived from the
  // whole course rather than from the fetch window. Pre-existing rows are
  // keyed by id (they can still be updated or deleted below); rows created in
  // this pass are collected separately since the insert returns no id.
  const statusById = new Map(allDbSessions.map((s) => [s.id, s.status]));
  const createdStatuses = [];

  for (const event of activeEvents) {
    const scheduledAt = event.start.dateTime || event.start.date;
    const endAt = event.end?.dateTime || event.end?.date;
    const durationMinutes =
      scheduledAt && endAt ? Math.round((new Date(endAt) - new Date(scheduledAt)) / 60000) : 50;
    const isPast = new Date(scheduledAt) < now;
    const status = isPast ? 'completed' : 'scheduled';

    const existing = sessionsByCalendarId.get(event.id);

    if (existing) {
      // A session cancelled in the admin stays cancelled. The calendar event
      // outliving it (a failed delete, or a course cancelled while Google was
      // unreachable) is not a reason to put the lesson back on the books.
      if (existing.status === 'cancelled') {
        keptCancelledCount++;
        continue;
      }
      const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/sessions?id=eq.${dbEq(existing.id)}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          scheduled_at: scheduledAt,
          duration_minutes: durationMinutes,
          status,
        }),
      });
      if (!updateRes.ok) await expectSupabase(updateRes, 'Could not update synced session');
      statusById.set(existing.id, status);
      updatedCount++;
    } else {
      const createRes = await fetch(`${SUPABASE_URL}/rest/v1/sessions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          course_id: course.id,
          teacher_id: course.teacher_id,
          scheduled_at: scheduledAt,
          duration_minutes: durationMinutes,
          status,
          calendar_event_id: event.id,
        }),
      });
      if (!createRes.ok) await expectSupabase(createRes, 'Could not create synced session');
      createdStatuses.push(status);
      createdCount++;
    }
  }

  // ── Remove sessions no longer in Google Calendar ─────────────────────
  // Delete synced sessions whose calendar event disappeared from Google.
  // This covers both explicitly cancelled and silently deleted events.
  //
  // Only sessions inside the window fetchCourseEvents searched can be judged
  // this way. Google was never asked about anything before `since`, so the
  // absence of an old event says nothing — treating it as deleted wiped the
  // entire history of any course that had been running for over 90 days, and
  // took sessions_completed down with it.
  //
  // Cancelled rows are exempt for the same reason they survive the upsert:
  // cancelling a lesson removes its calendar event, so a cancelled row always
  // looks like one Google has never heard of. Deleting it does not tidy
  // anything up — it erases the record that the lesson was called off rather
  // than never scheduled, along with the attendance hanging off it.
  const windowStart = new Date(fetchedSince);
  for (const sess of allDbSessions) {
    if (!sess.calendar_event_id || activeEventIds.has(sess.calendar_event_id)) continue;
    if (sess.status === 'cancelled') continue;
    if (!sess.scheduled_at || new Date(sess.scheduled_at) < windowStart) continue;
    const deleteRes = await fetch(`${SUPABASE_URL}/rest/v1/sessions?id=eq.${dbEq(sess.id)}`, {
      method: 'DELETE',
      headers,
    });
    if (!deleteRes.ok) await expectSupabase(deleteRes, 'Could not remove stale synced session');
    statusById.delete(sess.id);
    removedCount++;
  }

  // ── Update sessions_completed count on course ─────────────────────────
  // Derived from every surviving session of the course, not just the ones in
  // the fetch window, so syncing an old course cannot reset its progress.
  const finalStatuses = [...statusById.values(), ...createdStatuses];
  const completedCount = finalStatuses.filter((s) => s === 'completed').length;
  const courseUpdateRes = await fetch(`${SUPABASE_URL}/rest/v1/courses?id=eq.${dbEq(course.id)}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ sessions_completed: completedCount }),
  });
  if (!courseUpdateRes.ok)
    await expectSupabase(courseUpdateRes, 'Could not update course progress');

  return jsonResponse({
    success: true,
    events_found: activeEvents.length,
    cancelled: cancelledEvents.length,
    completed: completedCount,
    scheduled: finalStatuses.filter((s) => s === 'scheduled').length,
    created: createdCount,
    updated: updatedCount,
    removed: removedCount,
    deduplicated: deduplicated.length,
    kept_cancelled: keptCancelledCount,
    blocked_sessions_moved: blockedApplied ? blockedApplied.excludedCount : 0,
    moved_onto_blocked_dates: blockedApplied ? blockedApplied.movedOntoBlockedDates : [],
    renamed_title: renamed?.title || null,
    renamed_events: renamed?.patched || 0,
  });
}, 'sync-calendar');
