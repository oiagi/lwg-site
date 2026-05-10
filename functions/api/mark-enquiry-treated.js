// functions/api/mark-enquiry-treated.js
// POST /api/mark-enquiry-treated
// Body: { enquiry_id, student_id? }
//
// Admin-only endpoint for closing ordinary enquiry flags without enrolling
// the student in a course. Direct public course booking requests remain on
// /api/handle-course-booking because they affect course capacity.

import {
  supabaseHeaders,
  requireAdminAuth,
  jsonResponse,
  errorResponse,
  withErrorHandling,
  parseJsonBody,
} from './_utils.js';

function cleanString(value, max = 120) {
  if (value === null || value === undefined) return null;
  const cleaned = String(value).replace(/\s+/g, ' ').trim();
  return cleaned ? cleaned.slice(0, max) : null;
}

export const onRequestPost = withErrorHandling(async ({ request, env }) => {
  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  const { body, error } = await parseJsonBody(request);
  if (error) return error;

  const enquiryId = cleanString(body.enquiry_id, 80);
  const studentId = cleanString(body.student_id, 80);
  if (!enquiryId) return errorResponse('Missing enquiry_id', 400);

  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;
  const H = supabaseHeaders(SUPABASE_SERVICE_KEY);

  const filters = [`id=eq.${encodeURIComponent(enquiryId)}`];
  if (studentId) filters.push(`student_id=eq.${encodeURIComponent(studentId)}`);

  const enquiryRes = await fetch(
    `${SUPABASE_URL}/rest/v1/enquiries?${filters.join('&')}&select=id,status,student_id`,
    { headers: H }
  );
  if (!enquiryRes.ok) return errorResponse('Database error');

  const enquiries = await enquiryRes.json();
  const enquiry = enquiries[0];
  if (!enquiry) return errorResponse('Enquiry not found', 404);
  if (enquiry.status === 'pending_course_booking') {
    return errorResponse('Use booking approval or decline for course booking requests', 409);
  }
  if (enquiry.status !== 'new') {
    return jsonResponse({ success: true, status: enquiry.status, already_treated: true });
  }

  const updateRes = await fetch(
    `${SUPABASE_URL}/rest/v1/enquiries?id=eq.${encodeURIComponent(enquiryId)}`,
    {
      method: 'PATCH',
      headers: { ...H, Prefer: 'return=representation' },
      body: JSON.stringify({ status: 'confirmed' }),
    }
  );
  if (!updateRes.ok) return errorResponse('Could not mark enquiry treated');

  const rows = await updateRes.json().catch(() => []);
  return jsonResponse({ success: true, status: rows[0]?.status || 'confirmed' });
}, 'mark-enquiry-treated');
