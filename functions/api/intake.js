// functions/api/intake.js
// GET  /api/intake?token=<access_token>   → returns the student's intake fields
// POST /api/intake                        → updates the student's intake fields
//   body: { token, first_name, last_name, email?, phone?, street?, ... }
//
// The student's access_token (also used for /sessions.html) acts as the
// credential — no admin login required. The token is the same one that
// expires after 90 days, so an admin can revoke a link by rotating it.
//
// Environment variables:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY

import {
  supabaseHeaders,
  jsonResponse,
  errorResponse,
  withErrorHandling,
  checkRateLimit,
  parseJsonBody,
} from './_utils.js';

const FROM_EMAIL = 'learning with gioia <hello@oiagi.org>';
const ADMIN_EMAIL = 'info@learningwithgioia.ch';

const TOKEN_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

const RETURN_FIELDS = [
  'first_name',
  'last_name',
  'gender',
  'gender_note',
  'email',
  'phone',
  'street',
  'street_number',
  'postcode',
  'city',
  'emergency_contact',
  'ec_relationship',
  'ec_phone',
  'ec_email',
  'billing_name',
  'billing_email',
  'billing_phone',
  'billing_street',
  'billing_street_number',
  'billing_postcode',
  'billing_city',
];

function emailValid(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ''));
}

function missingRequired(body, fields) {
  return fields.find((field) => !body[field]);
}

async function loadStudentByToken(env, token) {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;
  const H = supabaseHeaders(SUPABASE_SERVICE_KEY);
  const select = ['id', 'token_created_at', 'created_at', ...RETURN_FIELDS].join(',');
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/students?access_token=eq.${encodeURIComponent(token)}&select=${select}`,
    { headers: H }
  );
  if (!res.ok) return { error: 'Database error', status: 500 };
  const rows = await res.json();
  if (!rows.length) return { error: 'Invalid token', status: 404 };
  const student = rows[0];

  const tokenDate = student.token_created_at || student.created_at;
  if (tokenDate) {
    const ageMs = Date.now() - new Date(tokenDate).getTime();
    if (ageMs > TOKEN_MAX_AGE_MS) {
      return { error: 'This link has expired. Please contact us for a new one.', status: 410 };
    }
  }
  return { student };
}

export const onRequestGet = withErrorHandling(async ({ request, env }) => {
  const rateLimitErr = await checkRateLimit(request);
  if (rateLimitErr) return rateLimitErr;

  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  if (!token) return errorResponse('Missing token', 400);

  const { student, error, status } = await loadStudentByToken(env, token);
  if (error) return errorResponse(error, status);

  const out = {};
  for (const f of RETURN_FIELDS) out[f] = student[f] ?? null;
  return jsonResponse(out);
}, 'intake-get');

export const onRequestPost = withErrorHandling(async ({ request, env }) => {
  const rateLimitErr = await checkRateLimit(request);
  if (rateLimitErr) return rateLimitErr;

  const { body, error: parseError } = await parseJsonBody(request);
  if (parseError) return parseError;

  const token = body.token;
  if (!token) return errorResponse('Missing token', 400);

  if (!body.first_name || !body.last_name) {
    return errorResponse('First name and last name are required', 400);
  }
  if (!['she/her', 'he/him', 'they/them', 'other', 'female', 'male'].includes(body.gender)) {
    return errorResponse('Pronouns are required', 400);
  }
  if (body.gender === 'other' && !body.gender_note) {
    return errorResponse('Please specify your pronouns', 400);
  }
  const missing = missingRequired(body, [
    'email',
    'phone',
    'street',
    'street_number',
    'postcode',
    'city',
    'emergency_contact',
    'ec_relationship',
    'ec_phone',
    'ec_email',
  ]);
  if (missing) return errorResponse(`${missing} is required`, 400);
  if (!emailValid(body.email)) return errorResponse('email must be valid', 400);
  if (!emailValid(body.ec_email)) return errorResponse('ec_email must be valid', 400);
  if (body.billing_separate) {
    const missingBilling = missingRequired(body, [
      'billing_name',
      'billing_email',
      'billing_phone',
      'billing_street',
      'billing_street_number',
      'billing_postcode',
      'billing_city',
    ]);
    if (missingBilling) return errorResponse(`${missingBilling} is required`, 400);
    if (!emailValid(body.billing_email)) return errorResponse('billing_email must be valid', 400);
  }

  const { student, error, status } = await loadStudentByToken(env, token);
  if (error) return errorResponse(error, status);

  const editable = [
    'first_name',
    'last_name',
    'gender',
    'gender_note',
    'email',
    'phone',
    'street',
    'street_number',
    'postcode',
    'city',
    'emergency_contact',
    'ec_relationship',
    'ec_phone',
    'ec_email',
  ];
  const update = {};
  for (const f of editable) {
    if (f in body) update[f] = body[f];
  }
  if (!['she/her', 'he/him', 'they/them', 'other', 'female', 'male'].includes(update.gender)) {
    update.gender = null;
    update.gender_note = null;
  } else if (update.gender !== 'other') {
    update.gender_note = null;
  }

  const billingFields = [
    'billing_name',
    'billing_email',
    'billing_phone',
    'billing_street',
    'billing_street_number',
    'billing_postcode',
    'billing_city',
  ];
  if (body.billing_separate) {
    for (const f of billingFields) {
      if (f in body) update[f] = body[f];
    }
    const streetLine = [update.billing_street, update.billing_street_number]
      .filter(Boolean)
      .join(' ');
    const cityLine = [update.billing_postcode, update.billing_city].filter(Boolean).join(' ');
    const derived = [streetLine, cityLine].filter(Boolean).join(', ');
    update.billing_address = derived || null;
  } else {
    for (const f of billingFields) update[f] = null;
    update.billing_address = null;
  }

  const { SUPABASE_URL, SUPABASE_SERVICE_KEY, RESEND_API_KEY } = env;
  const H = supabaseHeaders(SUPABASE_SERVICE_KEY);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/students?id=eq.${student.id}`, {
    method: 'PATCH',
    headers: H,
    body: JSON.stringify(update),
  });
  if (!res.ok) {
    console.error('Intake save error:', await res.text());
    return errorResponse('Database error');
  }

  // Best-effort: record completion timestamp (requires intake_completed_at column in students table)
  fetch(`${SUPABASE_URL}/rest/v1/students?id=eq.${student.id}`, {
    method: 'PATCH',
    headers: H,
    body: JSON.stringify({ intake_completed_at: new Date().toISOString() }),
  }).catch(() => {});

  // Best-effort: notify admin
  if (RESEND_API_KEY) {
    const studentName =
      [update.first_name || student.first_name, update.last_name || student.last_name]
        .filter(Boolean)
        .join(' ') || 'unknown';
    const studentEmail = update.email || student.email || '';
    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f8fb;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f8fb;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;max-width:560px;width:100%;">
        <tr><td style="background:#1a1a1a;padding:24px 40px;">
          <p style="margin:0;color:#d6eaf8;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;">intake form completed</p>
        </td></tr>
        <tr><td style="padding:32px 40px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #eee;">
            <tr>
              <td style="padding:6px 0;color:#888;font-size:13px;vertical-align:top;">Student</td>
              <td style="padding:6px 0 6px 20px;font-size:13px;">${studentName}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#888;font-size:13px;">Email</td>
              <td style="padding:6px 0 6px 20px;font-size:13px;">${studentEmail}</td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="padding:16px 40px 28px;border-top:1px solid #eee;">
          <a href="https://learningwithgioia.ch/admin/" style="font-size:12px;color:#888;">View in admin dashboard →</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [ADMIN_EMAIL],
        subject: `Intake form completed — ${studentName}`,
        html,
      }),
    }).catch(() => {});
  }

  return jsonResponse({ success: true });
}, 'intake-post');
