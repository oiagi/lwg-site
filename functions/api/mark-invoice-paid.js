// functions/api/mark-invoice-paid.js
// POST /api/mark-invoice-paid
// Body: { invoice_id }

import {
  supabaseHeaders,
  requireAdminAuth,
  jsonResponse,
  errorResponse,
  withErrorHandling,
  parseJsonBody,
} from './_utils.js';

export const onRequestPost = withErrorHandling(async ({ request, env }) => {
  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  const { body, error } = await parseJsonBody(request);
  if (error) return error;
  if (!body.invoice_id) return errorResponse('Missing invoice_id', 400);

  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/invoices?id=eq.${body.invoice_id}`, {
    method: 'PATCH',
    headers: {
      ...supabaseHeaders(env.SUPABASE_SERVICE_KEY),
      Prefer: 'return=representation',
    },
    body: JSON.stringify({ status: 'paid' }),
  });

  if (!res.ok) {
    console.error('mark-invoice-paid failed:', await res.text());
    return errorResponse('Could not mark invoice paid', 502);
  }

  const rows = await res.json().catch(() => []);
  return jsonResponse({ success: true, invoice: rows[0] || null });
}, 'mark-invoice-paid');
