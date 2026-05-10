// functions/api/cancel-session.js
// DELETE /api/cancel-session
// Body: { session_id }
//
// Cancels a session by:
//   1. Loading the session and its course/teacher from Supabase
//   2. Cancelling the Google Calendar event (sends cancellation to attendees)
//   3. Deleting the session record from Supabase
//   4. Adjusting sessions_completed count if the session was already logged
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

const SESSION_FIELDS = 'id,course_id,status,calendar_event_id';
const COURSE_FIELDS = 'id,teacher_id,sessions_completed';
const TEACHER_FIELDS = 'id,calendar_id,refresh_token,access_token,token_expiry';

export const onRequestDelete = withErrorHandling(async ({ request, env }) => {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;

  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  const { body, error } = await parseJsonBody(request);
  if (error) return error;

  const { session_id } = body;
  if (!session_id) return errorResponse('Missing session_id', 400);

  // ── Load session ──────────────────────────────────────────────────────
  const sessRes = await fetch(
    `${SUPABASE_URL}/rest/v1/sessions?id=eq.${session_id}&select=${SESSION_FIELDS}`,
    {
      headers: supabaseHeaders(SUPABASE_SERVICE_KEY),
    }
  );
  const sessions = await sessRes.json();
  if (!sessions.length) return errorResponse('Session not found', 404);
  const session = sessions[0];

  // ── Load course ───────────────────────────────────────────────────────
  const courseRes = await fetch(
    `${SUPABASE_URL}/rest/v1/courses?id=eq.${session.course_id}&select=${COURSE_FIELDS}`,
    { headers: supabaseHeaders(SUPABASE_SERVICE_KEY) }
  );
  const courses = await courseRes.json();
  if (!courses.length) return errorResponse('Course not found', 404);
  const course = courses[0];

  // ── Load teacher ──────────────────────────────────────────────────────
  const teacherRes = await fetch(
    `${SUPABASE_URL}/rest/v1/teachers?id=eq.${course.teacher_id}&select=${TEACHER_FIELDS}`,
    { headers: supabaseHeaders(SUPABASE_SERVICE_KEY) }
  );
  const teachers = await teacherRes.json();
  if (!teachers.length || !teachers[0].refresh_token) {
    return errorResponse('Teacher not found or not authorised', 400);
  }
  const teacher = teachers[0];

  // ── Cancel Google Calendar event ──────────────────────────────────────
  if (session.calendar_event_id) {
    try {
      const accessToken = await getValidAccessToken(teacher, env);
      const cancelRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(teacher.calendar_id)}/events/${session.calendar_event_id}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      // 204 = deleted, 410 = already gone — both acceptable
      if (!cancelRes.ok && cancelRes.status !== 410) {
        console.error('Calendar cancellation failed:', cancelRes.status, await cancelRes.text());
        // Non-fatal — still remove from Supabase
      }
    } catch (err) {
      console.error('Calendar API error:', err);
      // Non-fatal — still remove from Supabase
    }
  }

  // ── Delete session record from Supabase ───────────────────────────────
  await fetch(`${SUPABASE_URL}/rest/v1/sessions?id=eq.${session_id}`, {
    method: 'DELETE',
    headers: supabaseHeaders(SUPABASE_SERVICE_KEY),
  });

  // ── Adjust sessions_completed if this session was already logged ───────
  if (session.status === 'completed') {
    try {
      const newCount = Math.max(0, (course.sessions_completed || 1) - 1);
      await fetch(`${SUPABASE_URL}/rest/v1/courses?id=eq.${course.id}`, {
        method: 'PATCH',
        headers: supabaseHeaders(SUPABASE_SERVICE_KEY),
        body: JSON.stringify({ sessions_completed: newCount }),
      });
    } catch (err) {
      console.error('Course count update error:', err);
    }
  }

  return jsonResponse({ success: true });
}, 'cancel-session');
