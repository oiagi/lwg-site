// functions/api/delete-invoice.js
// DELETE /api/delete-invoice?invoice_number=LWG-2026-0001
//
// Deletes an invoice record and its archived PDF. Intended for mistaken/test
// invoices; normal accounting corrections should usually keep an audit trail.

import {
  supabaseHeaders,
  requireAdminAuth,
  jsonResponse,
  errorResponse,
  withErrorHandling,
} from './_utils.js';

const BUCKET = 'invoice-archive';
const INVOICE_NUMBER_RE = /^LWG-\d{4}-\d{4}$/;

async function deleteArchivedPdf(env, invoiceNumber) {
  const year = invoiceNumber.match(/^LWG-(\d{4})-/)?.[1];
  if (!year) return false;
  const path = `${year}/${invoiceNumber}.pdf`;
  const res = await fetch(`${env.SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` },
  });
  if (res.ok || res.status === 404) return true;
  console.error('Invoice archive delete failed:', await res.text());
  return false;
}

async function deleteInvoiceRecord(env, invoiceNumber) {
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/invoices?invoice_number=eq.${encodeURIComponent(invoiceNumber)}`,
    {
      method: 'DELETE',
      headers: {
        ...supabaseHeaders(env.SUPABASE_SERVICE_KEY),
        Prefer: 'return=representation',
      },
    }
  );
  if (!res.ok) {
    throw new Error(`Invoice record delete failed: ${await res.text()}`);
  }
  const rows = await res.json().catch(() => []);
  return rows[0] || null;
}

export const onRequestDelete = withErrorHandling(async ({ request, env }) => {
  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  const url = new URL(request.url);
  const invoiceNumber = String(url.searchParams.get('invoice_number') || '').trim();
  if (!INVOICE_NUMBER_RE.test(invoiceNumber)) return errorResponse('Invalid invoice_number', 400);

  const archiveDeleted = await deleteArchivedPdf(env, invoiceNumber);
  if (!archiveDeleted) return errorResponse('Could not delete archived invoice PDF', 502);

  const invoice = await deleteInvoiceRecord(env, invoiceNumber);

  return jsonResponse({
    success: true,
    invoice_number: invoiceNumber,
    invoice_deleted: Boolean(invoice),
  });
}, 'delete-invoice');
