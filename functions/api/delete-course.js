// functions/api/delete-course.js
// DELETE /api/delete-course
// Body: { course_id }
//
// Deletes a course entirely:
//   1. Cancels all upcoming Google Calendar events for the course
//   2. Deletes all session records from Supabase
//   3. Deletes all enrolment records
//   4. Deletes the course record
//   5. Unlinks the course from any enquiry (sets course_id to null)
//
// Environment variables:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY, ADMIN_PASSWORD,
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET

import {
  supabaseHeaders,
  requireAdminAuth,
  getValidAccessToken,
  jsonResponse,
  errorResponse,
  withErrorHandling,
} from './_utils.js';

export const onRequestDelete = withErrorHandling(async ({ request, env }) => {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;

  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  let course_id;
  try {
    ({ course_id } = await request.json());
  } catch (err) {
    console.error('Failed to parse delete-course request body:', err);
    return errorResponse('Invalid JSON', 400);
  }

  if (!course_id) return errorResponse('Missing course_id', 400);

  // ── Load course ───────────────────────────────────────────────────────
  const courseRes = await fetch(`${SUPABASE_URL}/rest/v1/courses?id=eq.${course_id}&select=*`, {
    headers: supabaseHeaders(SUPABASE_SERVICE_KEY),
  });
  const courses = await courseRes.json();
  if (!courses.length) return errorResponse('Course not found', 404);
  const course = courses[0];

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
        `${SUPABASE_URL}/rest/v1/teachers?id=eq.${course.teacher_id}&select=*`,
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
      // Non-fatal — continue with deletion
    }
  }

  // ── Unlink course from enquiry ────────────────────────────────────────
  if (course.enquiry_id) {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/enquiries?id=eq.${course.enquiry_id}`, {
        method: 'PATCH',
        headers: supabaseHeaders(SUPABASE_SERVICE_KEY),
        body: JSON.stringify({ course_id: null, status: 'contacted' }),
      });
    } catch (err) {
      console.error('Enquiry unlink error:', err);
    }
  }

  // ── Delete sessions, enrolments, and course (cascade handles sessions) ─
  // Enrolments reference course_id with ON DELETE CASCADE so they're
  // removed automatically. Sessions too. We just delete the course.
  const deleteRes = await fetch(`${SUPABASE_URL}/rest/v1/courses?id=eq.${course_id}`, {
    method: 'DELETE',
    headers: supabaseHeaders(SUPABASE_SERVICE_KEY),
  });

  if (!deleteRes.ok) return errorResponse('Could not delete course');

  return jsonResponse({ success: true });
}, 'delete-course');
