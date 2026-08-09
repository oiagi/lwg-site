// functions/api/_invoices.js
// Shared invoice persistence + PDF archiving helpers.
// Used by send-invoice.js (email + log) and log-invoice-download.js (log only).

import { supabaseHeaders } from './_utils.js';

export const INVOICE_NUMBER_RE = /^LWG-\d{4}-\d{4}$/;

// Status fallbacks tolerate older databases whose check constraint may not yet
// allow every value. The first status the constraint accepts is used.
export const PENDING_STATUS_CANDIDATES = ['pending', 'unpaid', 'open', 'sent'];
export const DOWNLOADED_STATUS_CANDIDATES = ['downloaded', 'pending', 'unpaid', 'open'];

// Statuses that represent an invoice that has already been emailed/settled or
// cancelled, so a fresh send must be refused as a genuine duplicate.
export const FINALISED_STATUSES = new Set(['sent', 'paid', 'cancelled', 'storno']);

// Columns that may not exist yet in older databases (their migrations are
// applied by hand). When PostgREST reports one missing, it is stripped from
// the insert payload and the insert retried.
const OPTIONAL_INVOICE_COLUMNS = [
  'invoice_language',
  'item_subject',
  'item_quantity',
  'item_unit_price',
];

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

// Returns true when the row was updated. 'sent' and 'cancelled' also stamp
// their timestamp column, falling back to a status-only update on databases
// where that column does not exist yet.
export async function updateInvoiceStatus(env, invoiceId, status) {
  if (!invoiceId) return false;
  const timestampField =
    status === 'sent' ? 'sent_at' : status === 'cancelled' ? 'cancelled_at' : null;
  const payload = timestampField
    ? { status, [timestampField]: new Date().toISOString() }
    : { status };
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/invoices?id=eq.${invoiceId}`, {
    method: 'PATCH',
    headers: supabaseHeaders(env.SUPABASE_SERVICE_KEY),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorText = await res.text();
    if (timestampField && errorText.includes(timestampField)) {
      const compatRes = await fetch(`${env.SUPABASE_URL}/rest/v1/invoices?id=eq.${invoiceId}`, {
        method: 'PATCH',
        headers: supabaseHeaders(env.SUPABASE_SERVICE_KEY),
        body: JSON.stringify({ status }),
      });
      if (compatRes.ok) return true;
      console.error(`Invoice status update failed for ${invoiceId}:`, await compatRes.text());
      return false;
    }
    console.error(`Invoice status update failed for ${invoiceId}:`, errorText);
    return false;
  }
  return true;
}

// Uploads the invoice PDF to the invoice-archive bucket. Uses upsert so a
// previously-downloaded invoice can be overwritten when it is later sent.
// Returns true when the upload succeeded.
export async function archiveInvoicePdf(env, invoiceNumber, pdfBase64) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) return false;
  const yearMatch = invoiceNumber.match(/^LWG-(\d{4})-/);
  const year = yearMatch ? yearMatch[1] : 'misc';
  let binary;
  try {
    binary = atob(pdfBase64);
  } catch {
    console.error('Invoice archive: invalid base64 PDF for', invoiceNumber);
    return false;
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
    return false;
  }
  return true;
}

// Buckets a flat list of invoice rows (already scoped to a set of courses) into
// the per-course/per-student shapes the course overview renders:
//   open        — still actionable: not paid, not cancelled, not a storno
//   paid        — settled and not later cancelled
//   cancelled   — cancelled originals, each carrying the storno that voided it
//   sentAt      — latest send timestamp per student (communications summary)
//   cancelledAt — latest cancellation timestamp per student
//
// A storno row is never listed on its own — it is folded into the original it
// cancels as storno_invoice_number / storno_total_amount / storno_issued_date,
// so the overview shows one "cancelled" line per invoice rather than a pair.
// An original with a storno pointing at it counts as cancelled even when its
// own status update failed: cancel-invoice.js reports that partial failure, but
// the overview must not keep offering a voided invoice as open.
//
// Cancelled invoices are deliberately kept out of sentAt: a voided invoice no
// longer counts towards "invoice sent to N of M", it is reported as cancelled.
export function groupCourseInvoices(invoices) {
  const open = {};
  const paid = {};
  const cancelled = {};
  const sentAt = {};
  const cancelledAt = {};

  // Requires cancels_invoice_id. On databases without that column yet, stornos
  // simply stay unlinked and their original shows as cancelled on its own.
  const stornoByOriginalId = {};
  for (const inv of invoices) {
    if (inv.status === 'storno' && inv.cancels_invoice_id) {
      stornoByOriginalId[inv.cancels_invoice_id] = inv;
    }
  }

  const push = (map, inv, value) => {
    const byStudent = (map[inv.course_id] ||= {});
    (byStudent[inv.student_id] ||= []).push(value);
  };
  const stampLatest = (map, inv, value) => {
    if (!value) return;
    const byStudent = (map[inv.course_id] ||= {});
    const current = byStudent[inv.student_id];
    if (!current || String(value) > String(current)) byStudent[inv.student_id] = value;
  };

  for (const inv of invoices) {
    if (inv.status === 'storno') continue;

    const storno = stornoByOriginalId[inv.id] || null;
    if (inv.status === 'cancelled' || storno) {
      push(cancelled, inv, {
        ...inv,
        status: 'cancelled',
        storno_invoice_number: storno?.invoice_number ?? null,
        storno_total_amount: storno?.total_amount ?? null,
        storno_issued_date: storno?.issued_date ?? null,
      });
      stampLatest(cancelledAt, inv, inv.cancelled_at || storno?.issued_date || null);
      continue;
    }

    if (inv.status === 'sent' || inv.status === 'paid') {
      stampLatest(sentAt, inv, inv.sent_at || inv.issued_date);
    }

    if (inv.status === 'paid') {
      push(paid, inv, inv);
    } else if (inv.status === 'sent' && !inv.sent_at) {
      // Pre-archive invoices: sent before the PDF archive existed, so they have
      // no archived file and no sent_at. Skip them — they only clutter the
      // overview and link to nothing in the invoice archive. The "invoice sent"
      // communications summary still counts them as genuinely sent.
      continue;
    } else {
      push(open, inv, inv);
    }
  }

  return { open, paid, cancelled, sentAt, cancelledAt };
}

// Inserts an invoice row, trying each status candidate until the database's
// status check constraint accepts one. Optional columns the database does not
// have yet are stripped and the insert retried, so the code keeps working
// before their migration is applied. `extraFields` lets callers persist
// additional columns (e.g. cancels_invoice_id for storno rows).
// Returns the created record or throws (the raw DB error is on err.dbError).
export async function logInvoice(env, body, statusCandidates, extraFields = {}) {
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
    item_subject: inv.subject ?? null,
    item_quantity:
      inv.quantity === undefined || inv.quantity === null ? null : Number(inv.quantity),
    item_unit_price:
      inv.unit_price === undefined || inv.unit_price === null ? null : Number(inv.unit_price),
    ...extraFields,
  };

  const insert = (status) =>
    fetch(`${env.SUPABASE_URL}/rest/v1/invoices`, {
      method: 'POST',
      headers: {
        ...supabaseHeaders(env.SUPABASE_SERVICE_KEY),
        Prefer: 'return=representation',
      },
      body: JSON.stringify({ ...basePayload, status }),
    });

  let lastError = '';
  for (const status of statusCandidates) {
    let res = await insert(status);

    while (!res.ok) {
      lastError = await res.text();
      const missing = OPTIONAL_INVOICE_COLUMNS.filter(
        (col) => col in basePayload && lastError.includes(col)
      );
      if (missing.length) {
        missing.forEach((col) => delete basePayload[col]);
        res = await insert(status);
        continue;
      }
      // Databases that predate add_invoice_cancellation.sql still have
      // due_date NOT NULL. Storno rows deliberately carry none, so fall back
      // to the issue date rather than failing the cancellation.
      if (
        basePayload.due_date === null &&
        lastError.includes('due_date') &&
        lastError.includes('not-null')
      ) {
        basePayload.due_date = basePayload.issued_date;
        res = await insert(status);
        continue;
      }
      break;
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
  err.dbError = lastError;
  throw err;
}
