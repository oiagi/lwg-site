// functions/update-enquiry.js
// PATCH /api/update-enquiry
// Body: { id, status?, notes?, student_id? }
//   student_id: uuid to link a student, or null to unlink
//
// Requires header: x-admin-password matching ADMIN_PASSWORD env var
// Updates the status and/or internal notes on an enquiry record.
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

  // ── Parse body ───────────────────────────────────────────────────────
  let id, status, notes, student_id;
  try {
    ({ id, status, notes, student_id } = await request.json());
  } catch {
    return errorResponse('Invalid JSON', 400);
  }

  if (!id) return errorResponse('Missing id', 400);

  // Build patch object — only include fields that were provided
  const patch = {};
  if (status !== undefined) patch.status = status;
  if (notes !== undefined) patch.notes = notes;
  if (student_id !== undefined) patch.student_id = student_id ?? null;

  if (Object.keys(patch).length === 0) return errorResponse('Nothing to update', 400);

  // ── Update in Supabase ───────────────────────────────────────────────
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/enquiries?id=eq.${id}`, {
      method: 'PATCH',
      headers: { ...supabaseHeaders(SUPABASE_SERVICE_KEY), Prefer: 'return=representation' },
      body: JSON.stringify(patch),
    });

    if (!res.ok) {
      console.error('Supabase error:', await res.text());
      return errorResponse('Database error');
    }

    const rows = await res.json();
    return jsonResponse(rows[0] || {});
  } catch (err) {
    console.error('Fetch error:', err);
    return errorResponse('Connection error');
  }
}, 'update-enquiry');
