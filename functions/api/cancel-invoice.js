// functions/api/cancel-invoice.js
// POST /api/cancel-invoice
// Body: {
//   original_invoice_number,
//   invoice: { invoice_number, subject, quantity, unit_price,
//              total_amount (NEGATIVE), currency, invoice_date },
//   pdf_base64,           // the storno (credit note) PDF, built client-side
//   language,             // de|en — language of the storno document/email
//   notify,               // optional: email the storno to the student
//   new_invoice_follows,  // optional: email mentions a corrected invoice follows
//   email, name, first_name, last_name, gender   // required when notify=true
// }
//
// Cancels an invoice Swiss-style: records a storno (credit note) row with a
// negative total that references the original, archives the storno PDF, and
// flips the original to 'cancelled'. send-invoice.js and
// log-invoice-download.js deliberately reject negative totals, so the storno
// document goes through this endpoint only — which in turn REQUIRES a
// negative total.
//
// The steps run in order and partial failure is reported honestly in the
// response flags; in particular a failed notification email never rolls back
// the cancellation (success stays true, email_sent comes back false).
// Requires the add_invoice_cancellation.sql migration ('storno'/'cancelled'
// statuses); without it the endpoint refuses with a clear message.

import {
  supabaseHeaders,
  requireAdminAuth,
  jsonResponse,
  errorResponse,
  withErrorHandling,
  parseJsonBody,
} from './_utils.js';
import {
  INVOICE_NUMBER_RE,
  updateInvoiceStatus,
  archiveInvoicePdf,
  logInvoice,
} from './_invoices.js';
import { sendResendEmail } from './_email.js';
import { cleanFilenamePart, buildCancellationEmail } from './_invoice-email.js';

const NOTIFY_EMAILS = ['info@learningwithgioia.ch'];
const ALLOWED_LANGUAGES = ['de', 'en'];
const UNCANCELLABLE_STATUSES = new Set(['cancelled', 'storno']);

function validate(body) {
  const originalNumber = String(body.original_invoice_number || '').trim();
  if (!INVOICE_NUMBER_RE.test(originalNumber)) return 'Invalid original_invoice_number';
  if (!ALLOWED_LANGUAGES.includes(body.language)) return 'language must be one of: de, en';
  if (!body.pdf_base64 || typeof body.pdf_base64 !== 'string') return 'pdf_base64 is required';
  const inv = body.invoice || {};
  if (!INVOICE_NUMBER_RE.test(String(inv.invoice_number || ''))) {
    return 'invoice_number must use the format LWG-YYYY-0001';
  }
  if (inv.invoice_number === originalNumber) {
    return 'The storno needs its own invoice number';
  }
  if (!Number.isFinite(Number(inv.total_amount)) || Number(inv.total_amount) >= 0) {
    return 'A storno total_amount must be negative';
  }
  if (body.notify && (!body.email || typeof body.email !== 'string')) {
    return 'Missing email for notification';
  }
  return null;
}

async function fetchOriginalInvoice(env, invoiceNumber) {
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/invoices?invoice_number=eq.${encodeURIComponent(
      invoiceNumber
    )}&select=id,invoice_number,status,student_id,course_id&limit=1`,
    { headers: supabaseHeaders(env.SUPABASE_SERVICE_KEY) }
  );
  if (!res.ok) throw new Error(`Invoice lookup failed: ${await res.text()}`);
  const rows = await res.json();
  return rows[0] || null;
}

async function fetchInvoiceByNumberBasic(env, invoiceNumber) {
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/invoices?invoice_number=eq.${encodeURIComponent(
      invoiceNumber
    )}&select=id,status&limit=1`,
    { headers: supabaseHeaders(env.SUPABASE_SERVICE_KEY) }
  );
  if (!res.ok) throw new Error(`Invoice lookup failed: ${await res.text()}`);
  const rows = await res.json();
  return rows[0] || null;
}

// Stamps sent_at on the storno row after a successful notification (its status
// stays 'storno'), so the overview can show "notified <date>".
async function markStornoNotified(env, stornoId) {
  if (!stornoId) return false;
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/invoices?id=eq.${stornoId}`, {
    method: 'PATCH',
    headers: supabaseHeaders(env.SUPABASE_SERVICE_KEY),
    body: JSON.stringify({ sent_at: new Date().toISOString() }),
  });
  if (!res.ok) {
    console.error('Could not stamp storno sent_at:', await res.text());
    return false;
  }
  return true;
}

export const onRequestPost = withErrorHandling(async ({ request, env }) => {
  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  const { body, error } = await parseJsonBody(request);
  if (error) return error;

  const invalid = validate(body || {});
  if (invalid) return errorResponse(invalid, 400);

  if (body.notify && !env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY not configured');
    return errorResponse('Email service not configured', 500);
  }

  const originalNumber = String(body.original_invoice_number).trim();
  const stornoNumber = body.invoice.invoice_number;

  const original = await fetchOriginalInvoice(env, originalNumber);
  if (!original) return errorResponse('Original invoice not found', 404);
  if (UNCANCELLABLE_STATUSES.has(original.status)) {
    return errorResponse('This invoice has already been cancelled', 409);
  }
  const originalPaid = original.status === 'paid';

  // A left-over storno row from an earlier partial run is reused so the
  // cancellation can be retried; any other clash on the number is refused.
  const existingStorno = await fetchInvoiceByNumberBasic(env, stornoNumber);
  if (existingStorno && existingStorno.status !== 'storno') {
    return errorResponse('Invoice number already exists. Please reload and try again.', 409);
  }

  let stornoRecord = existingStorno;
  if (!stornoRecord) {
    try {
      stornoRecord = await logInvoice(
        env,
        {
          student_id: original.student_id,
          course_id: original.course_id,
          language: body.language,
          invoice: body.invoice,
        },
        ['storno'],
        { cancels_invoice_id: original.id }
      );
    } catch (err) {
      const dbError = String(err.dbError || '');
      if (dbError.includes('invoices_status_check') || dbError.includes('cancels_invoice_id')) {
        return errorResponse(
          'The invoice cancellation migration (add_invoice_cancellation.sql) has not been applied yet.',
          400
        );
      }
      throw err;
    }
  }

  const pdfArchived = await archiveInvoicePdf(env, stornoNumber, body.pdf_base64).catch((err) => {
    console.error('Storno archive unexpected error:', err);
    return false;
  });

  const originalCancelled = await updateInvoiceStatus(env, original.id, 'cancelled');

  let emailSent = null;
  let notifiedRecorded = null;
  if (body.notify) {
    const { subject, html } = buildCancellationEmail({
      language: body.language,
      name: body.name || '',
      first_name: body.first_name || '',
      last_name: body.last_name || '',
      gender: body.gender || '',
      storno_number: stornoNumber,
      original_number: originalNumber,
      original_paid: originalPaid,
      new_invoice_follows: Boolean(body.new_invoice_follows),
    });
    const filename = `${body.language === 'en' ? 'credit-note' : 'stornorechnung'}-${cleanFilenamePart(
      stornoNumber,
      'lwg'
    )}.pdf`;
    const res = await sendResendEmail(env.RESEND_API_KEY, {
      to: [body.email],
      reply_to: NOTIFY_EMAILS,
      subject,
      html,
      attachments: [{ filename, content: body.pdf_base64 }],
    });
    emailSent = res.ok;
    if (res.ok) {
      notifiedRecorded = await markStornoNotified(env, stornoRecord?.id);
    } else {
      console.error(`Storno email failed for ${body.email}:`, await res.text());
    }
  }

  const problems = [];
  if (!pdfArchived) problems.push('the storno PDF could not be archived');
  if (!originalCancelled) {
    problems.push('the original invoice could not be marked as cancelled — please retry');
  }
  if (emailSent === false) {
    problems.push('the notification email failed (the cancellation itself went through)');
  }

  return jsonResponse({
    success: Boolean(stornoRecord) && originalCancelled,
    storno_invoice_number: stornoNumber,
    original_invoice_number: originalNumber,
    original_was_paid: originalPaid,
    storno_logged: Boolean(stornoRecord),
    pdf_archived: pdfArchived,
    original_cancelled: originalCancelled,
    email_sent: emailSent,
    notified_recorded: notifiedRecorded,
    message: problems.length
      ? `Completed with issues: ${problems.join('; ')}.`
      : 'Invoice cancelled.',
  });
}, 'cancel-invoice');
