// functions/api/company-intake.js
// GET  /api/company-intake?code=<company_intake_code>  -> company intake metadata
// POST /api/company-intake                             -> create/update student for company
//
// Public endpoint. The company intake code acts as the credential.

import {
  supabaseHeaders,
  jsonResponse,
  errorResponse,
  withErrorHandling,
  checkRateLimit,
  parseJsonBody,
} from './_utils.js';

const RETURN_COMPANY_FIELDS = 'id,name,intake_code';
const STUDENT_RETURN_FIELDS =
  'id,first_name,last_name,email,phone,company_id,source,status,intake_completed_at';

function emailValid(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ''));
}

function missingRequired(body, fields) {
  return fields.find((field) => !body[field]);
}

function normalizeGender(data, field = 'gender', noteField = 'gender_note') {
  if (!['female', 'male', 'other'].includes(data[field])) {
    data[field] = null;
    data[noteField] = null;
  } else if (data[field] !== 'other') {
    data[noteField] = null;
  }
}

function buildBillingAddress(data) {
  const streetLine = [data.billing_street, data.billing_street_number].filter(Boolean).join(' ');
  const cityLine = [data.billing_postcode, data.billing_city].filter(Boolean).join(' ');
  return [streetLine, cityLine].filter(Boolean).join(', ');
}

async function loadCompanyByCode(env, code) {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;
  const H = supabaseHeaders(SUPABASE_SERVICE_KEY);
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/companies?intake_code=eq.${encodeURIComponent(code)}&select=${RETURN_COMPANY_FIELDS}`,
    { headers: H }
  );
  if (!res.ok) {
    console.error('Company intake lookup error:', await res.text());
    return { error: 'Database error', status: 500 };
  }
  const rows = await res.json();
  if (!rows.length) return { error: 'Invalid company intake link', status: 404 };
  return { company: rows[0] };
}

function buildStudentPayload(body, companyId) {
  const data = {
    first_name: body.first_name,
    last_name: body.last_name,
    gender: body.gender,
    gender_note: body.gender_note || null,
    email: body.email,
    phone: body.phone,
    street: body.street,
    street_number: body.street_number,
    postcode: body.postcode,
    city: body.city,
    emergency_contact: body.emergency_contact,
    ec_relationship: body.ec_relationship,
    ec_phone: body.ec_phone,
    ec_email: body.ec_email,
    company_id: companyId,
    intake_completed_at: new Date().toISOString(),
  };

  normalizeGender(data);

  const billingFields = [
    'billing_name',
    'billing_gender',
    'billing_gender_note',
    'billing_email',
    'billing_phone',
    'billing_street',
    'billing_street_number',
    'billing_postcode',
    'billing_city',
  ];

  if (body.billing_separate) {
    for (const field of billingFields) data[field] = body[field] || null;
    normalizeGender(data, 'billing_gender', 'billing_gender_note');
    data.billing_address = buildBillingAddress(data) || null;
  } else {
    for (const field of billingFields) data[field] = null;
    data.billing_address = null;
  }

  return data;
}

export const onRequestGet = withErrorHandling(async ({ request, env }) => {
  const rateLimitErr = await checkRateLimit(request, { maxRequests: 20 });
  if (rateLimitErr) return rateLimitErr;

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  if (!code) return errorResponse('Missing company intake code', 400);

  const { company, error, status } = await loadCompanyByCode(env, code);
  if (error) return errorResponse(error, status);

  return jsonResponse({ company_name: company.name });
}, 'company-intake-get');

export const onRequestPost = withErrorHandling(async ({ request, env }) => {
  const rateLimitErr = await checkRateLimit(request, { maxRequests: 10 });
  if (rateLimitErr) return rateLimitErr;

  const { body, error: parseError } = await parseJsonBody(request);
  if (parseError) return parseError;

  const code = body.company_code;
  if (!code) return errorResponse('Missing company intake code', 400);

  if (!body.first_name || !body.last_name) {
    return errorResponse('First name and last name are required', 400);
  }
  if (!['female', 'male', 'other'].includes(body.gender)) {
    return errorResponse('Salutation is required', 400);
  }
  if (body.gender === 'other' && !body.gender_note) {
    return errorResponse('Please specify your salutation', 400);
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
      'billing_gender',
      'billing_email',
      'billing_street',
      'billing_street_number',
      'billing_postcode',
      'billing_city',
    ]);
    if (missingBilling) return errorResponse(`${missingBilling} is required`, 400);
    if (!['female', 'male', 'other'].includes(body.billing_gender)) {
      return errorResponse('Billing salutation is required', 400);
    }
    if (body.billing_gender === 'other' && !body.billing_gender_note) {
      return errorResponse('Please specify the billing salutation', 400);
    }
    if (!emailValid(body.billing_email)) return errorResponse('billing_email must be valid', 400);
  }

  const { company, error, status } = await loadCompanyByCode(env, code);
  if (error) return errorResponse(error, status);

  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;
  const H = { ...supabaseHeaders(SUPABASE_SERVICE_KEY), Prefer: 'return=representation' };
  const data = buildStudentPayload(body, company.id);

  const existingRes = await fetch(
    `${SUPABASE_URL}/rest/v1/students?email=eq.${encodeURIComponent(body.email)}&select=id`,
    { headers: supabaseHeaders(SUPABASE_SERVICE_KEY) }
  );
  if (!existingRes.ok) {
    console.error('Company intake student lookup error:', await existingRes.text());
    return errorResponse('Database error');
  }
  const existing = await existingRes.json();

  let res;
  if (existing.length) {
    res = await fetch(`${SUPABASE_URL}/rest/v1/students?id=eq.${existing[0].id}`, {
      method: 'PATCH',
      headers: H,
      body: JSON.stringify(data),
    });
  } else {
    res = await fetch(`${SUPABASE_URL}/rest/v1/students?select=${STUDENT_RETURN_FIELDS}`, {
      method: 'POST',
      headers: H,
      body: JSON.stringify({
        ...data,
        source: 'company_intake',
        status: 'prospect',
        active: false,
        access_token: crypto.randomUUID(),
        token_created_at: new Date().toISOString(),
      }),
    });
  }

  if (!res.ok) {
    console.error('Company intake save error:', await res.text());
    return errorResponse('Database error');
  }

  const rows = await res.json();
  return jsonResponse({ student: rows[0] || null, company_name: company.name });
}, 'company-intake-post');
