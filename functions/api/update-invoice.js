// functions/api/update-invoice.js
// PATCH /api/update-invoice
// Body: { id, status?, notes?, paid_at? }
//
// Updates invoice status and metadata.
//
// Environment variables:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY, ADMIN_PASSWORD

import { supabaseHeaders, requireAdminAuth, jsonResponse, errorResponse } from './_utils.js';

export async function onRequestPatch({ request, env }) {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;

  const authErr = requireAdminAuth(request, env);
  if (authErr) return authErr;

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON', 400);
  }

  if (!body.id) return errorResponse('Missing id', 400);

  const allowed = ['status', 'notes', 'paid_at'];
  const patch = {};
  for (const key of allowed) {
    if (body[key] !== undefined) patch[key] = body[key];
  }

  // Auto-set paid_at when marking as paid
  if (patch.status === 'paid' && !patch.paid_at) {
    patch.paid_at = new Date().toISOString();
  }

  if (!Object.keys(patch).length) return errorResponse('No fields to update', 400);

  const H = { ...supabaseHeaders(SUPABASE_SERVICE_KEY), 'Prefer': 'return=representation' };

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/invoices?id=eq.${body.id}`,
      { method: 'PATCH', headers: H, body: JSON.stringify(patch) }
    );
    if (!res.ok) {
      console.error('Invoice update error:', await res.text());
      return errorResponse('Database error');
    }
    const rows = await res.json();
    return jsonResponse(rows[0] || {});
  } catch (err) {
    console.error('Error:', err);
    return errorResponse('Connection error');
  }
}
