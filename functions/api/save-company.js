// functions/api/save-company.js
// POST /api/save-company
// Body: { id?, name, booking_code? }
//
// Creates a new company or updates an existing one.
// If `id` is provided, patches that record; otherwise inserts a new row.
//
// Environment variables:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY

import {
  supabaseHeaders,
  requireAdminAuth,
  jsonResponse,
  errorResponse,
  withErrorHandling,
  parseJsonBody,
} from './_utils.js';

export const onRequestPost = withErrorHandling(async ({ request, env }) => {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;

  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  const { body, error } = await parseJsonBody(request);
  if (error) return error;

  const name = (body.name || '').trim();
  if (!name) return errorResponse('Company name is required', 400);

  const data = { name };
  if (body.booking_code !== undefined) {
    data.booking_code = body.booking_code ? String(body.booking_code).trim() || null : null;
  }

  const H = { ...supabaseHeaders(SUPABASE_SERVICE_KEY), Prefer: 'return=representation' };

  try {
    let res;
    if (body.id) {
      res = await fetch(`${SUPABASE_URL}/rest/v1/companies?id=eq.${body.id}`, {
        method: 'PATCH',
        headers: H,
        body: JSON.stringify(data),
      });
    } else {
      res = await fetch(`${SUPABASE_URL}/rest/v1/companies`, {
        method: 'POST',
        headers: H,
        body: JSON.stringify(data),
      });
    }

    if (!res.ok) {
      console.error('Company save error:', await res.text());
      return errorResponse('Database error');
    }

    const rows = await res.json();
    return jsonResponse(rows[0] || {});
  } catch (err) {
    console.error('Error:', err);
    return errorResponse('Connection error');
  }
}, 'save-company');
