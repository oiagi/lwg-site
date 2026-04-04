// functions/api/get-intake.js
// GET /api/get-intake?token=<uuid>
//
// Public endpoint (no admin auth). Returns student fields for pre-filling
// the intake form. Only returns fields relevant to the form, not internal
// admin fields like progress_notes.
//
// Environment variables:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY

import {
  supabaseHeaders,
  jsonResponse,
  errorResponse,
  withErrorHandling,
  validateOrigin,
  checkRateLimit,
} from './_utils.js';

export const onRequestGet = withErrorHandling(async ({ request, env }) => {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;

  const originErr = validateOrigin(request, env);
  if (originErr) return originErr;

  const rateLimitErr = await checkRateLimit(request);
  if (rateLimitErr) return rateLimitErr;

  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  if (!token) return errorResponse('Missing token', 400);

  const H = supabaseHeaders(SUPABASE_SERVICE_KEY);

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/students?access_token=eq.${token}&select=first_name,last_name,email,phone,nationality,address_line1,address_line2,address_city,postcode,address_country,emergency_contact_name,emergency_contact_phone,emergency_contact_email,emergency_contact_relation,native_language,target_language,current_level,learning_goals,desired_start_date,course_type,course_format,location,billing_name,billing_same_as_student,billing_address_line1,billing_address_line2,billing_city,billing_postcode,billing_country,billing_address,billing_email,payment_method,referral_source,token_created_at,created_at`,
      { headers: H }
    );
    if (!res.ok) return errorResponse('Database error');

    const students = await res.json();
    if (!students.length) return errorResponse('Student not found', 404);

    // Strip internal date fields before returning
    const formData = { ...students[0] };
    delete formData.token_created_at;
    delete formData.created_at;
    return jsonResponse(formData);
  } catch (err) {
    console.error('Error:', err);
    return errorResponse('Connection error');
  }
}, 'get-intake');
