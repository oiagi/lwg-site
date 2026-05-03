// functions/api/update-student.js
// PATCH /api/update-student
// Body: { student_id, progress_notes?, current_level? }
//
// Updates a student's progress notes and/or current level.
// Called from the admin dashboard courses tab.
//
// Environment variables:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY, SUPABASE_ANON_KEY

import {
  supabaseHeaders,
  requireAdminAuth,
  jsonResponse,
  errorResponse,
  withErrorHandling,
  parseJsonBody,
  pickDefined,
  hasFields,
} from './_utils.js';

const ALLOWED_FIELDS = ['progress_notes', 'current_level'];

export const onRequestPatch = withErrorHandling(async ({ request, env }) => {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;

  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  const { body, error } = await parseJsonBody(request);
  if (error) return error;

  const { student_id } = body;
  if (!student_id) return errorResponse('Missing student_id', 400);

  const patch = pickDefined(body, ALLOWED_FIELDS);
  if (!hasFields(patch)) return errorResponse('Nothing to update', 400);

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/students?id=eq.${student_id}`, {
      method: 'PATCH',
      headers: { ...supabaseHeaders(SUPABASE_SERVICE_KEY), Prefer: 'return=representation' },
      body: JSON.stringify(patch),
    });

    if (!res.ok) return errorResponse('Database error');

    const rows = await res.json();
    return jsonResponse(rows[0] || {});
  } catch (err) {
    console.error('Error:', err);
    return errorResponse('Connection error');
  }
}, 'update-student');
