// functions/api/save-student.js
// POST /api/save-student
// Body: { id?, first_name, last_name, email?, phone?, ... }
//
// Creates a new student or updates an existing one.
// If `id` is provided, the record is patched; otherwise a new row is inserted.
// On create, auto-generates access_token via gen_random_uuid().
//
// Environment variables:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY

import {
  supabaseHeaders,
  requireAdminAuth,
  jsonResponse,
  errorResponse,
  withErrorHandling,
  parseJsonBody,
  pickDefined,
} from './_utils.js';

const STUDENT_FIELDS = [
  'first_name',
  'last_name',
  'email',
  'phone',
  'postcode',
  'street',
  'street_number',
  'city',
  'current_level',
  'progress_notes',
  'company_id',
  'status',
  'source',
  'billing_name',
  'billing_address',
  'billing_street',
  'billing_street_number',
  'billing_postcode',
  'billing_city',
  'billing_email',
  'rate_per_session',
  'currency',
  'vat_number',
  'nationality',
  'native_language',
  'target_language',
  'learning_goals',
  'emergency_contact',
  'ec_phone',
  'ec_email',
  'ec_relationship',
  'desired_start_date',
  'referral_source',
  'payment_method',
  'course_type',
  'course_format',
  'location',
  'service',
  'grade',
  'subjects',
  'consent_given',
  'consent_date',
  'token_created_at',
  'access_token',
];

const BILLING_ADDRESS_FIELDS = [
  'billing_street',
  'billing_street_number',
  'billing_postcode',
  'billing_city',
];

function buildBillingAddress(data) {
  const streetLine = [data.billing_street, data.billing_street_number].filter(Boolean).join(' ');
  const cityLine = [data.billing_postcode, data.billing_city].filter(Boolean).join(' ');
  return [streetLine, cityLine].filter(Boolean).join(', ');
}

export const onRequestPost = withErrorHandling(async ({ request, env }) => {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;

  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  const { body, error } = await parseJsonBody(request);
  if (error) return error;

  if (!body.id && (!body.first_name || !body.last_name)) {
    return errorResponse('First name and last name are required', 400);
  }

  // ── Status-wins precedence ───────────────────────────────────────────
  // If only `active` (boolean) was sent by an old caller, derive status from it.
  // If `status` was sent, it wins. Either way, we dual-write both fields.
  if (body.status === undefined && body.active !== undefined) {
    body.status = body.active ? 'active' : 'inactive';
  }

  const H = { ...supabaseHeaders(SUPABASE_SERVICE_KEY), Prefer: 'return=representation' };

  // active is excluded from allowed fields because it is derived from status below.
  const data = pickDefined(body, STUDENT_FIELDS);

  // Derive billing_address for PDF/invoice compat whenever split billing fields are updated
  if (BILLING_ADDRESS_FIELDS.some((k) => k in data)) {
    const derived = buildBillingAddress(data);
    if (derived) data.billing_address = derived;
  }

  // Dual-write: always keep active in sync with status during migration
  if (data.status !== undefined) {
    data.active = data.status === 'active';
  }

  try {
    let res;
    if (body.id) {
      // ── Update existing student ──────────────────────────────────────
      res = await fetch(`${SUPABASE_URL}/rest/v1/students?id=eq.${body.id}`, {
        method: 'PATCH',
        headers: H,
        body: JSON.stringify(data),
      });
    } else {
      // ── Create new student ───────────────────────────────────────────
      // Generate access_token for the student sessions portal link
      data.access_token = crypto.randomUUID();
      data.token_created_at = new Date().toISOString();
      if (!data.source) data.source = 'manual';
      if (data.status === undefined) {
        data.status = 'active';
        data.active = true;
      }

      res = await fetch(`${SUPABASE_URL}/rest/v1/students`, {
        method: 'POST',
        headers: H,
        body: JSON.stringify(data),
      });
    }

    if (!res.ok) {
      console.error('Student save error:', await res.text());
      return errorResponse('Database error');
    }

    const rows = await res.json();
    return jsonResponse(rows[0] || {});
  } catch (err) {
    console.error('Error:', err);
    return errorResponse('Connection error');
  }
}, 'save-student');
