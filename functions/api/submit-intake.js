// functions/api/submit-intake.js
// POST /api/submit-intake
// Body: { token?, first_name, last_name, email, ... }
//
// Public endpoint (no admin auth). Updates an existing student record
// (looked up by token) or creates a new one if no token is provided.
// Sends an admin notification email via Resend.
//
// Environment variables:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY, RESEND_API_KEY

import {
  supabaseHeaders,
  jsonResponse,
  errorResponse,
  validateOrigin,
  checkRateLimit,
  withErrorHandling,
} from './_utils.js';
import { validate } from './_validate.js';

const NOTIFY_EMAIL = 'info@oiagi.org';
const FROM_EMAIL = 'learning with gioia <hello@oiagi.org>';

export const onRequestPost = withErrorHandling(async ({ request, env }) => {
  const originErr = validateOrigin(request, env);
  if (originErr) return originErr;

  const rateLimitErr = await checkRateLimit(request);
  if (rateLimitErr) return rateLimitErr;

  const { SUPABASE_URL, SUPABASE_SERVICE_KEY, RESEND_API_KEY } = env;

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON', 400);
  }

  const validationErr = validate(body, {
    first_name: { required: true, type: 'string', maxLength: 200 },
    last_name: { required: true, type: 'string', maxLength: 200 },
    email: { required: true, type: 'string', email: true, maxLength: 320 },
    phone: { type: 'string', maxLength: 50 },
    token: { type: 'string', maxLength: 100 },
  });
  if (validationErr) return errorResponse(validationErr, 400);

  const H = { ...supabaseHeaders(SUPABASE_SERVICE_KEY), Prefer: 'return=representation' };

  // Fields that can be set from the intake form
  const allowedFields = [
    'first_name',
    'last_name',
    'email',
    'phone',
    'nationality',
    'street',
    'street_number',
    'postcode',
    'emergency_contact',
    'ec_phone',
    'ec_email',
    'ec_relationship',
    'native_language',
    'target_language',
    'current_level',
    'learning_goals',
    'desired_start_date',
    'course_type',
    'course_format',
    'location',
    'billing_name',
    'billing_address',
    'billing_email',
    'payment_method',
    'referral_source',
    'consent_given',
  ];
  const data = {};
  for (const f of allowedFields) {
    if (body[f] !== undefined) data[f] = body[f];
  }

  // Record consent timestamp
  if (data.consent_given) {
    data.consent_date = new Date().toISOString();
  }

  try {
    const studentName = `${body.first_name} ${body.last_name}`;
    let isUpdate = false;

    if (body.token) {
      // ── Update existing student by token ─────────────────────────────
      const lookupRes = await fetch(
        `${SUPABASE_URL}/rest/v1/students?access_token=eq.${body.token}&select=id,first_name,last_name`,
        { headers: supabaseHeaders(SUPABASE_SERVICE_KEY) }
      );
      const existing = lookupRes.ok ? await lookupRes.json() : [];
      if (!existing.length) return errorResponse('Invalid token', 404);

      const studentId = existing[0].id;
      data.source = data.source || 'intake';

      const res = await fetch(`${SUPABASE_URL}/rest/v1/students?id=eq.${studentId}`, {
        method: 'PATCH',
        headers: H,
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        console.error('Intake update error:', await res.text());
        return errorResponse('Database error');
      }
      isUpdate = true;
    } else {
      // ── Create new student ───────────────────────────────────────────
      data.access_token = crypto.randomUUID();
      data.token_created_at = new Date().toISOString();
      data.source = 'intake';
      data.status = 'active';
      data.active = true;

      const res = await fetch(`${SUPABASE_URL}/rest/v1/students`, {
        method: 'POST',
        headers: H,
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        console.error('Intake create error:', await res.text());
        return errorResponse('Database error');
      }
    }

    // ── Send admin notification email ────────────────────────────────
    if (RESEND_API_KEY) {
      const action = isUpdate ? 'updated their registration' : 'submitted a new registration';
      const fields = [
        ['Name', studentName],
        ['Email', body.email],
        ['Phone', body.phone || '—'],
        ['Target language', body.target_language || '—'],
        ['Level', body.current_level || '—'],
        ['Course type', body.course_type || '—'],
        ['Format', body.course_format || '—'],
        ['Start date', body.desired_start_date || '—'],
        ['Payment', body.payment_method || '—'],
        ['Referral', body.referral_source || '—'],
      ];

      const rows = fields
        .map(
          ([k, v]) =>
            `<tr><td style="padding:5px 0;color:#888;font-size:13px;white-space:nowrap;">${k}</td>
         <td style="padding:5px 0 5px 20px;font-size:13px;">${v}</td></tr>`
        )
        .join('');

      const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f8fb;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f8fb;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;max-width:560px;width:100%;">
        <tr><td style="background:#1a1a1a;padding:24px 40px;">
          <p style="margin:0;color:#d6eaf8;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;">student registration</p>
        </td></tr>
        <tr><td style="padding:32px 40px;">
          <p style="margin:0 0 16px;font-size:15px;color:#333;">${studentName} ${action}.</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #eee;">
            ${rows}
          </table>
        </td></tr>
        <tr><td style="padding:16px 40px 28px;border-top:1px solid #eee;">
          <a href="https://oiagi.org/admin.html" style="font-size:12px;color:#888;">View in admin dashboard →</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: FROM_EMAIL,
            to: [NOTIFY_EMAIL],
            subject: `Student registration — ${studentName}`,
            html,
          }),
        });
      } catch (emailErr) {
        console.error('Email notification error:', emailErr);
        // Don't fail the request if email fails
      }
    }

    return jsonResponse({ success: true });
  } catch (err) {
    console.error('Error:', err);
    return errorResponse('Connection error');
  }
}, 'submit-intake');
