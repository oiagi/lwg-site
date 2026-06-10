// functions/api/send-invoice-reminder.js
// POST /api/send-invoice-reminder
// Body: { invoice_number }
//
// Sends a payment reminder email with the archived invoice PDF attached.

import {
  supabaseHeaders,
  requireAdminAuth,
  jsonResponse,
  errorResponse,
  withErrorHandling,
  parseJsonBody,
} from './_utils.js';
import { getStudentLanguage } from './_student-utils.js';

const BUCKET = 'invoice-archive';
const FROM_EMAIL = 'learning with gioia <hello@oiagi.org>';
const NOTIFY_EMAILS = ['info@learningwithgioia.ch'];
const REMINDABLE_STATUSES = new Set(['sent', 'pending', 'unpaid', 'open', 'overdue', 'downloaded']);
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
  return name ? `Liebe/r ${name}` : 'Liebe/r Kunde/in';
}

function buildReminderEmail({ invoice, student, language }) {
  const isEN = language === 'en';
  const invoiceNo = invoice.invoice_number || '';
  const amount = `${Number(invoice.total_amount || 0).toFixed(2)} ${invoice.currency || 'CHF'}`;
  const subject = isEN
    ? `Payment reminder for invoice ${invoiceNo} · learning with gioia`
    : `Zahlungserinnerung Rechnung ${invoiceNo} · learning with gioia`;

  const body = isEN
    ? [
        'While reviewing our invoices, we noticed that the attached invoice is still outstanding.',
        `The open amount is ${amount}.`,
        "We'd be glad to receive your payment soon.",
      ]
    : [
        'Wir haben bei der Durchsicht unserer Rechnungen bemerkt, dass die beiliegende Rechnung noch offen ist.',
        `Der offene Betrag beträgt ${amount}.`,
        'Wir freuen uns über eine baldige Begleichung.',
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
              ${isEN ? 'Payment reminder' : 'Zahlungserinnerung'} ${esc(invoiceNo)}
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

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function fetchInvoice(env, invoiceNumber) {
  const url = `${env.SUPABASE_URL}/rest/v1/invoices?invoice_number=eq.${encodeURIComponent(invoiceNumber)}`;
  let res = await fetch(
    `${url}&select=id,invoice_number,status,total_amount,currency,due_date,invoice_language,student_id,course_id&limit=1`,
    { headers: supabaseHeaders(env.SUPABASE_SERVICE_KEY) }
  );
  if (!res.ok) {
    const errorText = await res.text();
    if (!errorText.includes('invoice_language')) {
      throw new Error(`Invoice lookup failed: ${errorText}`);
    }
    res = await fetch(
      `${url}&select=id,invoice_number,status,total_amount,currency,due_date,student_id,course_id&limit=1`,
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
    `${env.SUPABASE_URL}/rest/v1/students?id=eq.${encodeURIComponent(studentId)}&select=first_name,last_name,email,billing_email&limit=1`,
    { headers: supabaseHeaders(env.SUPABASE_SERVICE_KEY) }
  );
  if (!res.ok) throw new Error(`Student lookup failed: ${await res.text()}`);
  const rows = await res.json();
  return rows[0] || null;
}

async function fetchArchivedPdf(env, invoiceNumber) {
  const year = invoiceNumber.match(/^LWG-(\d{4})-/)?.[1];
  if (!year) return null;
  const path = `${year}/${invoiceNumber}.pdf`;
  const res = await fetch(`${env.SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` },
  });
  if (!res.ok) return null;
  return arrayBufferToBase64(await res.arrayBuffer());
}

async function markReminderSent(env, invoiceId) {
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/invoices?id=eq.${encodeURIComponent(invoiceId)}`,
    {
      method: 'PATCH',
      headers: supabaseHeaders(env.SUPABASE_SERVICE_KEY),
      body: JSON.stringify({ reminder_sent_at: new Date().toISOString() }),
    }
  );
  if (!res.ok) {
    const errorText = await res.text();
    if (!errorText.includes('reminder_sent_at')) {
      console.error('Could not mark invoice reminder sent:', errorText);
      return false;
    }
    return false;
  }
  return true;
}

export const onRequestPost = withErrorHandling(async ({ request, env }) => {
  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  if (!env.RESEND_API_KEY) return errorResponse('Email service not configured', 500);

  const { body, error } = await parseJsonBody(request);
  if (error) return error;

  const invoiceNumber = String(body.invoice_number || '').trim();
  if (!INVOICE_NUMBER_RE.test(invoiceNumber)) return errorResponse('Invalid invoice_number', 400);

  const invoice = await fetchInvoice(env, invoiceNumber);
  if (!invoice) return errorResponse('Invoice not found', 404);
  if (!REMINDABLE_STATUSES.has(invoice.status)) {
    return errorResponse('Only open invoices can receive reminders', 400);
  }

  const [student, pdfBase64] = await Promise.all([
    fetchStudent(env, invoice.student_id),
    fetchArchivedPdf(env, invoice.invoice_number),
  ]);
  if (!student) return errorResponse('Student not found', 404);
  const recipientEmail = student.billing_email || student.email;
  if (!recipientEmail) return errorResponse('Invoice recipient has no email address', 400);
  if (!pdfBase64) return errorResponse('Archived invoice PDF not found', 404);

  const language =
    invoice.invoice_language === 'de' || invoice.invoice_language === 'en'
      ? invoice.invoice_language
      : await getStudentLanguage(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, invoice.student_id);
  const email = buildReminderEmail({ invoice, student, language });

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
      attachments: [
        {
          filename: `${language === 'en' ? 'payment-reminder' : 'zahlungserinnerung'}-${invoice.invoice_number}.pdf`,
          content: pdfBase64,
        },
      ],
    }),
  });

  if (!sendRes.ok) {
    console.error('Invoice reminder email failed:', await sendRes.text());
    return errorResponse('Invoice reminder email failed', 502);
  }

  const reminderRecorded = await markReminderSent(env, invoice.id);

  return jsonResponse({
    success: true,
    invoice_number: invoice.invoice_number,
    language,
    reminder_recorded: reminderRecorded,
  });
}, 'send-invoice-reminder');
