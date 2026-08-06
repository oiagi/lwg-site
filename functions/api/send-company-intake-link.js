// functions/api/send-company-intake-link.js
// POST /api/send-company-intake-link
// Body: { company_id, student_ids?, language? }
//
// Sends the blanket company intake link to linked company students.

import {
  supabaseHeaders,
  requireAdminAuth,
  jsonResponse,
  errorResponse,
  withErrorHandling,
  parseJsonBody,
  normalizePageLanguage,
} from './_utils.js';
import { sendResendEmail } from './_email.js';

const NOTIFY_EMAILS = ['info@learningwithgioia.ch'];
const DEFAULT_SITE_URL = 'https://learningwithgioia.ch';

function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildEmail({ firstName, intakeUrl, language }) {
  const isEn = language === 'en';
  const greeting = firstName || (isEn ? 'there' : 'du');
  const copy = isEn
    ? {
        subject: 'Please complete your student intake form · learning with gioia',
        intro: `Hello ${greeting} :) Please fill in your details so we can create or update your student record.`,
        button: 'Complete intake form',
        footer: 'Any questions? Write to us at',
      }
    : {
        subject: 'Bitte fülle dein Anmeldeformular aus · learning with gioia',
        intro: `Hallo ${greeting} :) Bitte fülle deine Angaben aus, damit wir deinen Schülereintrag erstellen oder aktualisieren können.`,
        button: 'Formular ausfüllen',
        footer: 'Noch Fragen? Schreib uns an',
      };

  return {
    subject: copy.subject,
    html: `<!DOCTYPE html>
<html lang="${isEn ? 'en' : 'de'}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f8fb;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f8fb;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;max-width:560px;width:100%;">
        <tr><td style="background:#1a1a1a;padding:32px 40px;">
          <p style="margin:0;color:#d6eaf8;font-size:13px;letter-spacing:0.2em;text-transform:uppercase;">learning with gioia</p>
        </td></tr>
        <tr><td style="padding:40px 40px 32px;">
          <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#333;">${esc(copy.intro)}</p>
          <p style="margin:0;">
            <a href="${esc(intakeUrl)}" style="display:inline-block;background:#1a1a1a;color:#d6eaf8;text-decoration:none;padding:10px 14px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;">${esc(copy.button)} →</a>
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
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY, RESEND_API_KEY } = env;
  const siteUrl = (env.SITE_URL || DEFAULT_SITE_URL).replace(/\/$/, '');

  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  if (!RESEND_API_KEY) return errorResponse('Email service not configured', 500);

  const { body, error } = await parseJsonBody(request);
  if (error) return error;

  const { company_id } = body;
  const studentIds = Array.isArray(body.student_ids)
    ? body.student_ids.map((id) => String(id)).filter(Boolean)
    : [];
  const language = normalizePageLanguage(body.language, 'de');

  if (!company_id) return errorResponse('Missing company_id', 400);

  const H = supabaseHeaders(SUPABASE_SERVICE_KEY);
  const compRes = await fetch(
    `${SUPABASE_URL}/rest/v1/companies?id=eq.${encodeURIComponent(company_id)}&select=id,name,intake_code`,
    { headers: H }
  );
  if (!compRes.ok) return errorResponse('Database error loading company');
  const companies = await compRes.json();
  if (!companies.length) return errorResponse('Company not found', 404);

  const company = companies[0];
  if (!company.intake_code) return errorResponse('This company has no intake link set', 400);

  const studentFilter = studentIds.length
    ? `&or=(${studentIds.map((id) => `id.eq.${id}`).join(',')})`
    : '';
  const studRes = await fetch(
    `${SUPABASE_URL}/rest/v1/students?company_id=eq.${encodeURIComponent(company.id)}${studentFilter}&select=id,first_name,last_name,email`,
    { headers: H }
  );
  if (!studRes.ok) return errorResponse('Database error loading students');
  const students = (await studRes.json()).filter((s) => s.email);
  if (!students.length) return errorResponse('No linked students have an email address', 400);

  const intakeUrl = `${siteUrl}/intake.html?company=${encodeURIComponent(company.intake_code)}`;
  const results = await Promise.all(
    students.map(async (student) => {
      const email = buildEmail({
        firstName: student.first_name || '',
        intakeUrl,
        language,
      });
      try {
        const res = await sendResendEmail(RESEND_API_KEY, {
          to: [student.email],
          reply_to: NOTIFY_EMAILS,
          subject: email.subject,
          html: email.html,
        });
        if (!res.ok) {
          console.error(`Company intake email failed for ${student.email}:`, await res.text());
        }
        return { id: student.id, email: student.email, ok: res.ok };
      } catch (err) {
        console.error(`Company intake email error for ${student.email}:`, err?.message || err);
        return { id: student.id, email: student.email, ok: false };
      }
    })
  );

  const sent = results.filter((r) => r.ok).length;
  const failed = results.length - sent;
  const sentAt = sent ? new Date().toISOString() : null;
  const sentIds = results.filter((r) => r.ok).map((r) => r.id);
  let tagSaved = false;

  if (sentAt && sentIds.length) {
    const sentFilter = sentIds.map((id) => `id.eq.${id}`).join(',');
    const tagRes = await fetch(`${SUPABASE_URL}/rest/v1/students?or=(${sentFilter})`, {
      method: 'PATCH',
      headers: { ...H, Prefer: 'return=minimal' },
      body: JSON.stringify({ intake_link_sent_at: sentAt }),
    });
    tagSaved = tagRes.ok;
    if (!tagRes.ok) {
      console.error('Company intake sent tag update failed:', await tagRes.text());
    }
  }

  return jsonResponse({
    success: failed === 0,
    sent,
    failed,
    sent_at: sentAt,
    tag_saved: tagSaved,
    recipients: results,
  });
}, 'send-company-intake-link');
