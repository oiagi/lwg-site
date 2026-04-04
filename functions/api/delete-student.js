// functions/api/delete-student.js
// DELETE /api/delete-student?id=<uuid>
//
// Permanently deletes a student record.

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
  if (!id) return errorResponse('Missing id parameter', 400);

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/students?id=eq.${id}`, {
      method: 'DELETE',
      headers: supabaseHeaders(SUPABASE_SERVICE_KEY),
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error('Student delete error:', txt);
      return errorResponse('Could not delete student. Remove linked records first.', 409);
    }

    return jsonResponse({ success: true });
  } catch (err) {
    console.error('Error:', err);
    return errorResponse('Connection error');
  }
}, 'delete-student');
