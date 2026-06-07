// functions/api/send-company-booking-code.js
// POST /api/send-company-booking-code
// Body: { company_id, student_ids, language? }
//
// Sends a personalised booking-code email to selected students of a company.
// The email contains the link to the group-courses page (pre-filled with the code)
// and the booking code itself for reference.
//
// Environment variables:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY, RESEND_API_KEY, SITE_URL

import {
  supabaseHeaders,
  requireAdminAuth,
  jsonResponse,
  errorResponse,
  withErrorHandling,
  parseJsonBody,
  normalizePageLanguage,
} from './_utils.js';

const FROM_EMAIL = 'learning with gioia <hello@oiagi.org>';
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

function buildEmail({ firstName, bookingCode, bookingUrl, language }) {
  const isEn = language === 'en';
  const greeting = firstName || (isEn ? 'there' : 'du');

  const copy = isEn
    ? {
        subject: 'Your company booking code · learning with gioia',
        htmlLang: 'en',
        intro: `Hello ${greeting} :) Here is the link to courses currently happening at your company.`,
        linkText: 'Open group courses',
        codeLabel: 'Your booking code',
        codeNote: 'Enter this code on the page above to see the courses available to you.',
        questions: 'Any questions? Write to us at',
      }
    : {
        subject: 'Dein Buchungscode für Firmenkurse · learning with gioia',
        htmlLang: 'de',
        intro: `Hallo ${greeting} :) Hier ist der Link zu den Kursen, die aktuell in deinem Unternehmen stattfinden.`,
        linkText: 'Zu den Gruppenkursen',
        codeLabel: 'Dein Buchungscode',
        codeNote:
          'Gib diesen Code auf der obigen Seite ein, um die für dich verfügbaren Kurse zu sehen.',
        questions: 'Noch Fragen? Schreib uns an',
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
          <td style="padding:40px 40px 24px;">
            <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#333;">
              ${esc(copy.intro)}
            </p>
            <p style="margin:0 0 24px;">
              <a href="${esc(bookingUrl)}" style="display:inline-block;background:#1a1a1a;color:#ffffff;font-family:Georgia,serif;font-size:14px;text-decoration:none;padding:12px 24px;">${esc(copy.linkText)}</a>
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 40px 32px;">
            <div style="background:#f4f8fb;border-left:3px solid #1a1a1a;padding:16px 20px;">
              <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#888;">${esc(copy.codeLabel)}</p>
              <p style="margin:0 0 8px;font-size:24px;letter-spacing:0.15em;font-family:monospace;color:#1a1a1a;">${esc(bookingCode)}</p>
              <p style="margin:0;font-size:13px;color:#666;">${esc(copy.codeNote)}</p>
            </div>
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
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY, RESEND_API_KEY } = env;
  const siteUrl = env.SITE_URL || DEFAULT_SITE_URL;

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
  if (!studentIds.length) return errorResponse('No students selected', 400);

  const H = supabaseHeaders(SUPABASE_SERVICE_KEY);

  const compRes = await fetch(
    `${SUPABASE_URL}/rest/v1/companies?id=eq.${company_id}&select=id,name,booking_code`,
    { headers: H }
  );
  if (!compRes.ok) return errorResponse('Database error loading company');
  const companies = await compRes.json();
  if (!companies.length) return errorResponse('Company not found', 404);

  const company = companies[0];
  if (!company.booking_code) return errorResponse('This company has no booking code set', 400);

  const filter = studentIds.map((id) => `id.eq.${id}`).join(',');
  const studRes = await fetch(
    `${SUPABASE_URL}/rest/v1/students?or=(${filter})&select=id,first_name,email`,
    { headers: H }
  );
  if (!studRes.ok) return errorResponse('Database error loading students');
  const students = (await studRes.json()).filter((s) => s.email);
  if (!students.length) return errorResponse('No selected students have an email address', 400);

  const bookingUrl = `${siteUrl}/group-courses?code=${encodeURIComponent(company.booking_code)}`;

  const results = await Promise.all(
    students.map(async (student) => {
      const email = buildEmail({
        firstName: student.first_name || '',
        bookingCode: company.booking_code,
        bookingUrl,
        language,
      });
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: FROM_EMAIL,
            to: [student.email],
            reply_to: NOTIFY_EMAILS,
            subject: email.subject,
            html: email.html,
          }),
        });
        if (!res.ok)
          console.error(`Booking code email failed for ${student.email}:`, await res.text());
        return { id: student.id, email: student.email, ok: res.ok };
      } catch (err) {
        console.error(`Booking code email error for ${student.email}:`, err?.message || err);
        return { id: student.id, email: student.email, ok: false };
      }
    })
  );

  const sent = results.filter((r) => r.ok).length;
  const failed = results.length - sent;
  const sentAt = sent ? new Date().toISOString() : null;
  let tagSaved = false;
  const sentIds = results.filter((r) => r.ok).map((r) => r.id);
  if (sentAt && sentIds.length) {
    const sentFilter = sentIds.map((id) => `id.eq.${id}`).join(',');
    const tagRes = await fetch(`${SUPABASE_URL}/rest/v1/students?or=(${sentFilter})`, {
      method: 'PATCH',
      headers: { ...H, Prefer: 'return=minimal' },
      body: JSON.stringify({ booking_code_sent_at: sentAt }),
    });
    tagSaved = tagRes.ok;
    if (!tagRes.ok) {
      console.error('Booking code sent tag update failed:', await tagRes.text());
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
}, 'send-company-booking-code');
