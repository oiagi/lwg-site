// functions/api/delete-enquiry.js
// DELETE /api/delete-enquiry
// Body: { id }
//
// Requires header: x-admin-password matching ADMIN_PASSWORD env var
// Permanently deletes an enquiry record from Supabase.
//
// Environment variables:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY, ADMIN_PASSWORD

import { supabaseHeaders, requireAdminAuth, jsonResponse, errorResponse } from './_utils.js';

export async function onRequestDelete({ request, env }) {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;

  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  // ── Parse body ───────────────────────────────────────────────────────
  let id;
  try {
    ({ id } = await request.json());
  } catch {
    return errorResponse('Invalid JSON', 400);
  }

  if (!id) return errorResponse('Missing id', 400);

  // ── Delete from Supabase ─────────────────────────────────────────────
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/enquiries?id=eq.${id}`, {
      method: 'DELETE',
      headers: supabaseHeaders(SUPABASE_SERVICE_KEY),
    });

    if (!res.ok) {
      console.error('Supabase error:', await res.text());
      return errorResponse('Database error');
    }

    return jsonResponse({ success: true });
  } catch (err) {
    console.error('Fetch error:', err);
    return errorResponse('Connection error');
  }
}
