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
} from './_utils.js';

export const onRequestPost = withErrorHandling(async ({ request, env }) => {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;

  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON', 400);
  }

  if (!body.first_name || !body.last_name) {
    return errorResponse('First name and last name are required', 400);
  }

  // ── Status-wins precedence ───────────────────────────────────────────
  // If only `active` (boolean) was sent by an old caller, derive status from it.
  // If `status` was sent, it wins. Either way, we dual-write both fields.
  if (body.status === undefined && body.active !== undefined) {
    body.status = body.active ? 'active' : 'inactive';
  }

  const H = { ...supabaseHeaders(SUPABASE_SERVICE_KEY), Prefer: 'return=representation' };

  // Fields allowed in the payload (active is excluded — derived from status below)
  const fields = [
    'first_name',
    'last_name',
    'email',
    'phone',
    'address_line1',
    'address_line2',
    'address_city',
    'postcode',
    'address_country',
    'current_level',
    'progress_notes',
    'company_id',
    'status',
    'source',
    'billing_name',
    'billing_same_as_student',
    'billing_address_line1',
    'billing_address_line2',
    'billing_city',
    'billing_postcode',
    'billing_country',
    'billing_address',
    'billing_email',
    'rate_per_session',
    'currency',
    'vat_number',
    'nationality',
    'native_language',
    'target_language',
    'learning_goals',
    'emergency_contact',
    'emergency_contact_name',
    'emergency_contact_phone',
    'emergency_contact_email',
    'emergency_contact_relation',
    'desired_start_date',
    'referral_source',
    'payment_method',
    'course_type',
    'course_format',
    'location',
    'consent_given',
    'consent_date',
  ];
  const data = {};
  for (const f of fields) {
    if (body[f] !== undefined) data[f] = body[f];
  }
  if (data.emergency_contact === undefined) {
    data.emergency_contact = [
      data.emergency_contact_name,
      data.emergency_contact_relation,
      data.emergency_contact_phone,
      data.emergency_contact_email,
    ]
      .filter(Boolean)
      .join(' | ');
  }
  if (data.billing_address === undefined) {
    data.billing_address = [
      data.billing_address_line1,
      data.billing_address_line2,
      [data.billing_postcode, data.billing_city].filter(Boolean).join(' '),
      data.billing_country,
    ]
      .filter(Boolean)
      .join(', ');
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
      // Generate access_token for the student portal / intake form link
      data.access_token = crypto.randomUUID();
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
