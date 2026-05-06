// functions/api/send-certificates.js
// POST /api/send-certificates
// Body: {
//   course_id,
//   language: 'de' | 'en',
//   recipients: [{
//     student_id, email, name, certificate_id,
//     attendance_included, attended_sessions, total_sessions,
//     pdf_base64,
//   }]
// }
//
// Sends one certificate-of-attendance email per recipient with the PDF
// (rendered client-side) as an attachment, then logs each issued
// certificate in the `certificates` Supabase table.
//
// Environment variables:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY, RESEND_API_KEY

import {
  supabaseHeaders,
  requireAdminAuth,
  jsonResponse,
  errorResponse,
  withErrorHandling,
  parseJsonBody,
} from './_utils.js';

const NOTIFY_EMAILS = ['info@learningwithgioia.ch'];
const FROM_EMAIL = 'learning with gioia <hello@oiagi.org>';

function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildEmail({ language, name, courseCode, level }) {
  const isEN = language === 'en';
  const subject = isEN
    ? `Certificate of Attendance — ${courseCode || 'your course'} · learning with gioia`
    : `Teilnahmebestätigung — ${courseCode || 'dein Kurs'} · learning with gioia`;

  const greeting = isEN ? `Hello ${name || 'student'},` : `Hallo ${name || 'Kursteilnehmer:in'},`;
  const courseLabel = [level, isEN ? 'course' : 'Kurs', courseCode].filter(Boolean).join(' ');
  const body = isEN
    ? `Below you will find the certificate for your ${esc(courseLabel || 'course')}.`
    : `anbei findest du das Zertifikat für deinen ${esc(courseLabel || 'Kurs')}.`;
  const closing = isEN
    ? 'It was a pleasure learning with you! Thank you for being part of the course, and maybe see you again soon.'
    : 'Es hat uns Spass gemacht, mit dir zu lernen! Danke, dass du dabei warst und vielleicht bis bald.';
  const sign = isEN ? 'Warm regards,' : 'Herzliche Grüsse';
  const teamLine = 'Gioia';

  const html = `<!DOCTYPE html>
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
            <p style="margin:0 0 24px;font-size:22px;line-height:1.4;color:#1a1a1a;">${isEN ? 'Done!' : 'Geschafft!'}</p>
            <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#1a1a1a;">${esc(greeting)}</p>
            <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#333;">${body}</p>
            <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#333;">${esc(closing)}</p>
            <p style="margin:0 0 4px;font-size:15px;line-height:1.7;color:#333;">${esc(sign)}</p>
            <p style="margin:0;font-size:15px;line-height:1.7;color:#333;">${esc(teamLine)}</p>
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
</html>`;

  return { subject, html };
}

async function loadCourse(SUPABASE_URL, SUPABASE_SERVICE_KEY, courseId) {
  const H = supabaseHeaders(SUPABASE_SERVICE_KEY);
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/courses?id=eq.${courseId}&select=id,course_code,level`,
    { headers: H }
  );
  if (!res.ok) return null;
  const rows = await res.json();
  return rows[0] || null;
}

async function logCertificate(env, course_id, r) {
  try {
    await fetch(`${env.SUPABASE_URL}/rest/v1/certificates`, {
      method: 'POST',
      headers: {
        ...supabaseHeaders(env.SUPABASE_SERVICE_KEY),
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        certificate_id: r.certificate_id,
        student_id: r.student_id,
        course_id,
        language: r.language || 'de',
        attendance_included: !!r.attendance_included,
        attended_sessions: r.attended_sessions ?? null,
        total_sessions: r.total_sessions ?? null,
        recipient_email: r.email,
        recipient_name: r.name || null,
      }),
    });
  } catch (err) {
    console.error('Certificate log failed for', r.certificate_id, err?.message || err);
  }
}

const CERT_ID_RE = /^LWG-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
const ALLOWED_LANGUAGES = ['de', 'en'];

function validateRecipient(r) {
  if (!r || typeof r !== 'object') return 'recipient must be an object';
  if (!r.student_id) return 'recipient.student_id is required';
  if (!r.email || typeof r.email !== 'string') return 'recipient.email is required';
  if (!r.certificate_id || !CERT_ID_RE.test(r.certificate_id))
    return 'recipient.certificate_id has invalid format';
  if (!r.pdf_base64 || typeof r.pdf_base64 !== 'string') return 'recipient.pdf_base64 is required';
  return null;
}

export const onRequestPost = withErrorHandling(async ({ request, env }) => {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY, RESEND_API_KEY } = env;

  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY not configured');
    return errorResponse('Email service not configured', 500);
  }

  const { body, error } = await parseJsonBody(request);
  if (error) return error;

  const { course_id, language, recipients } = body || {};
  if (!course_id) return errorResponse('Missing course_id', 400);
  if (!ALLOWED_LANGUAGES.includes(language)) {
    return errorResponse('language must be one of: de, en', 400);
  }
  if (!Array.isArray(recipients) || !recipients.length) {
    return errorResponse('recipients must be a non-empty array', 400);
  }
  for (const r of recipients) {
    const e = validateRecipient(r);
    if (e) return errorResponse(e, 400);
  }

  const course = await loadCourse(SUPABASE_URL, SUPABASE_SERVICE_KEY, course_id);
  if (!course) return errorResponse('Course not found', 404);

  const results = await Promise.all(
    recipients.map(async (r) => {
      const { subject, html } = buildEmail({
        language,
        name: r.name || '',
        courseCode: course.course_code || '',
        level: course.level || '',
      });

      const filename =
        language === 'en'
          ? `certificate-of-attendance-${r.certificate_id}.pdf`
          : `teilnahmebestaetigung-${r.certificate_id}.pdf`;

      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: FROM_EMAIL,
            to: [r.email],
            reply_to: NOTIFY_EMAILS,
            subject,
            html,
            attachments: [
              {
                filename,
                content: r.pdf_base64,
              },
            ],
          }),
        });
        if (!res.ok) {
          console.error(`Certificate email failed for ${r.email}:`, await res.text());
          return { email: r.email, ok: false };
        }
        await logCertificate(env, course_id, { ...r, language });
        return { email: r.email, ok: true, certificate_id: r.certificate_id };
      } catch (err) {
        console.error(`Certificate email error for ${r.email}:`, err?.message || err);
        return { email: r.email, ok: false };
      }
    })
  );

  const sent = results.filter((r) => r.ok).length;
  const failed = results.length - sent;
  return jsonResponse({ success: failed === 0, sent, failed, recipients: results });
}, 'send-certificates');
