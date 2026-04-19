// functions/api/delete-student.js
// DELETE /api/delete-student?id=<uuid>
//
// Deletes a student and all records that reference them (attendance,
// enrolments, enquiries, invoices), then removes the student itself.
// The frontend confirms the destructive action before calling.
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

// Tables that reference students.id via student_id. Ordered so that any
// FK constraints with ON DELETE RESTRICT won't block the final delete.
const RELATED_TABLES = ['attendance', 'enrolments', 'enquiries', 'invoices'];

export const onRequestDelete = withErrorHandling(async ({ request, env }) => {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;

  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return errorResponse('Missing id', 400);

  const H = supabaseHeaders(SUPABASE_SERVICE_KEY);

  for (const table of RELATED_TABLES) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?student_id=eq.${id}`, {
      method: 'DELETE',
      headers: H,
    });
    if (!res.ok) {
      console.error(`Failed to delete related ${table}:`, await res.text());
      return errorResponse(`Could not delete student's ${table}`);
    }
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
