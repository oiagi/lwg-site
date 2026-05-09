// functions/api/send-intake-link.js
// POST /api/send-intake-link
// Body: { student_id }
//
// Sends an intake form link email to the student.
// Requires admin auth. Language is inferred from the student's most recent enquiry.

import {
  supabaseHeaders,
  requireAdminAuth,
  jsonResponse,
  errorResponse,
  withErrorHandling,
  parseJsonBody,
} from './_utils.js';
import { getOrCreateStudentToken, getStudentLanguage } from './_student-utils.js';

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
  const isEnglish = language === 'en';
  const greetingName =
    student.first_name || (isEnglish ? 'course participant' : 'Kursteilnehmer:in');

  const copy = isEnglish
    ? {
        subject: 'Your intake form · learning with gioia',
        htmlLang: 'en',
        title: 'Intake form',
        greeting: `Hello ${greetingName},`,
        body: 'Please fill in your personal details using the link below. This helps us keep your information up to date. Without this information, we are unable to enroll you in a course.',
        linkLabel: 'Open intake form',
        validNote: 'The link is valid for 90 days.',
        questions: 'If you have any questions, please write to us at',
      }
    : {
        subject: 'Dein Anmeldeformular · learning with gioia',
        htmlLang: 'de',
        title: 'Anmeldeformular',
        greeting: `Hallo ${greetingName},`,
        body: 'Bitte fülle deine persönlichen Angaben über den untenstehenden Link aus. So können wir deine Daten aktuell halten. Ohne diese Angaben können wir dich leider nicht für einen Kurs anmelden.',
        linkLabel: 'Anmeldeformular öffnen',
        validNote: 'Der Link ist 90 Tage gültig.',
        questions: 'Bei Fragen schreib uns einfach an',
      };

  return {
    subject: copy.subject,
    html: `<!DOCTYPE html>
<html lang="${copy.htmlLang}">
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
              ${esc(copy.title)}
            </p>
            <p style="margin:0 0 8px;font-size:15px;line-height:1.7;color:#333;">${esc(copy.greeting)}</p>
            <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#333;">${esc(copy.body)}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 40px 32px;text-align:center;">
            <a href="${esc(intakeUrl)}" style="display:inline-block;background:#1a1a1a;color:#ffffff;text-decoration:none;padding:14px 32px;font-family:Georgia,serif;font-size:15px;letter-spacing:0.05em;">${esc(copy.linkLabel)}</a>
            <p style="margin:16px 0 0;font-size:13px;color:#aaa;">${esc(copy.validNote)}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 40px 32px;border-top:1px solid #eee;">
            <p style="margin:0;font-size:13px;color:#aaa;line-height:1.6;">
              ${esc(copy.questions)}
              <a href="mailto:info@learningwithgioia.ch" style="color:#1a1a1a;">info@learningwithgioia.ch</a>.
            </p>
            <p style="margin:16px 0 0;font-size:13px;color:#aaa;">
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

  const token = await getOrCreateStudentToken(SUPABASE_URL, SUPABASE_SERVICE_KEY, body.student_id);
  if (!token) return errorResponse('Could not generate intake link', 500);

  const base = (env.SITE_URL || new URL(request.url).origin).replace(/\/$/, '');
  const intakeUrl = `${base}/intake.html?token=${encodeURIComponent(token)}`;

  const language = await getStudentLanguage(SUPABASE_URL, SUPABASE_SERVICE_KEY, body.student_id);
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

  return jsonResponse({ success: true });
}, 'send-intake-link');
