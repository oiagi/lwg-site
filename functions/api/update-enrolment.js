// functions/api/update-enrolment.js
// PATCH /api/update-enrolment
// Body: { course_id, student_id, invoice_lesson_count?, joined_at? }
//
// Updates course-specific student settings stored on the enrolment row.

import {
  supabaseHeaders,
  requireAdminAuth,
  jsonResponse,
  errorResponse,
  withErrorHandling,
  parseJsonBody,
  hasFields,
} from './_utils.js';

function cleanDate(value) {
  if (value === null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(value + 'T12:00:00Z');
  return Number.isNaN(date.getTime()) ? undefined : value;
}

function cleanLessonCount(value) {
  if (value === null || value === '') return null;
  const count = Number(value);
  if (!Number.isInteger(count) || count <= 0) return undefined;
  return count;
}

export const onRequestPatch = withErrorHandling(async ({ request, env }) => {
  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  const { body, error } = await parseJsonBody(request);
  if (error) return error;

  const courseId = body.course_id;
  const studentId = body.student_id;
  if (!courseId || !studentId) return errorResponse('course_id and student_id required', 400);

  const patch = {};
  if ('invoice_lesson_count' in body) {
    const count = cleanLessonCount(body.invoice_lesson_count);
    if (count === undefined) return errorResponse('invoice_lesson_count must be positive', 400);
    patch.invoice_lesson_count = count;
  }
  if ('joined_at' in body) {
    const joinedAt = cleanDate(body.joined_at);
    if (joinedAt === undefined) return errorResponse('joined_at must use YYYY-MM-DD', 400);
    patch.joined_at = joinedAt;
  }

  if (!hasFields(patch)) return errorResponse('Nothing to update', 400);

  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/enrolments?course_id=eq.${encodeURIComponent(courseId)}&student_id=eq.${encodeURIComponent(studentId)}`,
    {
      method: 'PATCH',
      headers: { ...supabaseHeaders(SUPABASE_SERVICE_KEY), Prefer: 'return=representation' },
      body: JSON.stringify(patch),
    }
  );

  if (!res.ok) {
    console.error('update-enrolment error:', await res.text());
    return errorResponse('Database error');
  }

  const rows = await res.json();
  if (!rows.length) return errorResponse('Enrolment not found', 404);
  return jsonResponse(rows[0]);
}, 'update-enrolment');
