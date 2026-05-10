// functions/api/send-intake-link.js
// POST /api/send-intake-link
// Body: { student_id }
//
// Sends an email to the student with a personalised intake form link.
// Requires admin auth. Language is inferred from the student's most recent enquiry.

import {
  supabaseHeaders,
  requireAdminAuth,
  jsonResponse,
  errorResponse,
  withErrorHandling,
  parseJsonBody,
} from './_utils.js';
import { getOrCreateIntakeToken, getStudentLanguage, rotateIntakeToken } from './_student-utils.js';

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

function buildIntakeLinkEmail(student, intakeUrl, language) {
  const isDE = language === 'de';
  const name = student.first_name || (isDE ? 'du' : 'there');
  const copy = isDE
    ? {
        subject: 'Bitte fülle dein Anmeldeformular aus — learning with gioia',
        greeting: `Hallo ${esc(name)} :)`,
        body: 'Um dich für den gewünschten Kurs anzumelden, benötigen wir noch einige Informationen von dir. Bitte füll das folgende Formular aus:',
        btn: 'Formular ausfüllen →',
        footer: 'Bei Fragen antworte einfach auf diese E-Mail oder schreib an',
      }
    : {
        subject: 'Please complete your enrolment form — learning with gioia',
        greeting: `Hi ${esc(name)} :)`,
        body: 'In order to enrol you in one of our courses we need some more information from you. Please fill in the following form:',
        btn: 'Complete the form →',
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
          <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#333;">${esc(copy.body)}</p>
          <p style="margin:0 0 0;">
            <a href="${esc(intakeUrl)}" style="display:inline-block;background:#1a1a1a;color:#d6eaf8;text-decoration:none;padding:10px 14px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;">${copy.btn}</a>
          </p>
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

  if (!env.RESEND_API_KEY) return errorResponse('Email service not configured', 500);

  const { body, error } = await parseJsonBody(request);
  if (error) return error;
  if (!body.student_id) return errorResponse('Missing student_id', 400);

  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;
  const H = supabaseHeaders(SUPABASE_SERVICE_KEY);

  const stuRes = await fetch(
    `${SUPABASE_URL}/rest/v1/students?id=eq.${encodeURIComponent(body.student_id)}&select=first_name,last_name,email`,
    { headers: H }
  );
  if (!stuRes.ok) return errorResponse('Database error');
  const students = await stuRes.json();
  const student = students[0];
  if (!student) return errorResponse('Student not found', 404);
  if (!student.email) return errorResponse('Student has no email address', 400);

  const token =
    (await rotateIntakeToken(SUPABASE_URL, SUPABASE_SERVICE_KEY, body.student_id)) ||
    (await getOrCreateIntakeToken(SUPABASE_URL, SUPABASE_SERVICE_KEY, body.student_id));
  if (!token) return errorResponse('Could not generate intake link', 500);

  const base = (env.SITE_URL || new URL(request.url).origin).replace(/\/$/, '');
  const intakeUrl = `${base}/intake.html?token=${encodeURIComponent(token)}`;

  const language =
    body.language === 'de' || body.language === 'en'
      ? body.language
      : await getStudentLanguage(SUPABASE_URL, SUPABASE_SERVICE_KEY, body.student_id);
  const email = buildIntakeLinkEmail(student, intakeUrl, language);

  const sendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.RESEND_API_KEY}` },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [student.email],
      reply_to: NOTIFY_EMAILS,
      subject: email.subject,
      html: email.html,
    }),
  });

  if (!sendRes.ok) {
    console.error('send-intake-link email error:', await sendRes.text());
    return errorResponse('Could not send email', 502);
  }

  return jsonResponse({ success: true, token });
}, 'send-intake-link');
