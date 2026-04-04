// functions/api/delete-student.js
// DELETE /api/delete-student?id=<uuid>
//
// Deletes a student record. Blocked with 409 if the student has any linked
// enrolments, enquiries, or invoices — caller should deactivate instead.
//
// Environment variables:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY

import {
  supabaseHeaders,
  requireAdminAuth,
  jsonResponse,
  errorResponse,
  withErrorHandling,
} from './_utils.js';

export const onRequestDelete = withErrorHandling(async ({ request, env }) => {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;

  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return errorResponse('Missing id', 400);

  const H = supabaseHeaders(SUPABASE_SERVICE_KEY);

  // Check for related records in parallel
  const [enrolRes, enquiryRes, invoiceRes] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/enrolments?student_id=eq.${id}&select=id`, { headers: H }),
    fetch(`${SUPABASE_URL}/rest/v1/enquiries?student_id=eq.${id}&select=id`, { headers: H }),
    fetch(`${SUPABASE_URL}/rest/v1/invoices?student_id=eq.${id}&select=id`, { headers: H }),
  ]);

  const [enrolments, enquiries, invoices] = await Promise.all([
    enrolRes.ok ? enrolRes.json() : [],
    enquiryRes.ok ? enquiryRes.json() : [],
    invoiceRes.ok ? invoiceRes.json() : [],
  ]);

  const counts = {
    courses: enrolments.length,
    enquiries: enquiries.length,
    invoices: invoices.length,
  };

  if (counts.courses > 0 || counts.enquiries > 0 || counts.invoices > 0) {
    return jsonResponse(
      {
        error: 'Cannot delete: student has linked records. Deactivate instead.',
        counts,
      },
      409
    );
  }

  const delRes = await fetch(`${SUPABASE_URL}/rest/v1/students?id=eq.${id}`, {
    method: 'DELETE',
    headers: H,
  });

  if (!delRes.ok) {
    console.error('Delete student error:', await delRes.text());
    return errorResponse('Database error');
  }

  return jsonResponse({ success: true });
}, 'delete-student');
