// functions/api/add-enrolment.js
// Add an existing or new student to an existing course.
// Creates a student record (as prospect) if no student_id is provided.

import {
  withErrorHandling,
  requireAdminAuth,
  supabaseHeaders,
  jsonResponse,
  errorResponse,
  parseJsonBody,
} from './_utils.js';
import {
  completeEnquiriesForEnrolment,
  findOrCreateStudent,
  setStudentStatus,
} from './_student-utils.js';

function cleanDate(value) {
  if (!value) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(value + 'T12:00:00Z');
  return Number.isNaN(date.getTime()) ? undefined : value;
}

function zurichDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Zurich',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

export const onRequestPost = withErrorHandling(async ({ request, env }) => {
  const authError = await requireAdminAuth(request, env);
  if (authError) return authError;

  const { body, error } = await parseJsonBody(request);
  if (error) return error;

  const { course_id, student_id, first_name, last_name, email, phone } = body;
  if (!course_id) return errorResponse('course_id required', 400);
  if (!student_id && !email && !first_name) {
    return errorResponse('Provide student_id, or email, or first name', 400);
  }
  const joinedAt = body.joined_at ? cleanDate(body.joined_at) : zurichDate();
  if (joinedAt === undefined) return errorResponse('joined_at must use YYYY-MM-DD', 400);

  const H = supabaseHeaders(env.SUPABASE_SERVICE_KEY);
  const { SUPABASE_URL } = env;

  // Verify course exists
  const courseRes = await fetch(
    `${SUPABASE_URL}/rest/v1/courses?id=eq.${encodeURIComponent(course_id)}&select=id`,
    { headers: H }
  );
  const courses = await courseRes.json();
  if (!Array.isArray(courses) || !courses.length) return errorResponse('Course not found', 404);

  // Find or create student
  let sid = student_id;
  if (!sid) {
    sid = await findOrCreateStudent(SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
      first_name,
      last_name,
      email,
      phone,
      source: 'manual',
    });
  }

  // Upsert enrolment — ignore duplicate so the endpoint is idempotent
  const enrolRes = await fetch(`${SUPABASE_URL}/rest/v1/enrolments`, {
    method: 'POST',
    headers: { ...H, Prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify({ student_id: sid, course_id, joined_at: joinedAt }),
  });
  if (!enrolRes.ok) {
    const txt = await enrolRes.text();
    throw new Error(`Enrolment failed: ${txt}`);
  }

  await setStudentStatus(SUPABASE_URL, env.SUPABASE_SERVICE_KEY, sid, 'active');
  const completed_enquiries = await completeEnquiriesForEnrolment(
    SUPABASE_URL,
    env.SUPABASE_SERVICE_KEY,
    sid,
    course_id
  );

  return jsonResponse({ student_id: sid, enrolled: true, completed_enquiries });
});
