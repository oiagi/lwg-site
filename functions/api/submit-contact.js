// functions/api/submit-contact.js
// POST /api/submit-contact
// Sends the contact form via Resend.
//
// Environment variables:
//   RESEND_API_KEY — Resend API key

import { jsonResponse, errorResponse, validateOrigin, checkRateLimit } from './_utils.js';
import { validate } from './_validate.js';

const NOTIFY_EMAIL = 'info@oiagi.org';
const FROM_EMAIL   = 'learning with gioia <hello@oiagi.org>';

function buildContactNotification({ name, email, phone, preferred_contact, message }) {
  return {
    subject: `New contact message — ${name}`,
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f8fb;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f8fb;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;max-width:560px;width:100%;">
        <tr>
          <td style="background:#1a1a1a;padding:24px 40px;">
            <p style="margin:0;color:#d6eaf8;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;">contact form</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #eee;">
              <tr>
                <td style="padding:6px 0;color:#888;font-size:13px;">Name</td>
                <td style="padding:6px 0 6px 20px;font-size:13px;">${name}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;color:#888;font-size:13px;">Email</td>
                <td style="padding:6px 0 6px 20px;font-size:13px;">${email}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;color:#888;font-size:13px;">Phone</td>
                <td style="padding:6px 0 6px 20px;font-size:13px;">${phone || '—'}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;color:#888;font-size:13px;">Preferred contact</td>
                <td style="padding:6px 0 6px 20px;font-size:13px;">${preferred_contact || '—'}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;color:#888;font-size:13px;vertical-align:top;">Message</td>
                <td style="padding:6px 0 6px 20px;font-size:13px;white-space:pre-wrap;">${message}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  };
}

export async function onRequestPost({ request, env }) {
  const originErr = validateOrigin(request, env);
  if (originErr) return originErr;

  const rateLimitErr = await checkRateLimit(request);
  if (rateLimitErr) return rateLimitErr;

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON', 400);
  }

  const validationErr = validate(body, {
    name:              { required: true, type: 'string', maxLength: 200 },
    email:             { required: true, type: 'string', email: true, maxLength: 320 },
    phone:             { type: 'string', maxLength: 50 },
    preferred_contact: { type: 'string', oneOf: ['Email', 'Phone', 'Either'] },
    message:           { required: true, type: 'string', maxLength: 5000 },
  });
  if (validationErr) return errorResponse(validationErr, 400);

  const { name, email, phone, preferred_contact, message } = body;

  const { RESEND_API_KEY } = env;
  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY not configured');
    return errorResponse('Server configuration error', 500);
  }

  try {
    const notification = buildContactNotification({ name, email, phone, preferred_contact, message });

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from:     FROM_EMAIL,
        to:       [NOTIFY_EMAIL],
        reply_to: email,
        subject:  notification.subject,
        html:     notification.html,
      }),
    });

    if (!res.ok) {
      console.error('Resend error:', await res.text());
      return errorResponse('Could not send message', 502);
    }

    return jsonResponse({ success: true });
  } catch (err) {
    console.error('Resend fetch error:', err?.message || err);
    return errorResponse('Could not send message', 502);
  }
}
