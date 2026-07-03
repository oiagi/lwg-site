// functions/api/send-contracts.js
// POST /api/send-contracts
// Body: {
//   course_id,
//   language: 'de' | 'en',
//   recipients: [{ student_id, email, name, contract_ref, pdf_base64 }]
// }
//
// Sends one course-contract email per recipient with the contract PDF
// (rendered client-side, already carrying Gioia's signature) attached,
// plus a personalised link where the student can upload the printed and
// signed copy. Logs each contract in the `contracts` Supabase table.
//
// Environment variables:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY, RESEND_API_KEY, SITE_URL (optional)

import {
  supabaseHeaders,
  requireAdminAuth,
  jsonResponse,
  errorResponse,
  withErrorHandling,
  parseJsonBody,
} from './_utils.js';
import { getOrCreateStudentToken } from './_student-utils.js';

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

function buildEmail({ language, name, courseCode, uploadUrl }) {
  const isEN = language === 'en';
  const subject = isEN
    ? `Your course contract — ${courseCode || 'your course'} · learning with gioia`
    : `Dein Kursvertrag — ${courseCode || 'dein Kurs'} · learning with gioia`;

  const copy = isEN
    ? {
        greeting: `Hi ${name || 'there'} :)`,
        body: `Attached you will find the contract for your ${courseCode ? `course ${courseCode}` : 'course'}. It already carries our signature.`,
        steps: [
          'Print the attached contract.',
          'Read it carefully and sign it.',
          'Scan or photograph the signed contract and upload it via the button below.',
        ],
        btn: 'Upload signed contract →',
        footer: 'If you have any questions, reply to this email or write to',
      }
    : {
        greeting: `Hallo ${name || 'du'} :)`,
        body: `Anbei findest du den Vertrag für deinen ${courseCode ? `Kurs ${courseCode}` : 'Kurs'}. Er ist von uns bereits unterschrieben.`,
        steps: [
          'Drucke den angehängten Vertrag aus.',
          'Lies ihn sorgfältig durch und unterschreibe ihn.',
          'Scanne oder fotografiere den unterschriebenen Vertrag und lade ihn über den Button unten hoch.',
        ],
        btn: 'Unterschriebenen Vertrag hochladen →',
        footer: 'Bei Fragen antworte einfach auf diese E-Mail oder schreib an',
      };

  const stepsHtml = copy.steps
    .map(
      (s, i) =>
        `<tr><td style="padding:4px 12px 4px 0;font-size:15px;color:#1a1a1a;vertical-align:top;">${i + 1}.</td><td style="padding:4px 0;font-size:15px;line-height:1.7;color:#333;">${esc(s)}</td></tr>`
    )
    .join('');

  const html = `<!DOCTYPE html>
<html lang="${isEN ? 'en' : 'de'}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f8fb;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f8fb;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;max-width:560px;width:100%;">
        <tr><td style="background:#1a1a1a;padding:32px 40px;">
          <p style="margin:0;color:#d6eaf8;font-family:Georgia,serif;font-size:13px;letter-spacing:0.2em;text-transform:uppercase;">learning with gioia</p>
        </td></tr>
        <tr><td style="padding:40px 40px 32px;">
          <p style="margin:0 0 24px;font-size:22px;font-weight:normal;color:#1a1a1a;font-family:Georgia,serif;">${esc(copy.greeting)}</p>
          <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#333;">${esc(copy.body)}</p>
          <table cellpadding="0" cellspacing="0" style="margin:0 0 28px;">${stepsHtml}</table>
          <p style="margin:0;">
            <a href="${esc(uploadUrl)}" style="display:inline-block;background:#1a1a1a;color:#d6eaf8;text-decoration:none;padding:10px 14px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;">${esc(copy.btn)}</a>
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
</html>`;

  return { subject, html };
}

async function loadCourse(SUPABASE_URL, SUPABASE_SERVICE_KEY, courseId) {
  const H = supabaseHeaders(SUPABASE_SERVICE_KEY);
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/courses?id=eq.${encodeURIComponent(courseId)}&select=id,course_code,level`,
    { headers: H }
  );
  if (!res.ok) return null;
  const rows = await res.json();
  return rows[0] || null;
}

async function logContract(env, course_id, r) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/contracts`, {
    method: 'POST',
    headers: {
      ...supabaseHeaders(env.SUPABASE_SERVICE_KEY),
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      contract_ref: r.contract_ref,
      student_id: r.student_id,
      course_id,
      language: r.language || 'de',
      recipient_email: r.email,
      recipient_name: r.name || null,
    }),
  });
  if (!res.ok) {
    console.error('Contract log failed for', r.contract_ref, await res.text());
    return false;
  }
  return true;
}

const CONTRACT_REF_RE = /^LWG-V-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
const ALLOWED_LANGUAGES = ['de', 'en'];

function validateRecipient(r) {
  if (!r || typeof r !== 'object') return 'recipient must be an object';
  if (!r.student_id) return 'recipient.student_id is required';
  if (!r.email || typeof r.email !== 'string') return 'recipient.email is required';
  if (!r.contract_ref || !CONTRACT_REF_RE.test(r.contract_ref))
    return 'recipient.contract_ref has invalid format';
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

  const base = (env.SITE_URL || new URL(request.url).origin).replace(/\/$/, '');

  const results = await Promise.all(
    recipients.map(async (r) => {
      try {
        // The contract row must exist before the email goes out, otherwise
        // the upload link in the email would point at nothing.
        const logged = await logContract(env, course_id, { ...r, language });
        if (!logged) return { email: r.email, ok: false };

        const token = await getOrCreateStudentToken(
          SUPABASE_URL,
          SUPABASE_SERVICE_KEY,
          r.student_id
        );
        if (!token) {
          console.error(`Could not create upload token for student ${r.student_id}`);
          return { email: r.email, ok: false };
        }
        const uploadUrl = `${base}/contract-upload?token=${encodeURIComponent(token)}&contract=${encodeURIComponent(r.contract_ref)}`;

        const { subject, html } = buildEmail({
          language,
          name: r.name || '',
          courseCode: course.course_code || '',
          uploadUrl,
        });

        const filename =
          language === 'en'
            ? `course-contract-${r.contract_ref}.pdf`
            : `kursvertrag-${r.contract_ref}.pdf`;

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
            attachments: [{ filename, content: r.pdf_base64 }],
          }),
        });
        if (!res.ok) {
          console.error(`Contract email failed for ${r.email}:`, await res.text());
          return { email: r.email, ok: false };
        }
        return { email: r.email, ok: true, contract_ref: r.contract_ref };
      } catch (err) {
        console.error(`Contract email error for ${r.email}:`, err?.message || err);
        return { email: r.email, ok: false };
      }
    })
  );

  const sent = results.filter((r) => r.ok).length;
  const failed = results.length - sent;
  return jsonResponse({ success: failed === 0, sent, failed, recipients: results });
}, 'send-contracts');
