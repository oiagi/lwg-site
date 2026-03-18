// functions/api/delete-enquiry.js
// DELETE /api/delete-enquiry
// Body: { id }
//
// Requires header: x-admin-password matching ADMIN_PASSWORD env var
// Permanently deletes an enquiry record from Supabase.
//
// Environment variables:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY, ADMIN_PASSWORD

import { supabaseHeaders, requireAdminAuth } from './_utils.js';

export async function onRequestDelete({ request, env }) {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;

  const authErr = requireAdminAuth(request, env);
  if (authErr) return authErr;

  // ── Parse body ───────────────────────────────────────────────────────
  let id;
  try {
    ({ id } = await request.json());
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing id' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── Delete from Supabase ─────────────────────────────────────────────
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/enquiries?id=eq.${id}`, {
      method:  'DELETE',
      headers: supabaseHeaders(SUPABASE_SERVICE_KEY),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Supabase error:', err);
      return new Response(JSON.stringify({ error: 'Database error' }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Fetch error:', err);
    return new Response(JSON.stringify({ error: 'Connection error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
