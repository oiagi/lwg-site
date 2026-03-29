// functions/api/update-student.js
// PATCH /api/update-student
// Body: { student_id, progress_notes?, current_level? }
//
// Updates a student's progress notes and/or current level.
// Called from the admin dashboard courses tab.
//
// Environment variables:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY, ADMIN_PASSWORD

import {
  supabaseHeaders,
  requireAdminAuth,
  jsonResponse,
  errorResponse,
  withErrorHandling,
} from './_utils.js';

export const onRequestPatch = withErrorHandling(async ({ request, env }) => {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;

  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  let student_id, progress_notes, current_level;
  try {
    ({ student_id, progress_notes, current_level } = await request.json());
  } catch {
    return errorResponse('Invalid JSON', 400);
  }

  if (!student_id) return errorResponse('Missing student_id', 400);

  const patch = {};
  if (progress_notes !== undefined) patch.progress_notes = progress_notes;
  if (current_level !== undefined) patch.current_level = current_level;

  if (!Object.keys(patch).length) return errorResponse('Nothing to update', 400);

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
