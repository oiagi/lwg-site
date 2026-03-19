// functions/api/save-company.js
// POST /api/save-company
// Body: { id?, name, contact_name?, contact_email?, contact_phone?,
//         billing_address?, billing_email?, vat_number?,
//         rate_per_session?, currency?, notes?, active? }
//
// Creates a new company or updates an existing one.
// If `id` is provided, the record is patched; otherwise a new row is inserted.
//
// Environment variables:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY, ADMIN_PASSWORD

import { supabaseHeaders, requireAdminAuth } from './_utils.js';

export async function onRequestPost({ request, env }) {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;

  const authErr = requireAdminAuth(request, env);
  if (authErr) return authErr;

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!body.name) {
    return new Response(JSON.stringify({ error: 'Company name is required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const H = { ...supabaseHeaders(SUPABASE_SERVICE_KEY), 'Prefer': 'return=representation' };

  // Fields allowed in the payload
  const fields = [
    'name', 'contact_name', 'contact_email', 'contact_phone',
    'billing_address', 'billing_email', 'vat_number',
    'rate_per_session', 'currency', 'notes', 'active',
  ];
  const data = {};
  for (const f of fields) {
    if (body[f] !== undefined) data[f] = body[f];
  }

  try {
    let res;
    if (body.id) {
      // ── Update existing company ──────────────────────────────────────
      res = await fetch(
        `${SUPABASE_URL}/rest/v1/companies?id=eq.${body.id}`,
        { method: 'PATCH', headers: H, body: JSON.stringify(data) }
      );
    } else {
      // ── Create new company ───────────────────────────────────────────
      res = await fetch(
        `${SUPABASE_URL}/rest/v1/companies`,
        { method: 'POST', headers: H, body: JSON.stringify(data) }
      );
    }

    if (!res.ok) {
      const err = await res.text();
      console.error('Company save error:', err);
      return new Response(JSON.stringify({ error: 'Database error' }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      });
    }

    const rows = await res.json();
    return new Response(JSON.stringify(rows[0] || {}), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Error:', err);
    return new Response(JSON.stringify({ error: 'Connection error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
