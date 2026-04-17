// functions/api/mark-invoice-paid.js
// PATCH /api/mark-invoice-paid
// Body: { invoice_id, paid?: boolean }
//
// Flips an invoice's status between 'paid' and 'issued'. Used from the
// student detail pane's outstanding-balance list.
//
// Environment variables:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY

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

  let invoice_id, paid;
  try {
    ({ invoice_id, paid = true } = await request.json());
  } catch {
    return errorResponse('Invalid JSON', 400);
  }

  if (!invoice_id) return errorResponse('Missing invoice_id', 400);

  const patch = {
    status: paid ? 'paid' : 'issued',
    paid_date: paid ? new Date().toISOString() : null,
  };

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/invoices?id=eq.${invoice_id}`, {
      method: 'PATCH',
      headers: { ...supabaseHeaders(SUPABASE_SERVICE_KEY), Prefer: 'return=representation' },
      body: JSON.stringify(patch),
    });

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
}, 'mark-invoice-paid');
