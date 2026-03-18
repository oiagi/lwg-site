// functions/update-enquiry.js
// PATCH /api/update-enquiry
// Body: { id, status?, notes? }
//
// Requires header: x-admin-password matching ADMIN_PASSWORD env var
// Updates the status and/or internal notes on an enquiry record.
//
// Environment variables:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY, ADMIN_PASSWORD

import { supabaseHeaders, requireAdminAuth } from './_utils.js';

export async function onRequestPatch({ request, env }) {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;

  const authErr = requireAdminAuth(request, env);
  if (authErr) return authErr;

  // ── Parse body ───────────────────────────────────────────────────────
  let id, status, notes;
  try {
    ({ id, status, notes } = await request.json());
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

  // Build patch object — only include fields that were provided
  const patch = {};
  if (status !== undefined) patch.status = status;
  if (notes  !== undefined) patch.notes  = notes;

  if (Object.keys(patch).length === 0) {
    return new Response(JSON.stringify({ error: 'Nothing to update' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── Update in Supabase ───────────────────────────────────────────────
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/enquiries?id=eq.${id}`, {
      method:  'PATCH',
      headers: { ...supabaseHeaders(SUPABASE_SERVICE_KEY), 'Prefer': 'return=representation' },
      body:    JSON.stringify(patch),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Supabase error:', err);
      return new Response(JSON.stringify({ error: 'Database error' }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      });
    }

    const rows = await res.json();
    return new Response(JSON.stringify(rows[0] || {}), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Fetch error:', err);
    return new Response(JSON.stringify({ error: 'Connection error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
