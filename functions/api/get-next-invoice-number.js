// functions/api/get-next-invoice-number.js
// GET /api/get-next-invoice-number
//
// Returns the next yearly sequential invoice number, e.g. LWG-2026-0001.

import {
  supabaseHeaders,
  requireAdminAuth,
  jsonResponse,
  errorResponse,
  withErrorHandling,
} from './_utils.js';

const INVOICE_PREFIX = 'LWG';

function currentYear() {
  return new Date().getFullYear();
}

function parseYearlySequence(invoiceNumber, year) {
  const match = String(invoiceNumber || '').match(/^LWG-(\d{4})-(\d{4})$/);
  if (!match || Number(match[1]) !== year) return 0;
  return Number(match[2]) || 0;
}

export const onRequestGet = withErrorHandling(async ({ request, env }) => {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;

  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  const url = new URL(request.url);
  const requestedYear = Number(url.searchParams.get('year'));
  const year =
    Number.isInteger(requestedYear) && requestedYear >= 2000 && requestedYear <= 2100
      ? requestedYear
      : currentYear();

  const pattern = encodeURIComponent(`${INVOICE_PREFIX}-${year}-*`);
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/invoices?invoice_number=ilike.${pattern}&select=invoice_number&order=invoice_number.desc&limit=100`,
    { headers: supabaseHeaders(SUPABASE_SERVICE_KEY) }
  );

  if (!res.ok) return errorResponse('Could not load invoice numbers', 502);

  const rows = await res.json();
  const maxSeq = rows.reduce(
    (max, row) => Math.max(max, parseYearlySequence(row.invoice_number, year)),
    0
  );
  const next = String(maxSeq + 1).padStart(4, '0');

  return jsonResponse({
    invoice_number: `${INVOICE_PREFIX}-${year}-${next}`,
    year,
    sequence: maxSeq + 1,
  });
}, 'get-next-invoice-number');
