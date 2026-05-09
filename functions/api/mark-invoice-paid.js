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
import { getStudentLanguage } from './_student-utils.js';

const FROM_EMAIL = 'learning with gioia <hello@oiagi.org>';
const NOTIFY_EMAILS = ['info@learningwithgioia.ch'];

function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildPaymentThankYouEmail(student, language) {
  const isDE = language === 'de';
  const name = student.first_name || (isDE ? 'du' : 'there');
  const copy = isDE
    ? {
        subject: 'Zahlung erhalten — learning with gioia',
        greeting: `Danke, ${esc(name)} :)`,
        body: 'Wir haben deine Zahlung erhalten. Wir freuen uns über dein Vertrauen und darauf, mit dir zu lernen.',
        footer: 'Bei Fragen antworte einfach auf diese E-Mail oder schreib an',
      }
    : {
        subject: 'Payment received — learning with gioia',
        greeting: `Thank you, ${esc(name)} :)`,
        body: "We've received your payment. We appreciate your trust in us and look forward to studying with you.",
        footer: 'If you have any questions, reply to this email or write to',
      };

  return {
    subject: copy.subject,
    html: `<!DOCTYPE html>
<html lang="${isDE ? 'de' : 'en'}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f8fb;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f8fb;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;max-width:560px;width:100%;">
        <tr><td style="background:#1a1a1a;padding:32px 40px;">
          <p style="margin:0;color:#d6eaf8;font-family:Georgia,serif;font-size:13px;letter-spacing:0.2em;text-transform:uppercase;">learning with gioia</p>
        </td></tr>
        <tr><td style="padding:40px 40px 32px;">
          <p style="margin:0 0 24px;font-size:22px;font-weight:normal;color:#1a1a1a;font-family:Georgia,serif;">${copy.greeting}</p>
          <p style="margin:0;font-size:15px;line-height:1.7;color:#333;">${esc(copy.body)}</p>
        </td></tr>
        <tr><td style="padding:24px 40px 32px;border-top:1px solid #eee;">
          <p style="margin:0;font-size:13px;color:#aaa;line-height:1.6;">
            ${esc(copy.footer)}
            <a href="mailto:info@learningwithgioia.ch" style="color:#1a1a1a;">info@learningwithgioia.ch</a>.
          </p>
          <p style="margin:16px 0 0;font-size:13px;color:#aaa;">
            <a href="https://learningwithgioia.ch" style="color:#aaa;">learningwithgioia.ch</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  };
}

export const onRequestPost = withErrorHandling(async ({ request, env }) => {
  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  const { body, error } = await parseJsonBody(request);
  if (error) return error;
  if (!body.invoice_id) return errorResponse('Missing invoice_id', 400);

  const { SUPABASE_URL, SUPABASE_SERVICE_KEY, RESEND_API_KEY } = env;
  const H = supabaseHeaders(SUPABASE_SERVICE_KEY);

  const res = await fetch(`${SUPABASE_URL}/rest/v1/invoices?id=eq.${body.invoice_id}`, {
    method: 'PATCH',
    headers: { ...H, Prefer: 'return=representation' },
    body: JSON.stringify({ status: 'paid' }),
  });

  if (!res.ok) {
    console.error('mark-invoice-paid failed:', await res.text());
    return errorResponse('Could not mark invoice paid', 502);
  }

  const rows = await res.json().catch(() => []);
  const invoice = rows[0] || null;

  if (RESEND_API_KEY && invoice?.student_id) {
    (async () => {
      try {
        const stuRes = await fetch(
          `${SUPABASE_URL}/rest/v1/students?id=eq.${encodeURIComponent(invoice.student_id)}&select=first_name,last_name,gender,email`,
          { headers: H }
        );
        const students = stuRes.ok ? await stuRes.json() : [];
        const student = students[0];
        const recipientEmail = student?.email || invoice.recipient_email;
        if (!recipientEmail) return;

        const language = await getStudentLanguage(
          SUPABASE_URL,
          SUPABASE_SERVICE_KEY,
          invoice.student_id
        );
        const email = buildPaymentThankYouEmail(student || {}, language);

        const sendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: FROM_EMAIL,
            to: [recipientEmail],
            reply_to: NOTIFY_EMAILS,
            subject: email.subject,
            html: email.html,
          }),
        });
        if (!sendRes.ok) console.error('mark-invoice-paid email error:', await sendRes.text());
      } catch (err) {
        console.error('mark-invoice-paid email error (non-fatal):', err);
      }
    })();
  }

  return jsonResponse({ success: true, invoice });
}, 'mark-invoice-paid');
