// functions/api/remove-enrollment.js
// DELETE /api/remove-enrollment
// Body: { course_id, student_id }
//
// Removes one student from one course. Attendance rows for that student's
// sessions in this course are cleaned up; invoices/certificates are retained.

import {
  withErrorHandling,
  requireAdminAuth,
  supabaseHeaders,
  jsonResponse,
  errorResponse,
  parseJsonBody,
} from './_utils.js';

function eq(value) {
  return encodeURIComponent(value);
}

export const onRequestDelete = withErrorHandling(async ({ request, env }) => {
  const authError = await requireAdminAuth(request, env);
  if (authError) return authError;

  const { body, error } = await parseJsonBody(request);
  if (error) return error;

  const { course_id, student_id } = body;
  if (!course_id || !student_id) return errorResponse('course_id and student_id required', 400);

  const H = supabaseHeaders(env.SUPABASE_SERVICE_KEY);
  const { SUPABASE_URL } = env;

  const enrolmentRes = await fetch(
    `${SUPABASE_URL}/rest/v1/enrolments?course_id=eq.${eq(course_id)}&student_id=eq.${eq(student_id)}&select=course_id,student_id`,
    { headers: H }
  );
  if (!enrolmentRes.ok) return errorResponse('Could not verify enrolment');
  const enrolments = await enrolmentRes.json();
  if (!enrolments.length) return errorResponse('Enrolment not found', 404);

  const sessionsRes = await fetch(
    `${SUPABASE_URL}/rest/v1/sessions?course_id=eq.${eq(course_id)}&select=id`,
    { headers: H }
  );
  if (!sessionsRes.ok) return errorResponse('Could not load course sessions');
  const sessions = await sessionsRes.json();

  for (const session of sessions) {
    const attendanceRes = await fetch(
      `${SUPABASE_URL}/rest/v1/attendance?session_id=eq.${eq(session.id)}&student_id=eq.${eq(student_id)}`,
      { method: 'DELETE', headers: H }
    );
    if (!attendanceRes.ok) return errorResponse('Could not remove attendance records');
  }

  const deleteRes = await fetch(
    `${SUPABASE_URL}/rest/v1/enrolments?course_id=eq.${eq(course_id)}&student_id=eq.${eq(student_id)}`,
    { method: 'DELETE', headers: H }
  );
  if (!deleteRes.ok) return errorResponse('Could not remove enrolment');

  return jsonResponse({ success: true, course_id, student_id });
}, 'remove-enrollment');
