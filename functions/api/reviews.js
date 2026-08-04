// functions/api/reviews.js
// GET  /api/reviews — approved reviews for the public homepage.
// POST /api/reviews — submit a new review; stored unapproved, nothing goes
//                     live until it is approved in the admin dashboard.

import {
  supabaseHeaders,
  jsonResponse,
  errorResponse,
  validateOrigin,
  checkRateLimit,
  withErrorHandling,
  parseJsonBody,
  normalizePageLanguage,
} from './_utils.js';
import { validate } from './_validate.js';
import { sendResendEmail } from './_email.js';

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

export const onRequestGet = withErrorHandling(async ({ request, env }) => {
  const rateLimitErr = await checkRateLimit(request, { maxRequests: 30, windowSeconds: 60 });
  if (rateLimitErr) return rateLimitErr;

  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/reviews` +
      '?select=id,name,language,text,translation,created_at&approved=eq.true&order=created_at.asc',
    { headers: supabaseHeaders(env.SUPABASE_SERVICE_KEY) }
  );
  if (!res.ok) {
    console.error('Supabase error:', await res.text());
    return errorResponse('Could not load reviews');
  }
  return jsonResponse(await res.json());
}, 'reviews-get');

export const onRequestPost = withErrorHandling(async ({ request, env }) => {
  const originErr = validateOrigin(request, env);
  if (originErr) return originErr;

  const rateLimitErr = await checkRateLimit(request);
  if (rateLimitErr) return rateLimitErr;

  const { body, error } = await parseJsonBody(request);
  if (error) return error;

  // Honeypot: the visible form never fills this field. Bots that do get a
  // fake success and nothing is stored.
  if (body.website) return jsonResponse({ success: true });

  const validationErr = validate(body, {
    name: { required: true, type: 'string', maxLength: 200 },
    text: { required: true, type: 'string', maxLength: 3000 },
  });
  if (validationErr) return errorResponse(validationErr, 400);

  const language = normalizePageLanguage(body.language);
  const name = body.name.replace(/\s+/g, ' ').trim();
  const text = body.text.trim();

  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/reviews`, {
    method: 'POST',
    headers: supabaseHeaders(env.SUPABASE_SERVICE_KEY),
    body: JSON.stringify({ name, language, text, approved: false }),
  });
  if (!res.ok) {
    console.error('Supabase error:', await res.text());
    return errorResponse('Database error');
  }

  // Notify admin — best-effort, the review is already stored.
  try {
    const mailRes = await sendResendEmail(env.RESEND_API_KEY, {
      to: NOTIFY_EMAILS,
      subject: `New review awaiting approval — ${name}`,
      html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f8fb;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f8fb;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;max-width:560px;width:100%;">
        <tr>
          <td style="background:#1a1a1a;padding:24px 40px;">
            <p style="margin:0;color:#d6eaf8;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;">new review</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;">
            <p style="margin:0 0 8px;font-size:13px;color:#888;">${esc(name)} · ${esc(language)}</p>
            <p style="margin:0;font-size:14px;line-height:1.7;color:#333;font-style:italic;">${esc(text)}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 40px 28px;border-top:1px solid #eee;">
            <a href="https://learningwithgioia.ch/admin#reviews" style="font-size:12px;color:#888;">Approve in admin dashboard →</a>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    });
    if (!mailRes.ok) console.error('Review notification email error:', await mailRes.text());
  } catch (err) {
    console.error('Review notification email error:', err);
  }

  return jsonResponse({ success: true });
}, 'reviews-post');
