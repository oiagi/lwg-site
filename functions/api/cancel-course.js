// functions/api/cancel-course.js
// PATCH /api/cancel-course
// Body: { course_id }
//
// Soft-cancels a course:
//   1. Cancels all upcoming Google Calendar events for the course
//   2. Marks all scheduled sessions as 'cancelled' in Supabase
//   3. Sets the course status to 'cancelled'
//
// Environment variables:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY,
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

const COURSE_FIELDS = 'id,teacher_id,status';
const TEACHER_FIELDS = 'id,calendar_id,refresh_token,access_token,token_expiry';

export const onRequestPatch = withErrorHandling(async ({ request, env }) => {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;

  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  const { body, error } = await parseJsonBody(request);
  if (error) return error;

  const { course_id } = body;
  if (!course_id) return errorResponse('Missing course_id', 400);

  // ── Load course ───────────────────────────────────────────────────────
  const courseRes = await fetch(
    `${SUPABASE_URL}/rest/v1/courses?id=eq.${course_id}&select=${COURSE_FIELDS}`,
    {
      headers: supabaseHeaders(SUPABASE_SERVICE_KEY),
    }
  );
  const courses = await courseRes.json();
  if (!courses.length) return errorResponse('Course not found', 404);
  const course = courses[0];

  if (course.status === 'cancelled') return errorResponse('Course is already cancelled', 400);

  // ── Load sessions ─────────────────────────────────────────────────────
  const sessRes = await fetch(
    `${SUPABASE_URL}/rest/v1/sessions?course_id=eq.${course_id}&select=id,calendar_event_id,status`,
    { headers: supabaseHeaders(SUPABASE_SERVICE_KEY) }
  );
  const sessions = await sessRes.json();

  // ── Cancel calendar events for all upcoming sessions ──────────────────
  const upcomingSessions = sessions.filter((s) => s.status === 'scheduled' && s.calendar_event_id);

  if (upcomingSessions.length && course.teacher_id) {
    try {
      const teacherRes = await fetch(
        `${SUPABASE_URL}/rest/v1/teachers?id=eq.${course.teacher_id}&select=${TEACHER_FIELDS}`,
        { headers: supabaseHeaders(SUPABASE_SERVICE_KEY) }
      );
      const teachers = await teacherRes.json();
      if (teachers.length && teachers[0].refresh_token) {
        const accessToken = await getValidAccessToken(teachers[0], env);
        for (const sess of upcomingSessions) {
          try {
            await fetch(
              `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(teachers[0].calendar_id)}/events/${sess.calendar_event_id}`,
              {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${accessToken}` },
              }
            );
          } catch (err) {
            console.error(`Failed to cancel event ${sess.calendar_event_id}:`, err);
          }
        }
      }
    } catch (err) {
      console.error('Calendar cancellation error:', err);
      // Non-fatal — continue with cancellation
    }
  }

  // ── Mark scheduled sessions as cancelled ──────────────────────────────
  if (upcomingSessions.length) {
    await fetch(`${SUPABASE_URL}/rest/v1/sessions?course_id=eq.${course_id}&status=eq.scheduled`, {
      method: 'PATCH',
      headers: supabaseHeaders(SUPABASE_SERVICE_KEY),
      body: JSON.stringify({ status: 'cancelled' }),
    });
  }

  // ── Set course status to cancelled ────────────────────────────────────
  const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/courses?id=eq.${course_id}`, {
    method: 'PATCH',
    headers: {
      ...supabaseHeaders(SUPABASE_SERVICE_KEY),
      Prefer: 'return=representation',
    },
    body: JSON.stringify({ status: 'cancelled' }),
  });

  if (!updateRes.ok) return errorResponse('Could not cancel course');

  return jsonResponse({ success: true });
}, 'cancel-course');
