// functions/api/get-intake.js
// GET /api/get-intake?token=<uuid>
//
// Public endpoint (no admin auth). Returns student fields for pre-filling
// the intake form. Only returns fields relevant to the form, not internal
// admin fields like progress_notes.
//
// Environment variables:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY

import { supabaseHeaders, jsonResponse, errorResponse, withErrorHandling } from './_utils.js';

export const onRequestGet = withErrorHandling(async ({ request, env }) => {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;

  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  if (!token) return errorResponse('Missing token', 400);

  const H = supabaseHeaders(SUPABASE_SERVICE_KEY);

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/students?access_token=eq.${token}&select=first_name,last_name,email,phone,nationality,street,street_number,postcode,city,emergency_contact,ec_phone,ec_email,ec_relationship,native_language,target_language,current_level,learning_goals,desired_start_date,course_type,course_format,location,billing_name,billing_address,billing_street,billing_street_number,billing_postcode,billing_city,billing_email,payment_method,referral_source,token_created_at,created_at`,
      { headers: H }
    );
    if (!res.ok) return errorResponse('Database error');

    const students = await res.json();
    if (!students.length) return errorResponse('Student not found', 404);

    // ── Token expiry check (90 days) ──────────────────────────────────
    const student = students[0];
    const tokenDate = student.token_created_at || student.created_at;
    if (tokenDate) {
      const ageMs = Date.now() - new Date(tokenDate).getTime();
      const maxAgeMs = 90 * 24 * 60 * 60 * 1000;
      if (ageMs > maxAgeMs) {
        return errorResponse('This link has expired. Please contact us for a new one.', 410);
      }
    }

    // Strip internal date fields before returning
    const { token_created_at: _t, created_at: _c, ...formData } = student;
    return jsonResponse(formData);
  } catch (err) {
    console.error('Error:', err);
    return errorResponse('Connection error');
  }
}, 'get-intake');
