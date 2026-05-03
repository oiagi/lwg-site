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

const TOKEN_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

const RETURN_FIELDS = [
  'first_name',
  'last_name',
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

  const { student, error, status } = await loadStudentByToken(env, token);
  if (error) return errorResponse(error, status);

  const editable = [
    'first_name',
    'last_name',
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

  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;
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
  return jsonResponse({ success: true });
}, 'intake-post');
