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
import { fetchCourseEvents } from './_calendar.js';

export const onRequestPost = withErrorHandling(async ({ request, env }) => {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;

  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  const { body, error } = await parseJsonBody(request);
  if (error) return error;

  const { course_id } = body;
  if (!course_id) return errorResponse('Missing course_id', 400);

  // ── Load course ──────────────────────────────────────────────────────
  const cr = await fetch(`${SUPABASE_URL}/rest/v1/courses?id=eq.${course_id}&select=*`, {
    headers: supabaseHeaders(SUPABASE_SERVICE_KEY),
  });
  const courses = await cr.json();
  if (!courses.length) return errorResponse('Course not found', 404);
  const course = courses[0];

  // ── Load teacher ─────────────────────────────────────────────────────
  const tr = await fetch(`${SUPABASE_URL}/rest/v1/teachers?id=eq.${course.teacher_id}&select=*`, {
    headers: supabaseHeaders(SUPABASE_SERVICE_KEY),
  });
  const teachers = await tr.json();
  if (!teachers.length || !teachers[0].refresh_token) {
    return errorResponse('Teacher not found or not authorised', 400);
  }
  const teacher = teachers[0];

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
    return errorResponse(err.message || 'Calendar API error');
  }
  const activeEventIds = new Set(activeEvents.map((e) => e.id));

  // ── Upsert active session records ────────────────────────────────────
  const now = new Date();
  let completedCount = 0;

  for (const event of activeEvents) {
    const scheduledAt = event.start.dateTime || event.start.date;
    const isPast = new Date(scheduledAt) < now;
    const status = isPast ? 'completed' : 'scheduled';
    if (isPast) completedCount++;

    const existRes = await fetch(
      `${SUPABASE_URL}/rest/v1/sessions?calendar_event_id=eq.${event.id}&select=id,status`,
      { headers: supabaseHeaders(SUPABASE_SERVICE_KEY) }
    );
    const existing = await existRes.json();

    if (existing.length) {
      await fetch(`${SUPABASE_URL}/rest/v1/sessions?id=eq.${existing[0].id}`, {
        method: 'PATCH',
        headers: supabaseHeaders(SUPABASE_SERVICE_KEY),
        body: JSON.stringify({ scheduled_at: scheduledAt, status }),
      });
    } else {
      await fetch(`${SUPABASE_URL}/rest/v1/sessions`, {
        method: 'POST',
        headers: supabaseHeaders(SUPABASE_SERVICE_KEY),
        body: JSON.stringify({
          course_id: course.id,
          teacher_id: course.teacher_id,
          scheduled_at: scheduledAt,
          duration_minutes: 50,
          status,
          calendar_event_id: event.id,
        }),
      });
    }
  }

  // ── Remove sessions no longer in Google Calendar ─────────────────────
  // Fetch all session records for this course from Supabase, then delete
  // any whose calendar_event_id is not in the active events from Google.
  // This covers both explicitly cancelled and silently deleted events.
  const allDbRes = await fetch(
    `${SUPABASE_URL}/rest/v1/sessions?course_id=eq.${course.id}&select=id,calendar_event_id`,
    { headers: supabaseHeaders(SUPABASE_SERVICE_KEY) }
  );
  const allDbSessions = await allDbRes.json();
  for (const sess of allDbSessions) {
    if (!sess.calendar_event_id || !activeEventIds.has(sess.calendar_event_id)) {
      await fetch(`${SUPABASE_URL}/rest/v1/sessions?id=eq.${sess.id}`, {
        method: 'DELETE',
        headers: supabaseHeaders(SUPABASE_SERVICE_KEY),
      });
    }
  }

  // ── Update sessions_completed count on course ─────────────────────────
  await fetch(`${SUPABASE_URL}/rest/v1/courses?id=eq.${course.id}`, {
    method: 'PATCH',
    headers: supabaseHeaders(SUPABASE_SERVICE_KEY),
    body: JSON.stringify({ sessions_completed: completedCount }),
  });

  return jsonResponse({
    success: true,
    events_found: activeEvents.length,
    cancelled: cancelledEvents.length,
    completed: completedCount,
    scheduled: activeEvents.length - completedCount,
  });
}, 'sync-calendar');
