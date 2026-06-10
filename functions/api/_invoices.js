// functions/api/_invoices.js
// Shared invoice persistence + PDF archiving helpers.
// Used by send-invoice.js (email + log) and log-invoice-download.js (log only).

import { supabaseHeaders } from './_utils.js';

export const INVOICE_NUMBER_RE = /^LWG-\d{4}-\d{4}$/;

// Status fallbacks tolerate older databases whose check constraint may not yet
// allow every value. The first status the constraint accepts is used.
export const PENDING_STATUS_CANDIDATES = ['pending', 'unpaid', 'open', 'sent'];
export const DOWNLOADED_STATUS_CANDIDATES = ['downloaded', 'pending', 'unpaid', 'open'];

// Statuses that represent an invoice that has already been emailed/settled, so a
// fresh send must be refused as a genuine duplicate.
export const FINALISED_STATUSES = new Set(['sent', 'paid']);

// Looks up an existing invoice by number. Returns { id, status } or null.
export async function findInvoiceByNumber(env, invoiceNumber) {
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/invoices?invoice_number=eq.${encodeURIComponent(
      invoiceNumber
    )}&select=id,status&limit=1`,
    { headers: supabaseHeaders(env.SUPABASE_SERVICE_KEY) }
  );
  if (!res.ok) {
    console.error('Invoice number lookup failed:', await res.text());
    return null;
  }
  const rows = await res.json();
  return rows[0] || null;
}

export async function updateInvoiceStatus(env, invoiceId, status) {
  if (!invoiceId) return;
  const payload = status === 'sent' ? { status, sent_at: new Date().toISOString() } : { status };
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/invoices?id=eq.${invoiceId}`, {
    method: 'PATCH',
    headers: supabaseHeaders(env.SUPABASE_SERVICE_KEY),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorText = await res.text();
    if (status === 'sent' && errorText.includes('sent_at')) {
      const compatRes = await fetch(`${env.SUPABASE_URL}/rest/v1/invoices?id=eq.${invoiceId}`, {
        method: 'PATCH',
        headers: supabaseHeaders(env.SUPABASE_SERVICE_KEY),
        body: JSON.stringify({ status }),
      });
      if (compatRes.ok) return;
      console.error(`Invoice status update failed for ${invoiceId}:`, await compatRes.text());
      return;
    }
    console.error(`Invoice status update failed for ${invoiceId}:`, errorText);
  }
}

// Uploads the invoice PDF to the invoice-archive bucket. Uses upsert so a
// previously-downloaded invoice can be overwritten when it is later sent.
export async function archiveInvoicePdf(env, invoiceNumber, pdfBase64) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) return;
  const yearMatch = invoiceNumber.match(/^LWG-(\d{4})-/);
  const year = yearMatch ? yearMatch[1] : 'misc';
  let binary;
  try {
    binary = atob(pdfBase64);
  } catch {
    console.error('Invoice archive: invalid base64 PDF for', invoiceNumber);
    return;
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const res = await fetch(
    `${env.SUPABASE_URL}/storage/v1/object/invoice-archive/${year}/${invoiceNumber}.pdf`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/pdf',
        'x-upsert': 'true',
      },
      body: bytes,
    }
  );
  if (!res.ok) {
    console.error(`Invoice archive upload failed for ${invoiceNumber}:`, await res.text());
  }
}

// Inserts an invoice row, trying each status candidate until the database's
// status check constraint accepts one. Returns the created record or throws.
export async function logInvoice(env, body, statusCandidates) {
  const inv = body.invoice || {};
  const basePayload = {
    student_id: body.student_id,
    course_id: body.course_id,
    company_id: null,
    invoice_number: inv.invoice_number,
    total_amount: Number(inv.total_amount),
    currency: inv.currency || 'CHF',
    issued_date: inv.invoice_date || new Date().toISOString().slice(0, 10),
    due_date: inv.due_date || null,
    invoice_language: body.language,
  };

  let lastError = '';
  for (const status of statusCandidates) {
    let res = await fetch(`${env.SUPABASE_URL}/rest/v1/invoices`, {
      method: 'POST',
      headers: {
        ...supabaseHeaders(env.SUPABASE_SERVICE_KEY),
        Prefer: 'return=representation',
      },
      body: JSON.stringify({ ...basePayload, status }),
    });

    if (!res.ok) {
      lastError = await res.text();
      if (lastError.includes('invoice_language')) {
        delete basePayload.invoice_language;
        res = await fetch(`${env.SUPABASE_URL}/rest/v1/invoices`, {
          method: 'POST',
          headers: {
            ...supabaseHeaders(env.SUPABASE_SERVICE_KEY),
            Prefer: 'return=representation',
          },
          body: JSON.stringify({ ...basePayload, status }),
        });
        if (!res.ok) lastError = await res.text();
      }
    }

    if (res.ok) {
      const rows = await res.json().catch(() => []);
      return rows[0] || null;
    }

    if (!lastError.includes('invoices_status_check')) break;
  }

  console.error('Invoice log failed:', lastError);
  const err = new Error('Invoice could not be recorded.');
  err.statusCode = 400;
  err.userMessage = 'Invoice could not be recorded.';
  throw err;
}
