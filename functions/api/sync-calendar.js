// functions/api/sync-calendar.js
// POST /api/sync-calendar
// Body: { course_id }
//
// On-demand Google Calendar sync for a course.
// Called when opening a course in the admin dashboard to get fresh
// session data without relying on webhooks (which expire and can miss
// notifications). Fetches all calendar events matching the course code,
// upserts session records in Supabase, and updates sessions_completed.
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
import { fetchCourseEvents, applyBlockedDatesToSeries } from './_calendar.js';
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
  let activeEvents, cancelledEvents;
  try {
    ({ active: activeEvents, cancelled: cancelledEvents } = await fetchCourseEvents({
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
      if (blockedApplied) {
        ({ active: activeEvents, cancelled: cancelledEvents } = await fetchCourseEvents({
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

  const activeEventIds = new Set(activeEvents.map((e) => e.id));

  // ── Load existing session records once ────────────────────────────────
  const allDbRes = await fetch(
    `${SUPABASE_URL}/rest/v1/sessions?course_id=eq.${dbEq(course.id)}&select=id,calendar_event_id,status`,
    { headers }
  );
  const allDbSessions = await expectSupabase(allDbRes, 'Could not load course sessions');
  const sessionsByCalendarId = new Map(
    allDbSessions.filter((s) => s.calendar_event_id).map((s) => [s.calendar_event_id, s])
  );

  // ── Upsert active session records ────────────────────────────────────
  const now = new Date();
  let completedCount = 0;
  let updatedCount = 0;
  let createdCount = 0;
  let removedCount = 0;

  for (const event of activeEvents) {
    const scheduledAt = event.start.dateTime || event.start.date;
    const endAt = event.end?.dateTime || event.end?.date;
    const durationMinutes =
      scheduledAt && endAt ? Math.round((new Date(endAt) - new Date(scheduledAt)) / 60000) : 50;
    const isPast = new Date(scheduledAt) < now;
    const status = isPast ? 'completed' : 'scheduled';
    if (isPast) completedCount++;

    const existing = sessionsByCalendarId.get(event.id);

    if (existing) {
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
      createdCount++;
    }
  }

  // ── Remove sessions no longer in Google Calendar ─────────────────────
  // Delete synced sessions whose calendar event disappeared from Google.
  // This covers both explicitly cancelled and silently deleted events.
  for (const sess of allDbSessions) {
    if (sess.calendar_event_id && !activeEventIds.has(sess.calendar_event_id)) {
      const deleteRes = await fetch(`${SUPABASE_URL}/rest/v1/sessions?id=eq.${dbEq(sess.id)}`, {
        method: 'DELETE',
        headers,
      });
      if (!deleteRes.ok) await expectSupabase(deleteRes, 'Could not remove stale synced session');
      removedCount++;
    }
  }

  // ── Update sessions_completed count on course ─────────────────────────
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
    scheduled: activeEvents.length - completedCount,
    created: createdCount,
    updated: updatedCount,
    removed: removedCount,
    blocked_sessions_moved: blockedApplied ? blockedApplied.excludedCount : 0,
  });
}, 'sync-calendar');
