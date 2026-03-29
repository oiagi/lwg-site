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

  const H = { ...supabaseHeaders(SUPABASE_SERVICE_KEY), Prefer: 'return=representation' };

  // Fields allowed in the payload
  const fields = [
    'first_name',
    'last_name',
    'email',
    'phone',
    'postcode',
    'current_level',
    'progress_notes',
    'company_id',
    'active',
    'source',
    'billing_name',
    'billing_address',
    'billing_email',
    'rate_per_session',
    'currency',
    'vat_number',
    'date_of_birth',
    'nationality',
    'native_language',
    'target_language',
    'learning_goals',
    'emergency_contact',
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
      if (data.active === undefined) data.active = true;

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
