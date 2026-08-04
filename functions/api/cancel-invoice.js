// functions/api/cancel-invoice.js
// POST /api/cancel-invoice
// Body: { invoice_number, notify }
//
// Cancels an invoice instead of deleting it: the record and its archived PDF
// stay in place, the status flips to 'cancelled' and the invoice moves to the
// "cancelled" tab of the admin archive. Optionally emails the student to say
// the invoice has been cancelled and a corrected one will follow.
// The replacement invoice is issued from the course page as usual.

import {
  supabaseHeaders,
  requireAdminAuth,
  jsonResponse,
  errorResponse,
  withErrorHandling,
  parseJsonBody,
} from './_utils.js';
import { getStudentLanguage } from './_student-utils.js';

const FROM_EMAIL = 'learning with gioia <hello@oiagi.org>';
const NOTIFY_EMAILS = ['info@learningwithgioia.ch'];
const INVOICE_NUMBER_RE = /^LWG-\d{4}-\d{4}$/;

function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function greeting(student, language) {
  const name = student.first_name || '';
  if (language === 'en') return name ? `Dear ${name},` : 'Dear customer,';
  if (!name) return 'Hallo';
  if (student.gender === 'female') return `Liebe ${name}`;
  if (student.gender === 'male') return `Lieber ${name}`;
  return `Hallo ${name}`;
}

function buildCancellationEmail({ invoice, student, language }) {
  const isEN = language === 'en';
  const invoiceNo = invoice.invoice_number || '';
  const subject = isEN
    ? `Invoice ${invoiceNo} has been cancelled · learning with gioia`
    : `Rechnung ${invoiceNo} wurde storniert · learning with gioia`;

  const body = isEN
    ? [
        `As agreed, invoice ${invoiceNo} has been cancelled and no longer needs to be paid.`,
        'A corrected invoice will follow in a separate email shortly.',
        'Please disregard the cancelled invoice and any payment reminder you may have received for it.',
      ]
    : [
        `Wie besprochen wurde die Rechnung ${invoiceNo} storniert und muss nicht bezahlt werden.`,
        'Eine korrigierte Rechnung folgt in Kürze in einer separaten E-Mail.',
        'Bitte ignoriere die stornierte Rechnung sowie allfällige Zahlungserinnerungen dazu.',
      ];

  return {
    subject,
    html: `<!DOCTYPE html>
<html lang="${isEN ? 'en' : 'de'}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f8fb;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f8fb;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;max-width:600px;width:100%;">
        <tr>
          <td style="background:#1a1a1a;padding:32px 40px;">
            <p style="margin:0;color:#d6eaf8;font-family:Georgia,serif;font-size:13px;letter-spacing:0.2em;text-transform:uppercase;">learning with gioia</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 40px 16px;">
            <p style="margin:0 0 24px;font-size:22px;font-weight:normal;color:#1a1a1a;font-family:Georgia,serif;">
              ${isEN ? 'Invoice cancelled' : 'Rechnung storniert'} ${esc(invoiceNo)}
            </p>
            <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#1a1a1a;">${esc(greeting(student, language))}</p>
            ${body
              .map(
                (line) =>
                  `<p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#333;">${esc(line)}</p>`
              )
              .join('')}
            <p style="margin:0 0 4px;font-size:15px;line-height:1.7;color:#333;">${isEN ? 'Warm regards,' : 'Liebe Grüsse'}</p>
            <p style="margin:0;font-size:15px;line-height:1.7;color:#333;">Gioia</p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 40px 32px;border-top:1px solid #eee;">
            <p style="margin:0;font-size:13px;color:#aaa;line-height:1.6;">
              <a href="https://learningwithgioia.ch" style="color:#aaa;">learningwithgioia.ch</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  };
}

async function fetchInvoice(env, invoiceNumber) {
  const url = `${env.SUPABASE_URL}/rest/v1/invoices?invoice_number=eq.${encodeURIComponent(invoiceNumber)}`;
  let res = await fetch(
    `${url}&select=id,invoice_number,status,total_amount,currency,invoice_language,student_id,course_id&limit=1`,
    { headers: supabaseHeaders(env.SUPABASE_SERVICE_KEY) }
  );
  if (!res.ok) {
    const errorText = await res.text();
    if (!errorText.includes('invoice_language')) {
      throw new Error(`Invoice lookup failed: ${errorText}`);
    }
    res = await fetch(
      `${url}&select=id,invoice_number,status,total_amount,currency,student_id,course_id&limit=1`,
      { headers: supabaseHeaders(env.SUPABASE_SERVICE_KEY) }
    );
  }
  if (!res.ok) throw new Error(`Invoice lookup failed: ${await res.text()}`);
  const rows = await res.json();
  return rows[0] || null;
}

async function fetchStudent(env, studentId) {
  if (!studentId) return null;
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/students?id=eq.${encodeURIComponent(studentId)}&select=first_name,last_name,gender,email,billing_email&limit=1`,
    { headers: supabaseHeaders(env.SUPABASE_SERVICE_KEY) }
  );
  if (!res.ok) throw new Error(`Student lookup failed: ${await res.text()}`);
  const rows = await res.json();
  return rows[0] || null;
}

// Patches the invoice, falling back to a status-only update on databases that
// have not run add_invoice_cancellation.sql yet.
async function patchInvoice(env, invoiceId, payload) {
  const send = (body) =>
    fetch(`${env.SUPABASE_URL}/rest/v1/invoices?id=eq.${encodeURIComponent(invoiceId)}`, {
      method: 'PATCH',
      headers: { ...supabaseHeaders(env.SUPABASE_SERVICE_KEY), Prefer: 'return=representation' },
      body: JSON.stringify(body),
    });

  let res = await send(payload);
  if (res.ok) return { ok: true, rows: await res.json().catch(() => []) };

  const errorText = await res.text();
  const missingColumn =
    errorText.includes('cancelled_at') || errorText.includes('cancellation_notified_at');
  if (!missingColumn) return { ok: false, error: errorText };

  res = await send({ status: payload.status });
  if (res.ok) return { ok: true, rows: await res.json().catch(() => []), degraded: true };
  return { ok: false, error: await res.text() };
}

async function sendCancellationEmail(env, invoice) {
  const student = await fetchStudent(env, invoice.student_id);
  if (!student) return { sent: false, reason: 'Student not found' };
  const recipientEmail = student.billing_email || student.email;
  if (!recipientEmail) return { sent: false, reason: 'Invoice recipient has no email address' };

  const language =
    invoice.invoice_language === 'de' || invoice.invoice_language === 'en'
      ? invoice.invoice_language
      : await getStudentLanguage(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, invoice.student_id);
  const email = buildCancellationEmail({ invoice, student, language });

  const sendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [recipientEmail],
      reply_to: NOTIFY_EMAILS,
      subject: email.subject,
      html: email.html,
    }),
  });
  if (!sendRes.ok) {
    console.error('Invoice cancellation email failed:', await sendRes.text());
    return { sent: false, reason: 'Cancellation email could not be sent' };
  }
  return { sent: true, language };
}

export const onRequestPost = withErrorHandling(async ({ request, env }) => {
  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  const { body, error } = await parseJsonBody(request);
  if (error) return error;

  const invoiceNumber = String(body.invoice_number || '').trim();
  if (!INVOICE_NUMBER_RE.test(invoiceNumber)) return errorResponse('Invalid invoice_number', 400);
  const notify = body.notify === true;

  if (notify && !env.RESEND_API_KEY) return errorResponse('Email service not configured', 500);

  const invoice = await fetchInvoice(env, invoiceNumber);
  if (!invoice) return errorResponse('Invoice not found', 404);
  if (invoice.status === 'cancelled') {
    return errorResponse('Invoice is already cancelled', 400);
  }

  // The student is notified before the status flips so a failing email does not
  // leave a cancelled invoice the student was never told about.
  let emailResult = { sent: false };
  if (notify) {
    emailResult = await sendCancellationEmail(env, invoice);
    if (!emailResult.sent) return errorResponse(emailResult.reason || 'Notification failed', 502);
  }

  const now = new Date().toISOString();
  const result = await patchInvoice(env, invoice.id, {
    status: 'cancelled',
    cancelled_at: now,
    ...(emailResult.sent ? { cancellation_notified_at: now } : {}),
  });

  if (!result.ok) {
    console.error('cancel-invoice failed:', result.error);
    // A status the check constraint rejects means the migration has not run.
    if (String(result.error).includes('invoices_status_check')) {
      return errorResponse(
        'Database does not allow cancelled invoices yet. Apply the invoice cancellation migration.',
        400
      );
    }
    return errorResponse('Could not cancel invoice', 502);
  }

  return jsonResponse({
    success: true,
    invoice_number: invoiceNumber,
    invoice: result.rows?.[0] || null,
    email_sent: emailResult.sent,
    cancellation_recorded: !result.degraded,
  });
}, 'cancel-invoice');
