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
      `${SUPABASE_URL}/rest/v1/students?access_token=eq.${token}&select=first_name,last_name,email,phone,street,street_number,postcode,city,emergency_contact,ec_phone,ec_email,ec_relationship,service,current_level,course_type,course_format,location,billing_name,billing_address,billing_street,billing_street_number,billing_postcode,billing_city,billing_email,billing_phone,payment_method,token_created_at,created_at`,
      { headers: H }
    );
    if (!res.ok) return errorResponse('Database error');

    const students = await res.json();
    if (!students.length) return errorResponse('Student not found', 404);

    const student = students[0];

    // Strip internal date fields before returning
    const { token_created_at: _t, created_at: _c, ...formData } = student;
    return jsonResponse(formData);
  } catch (err) {
    console.error('Error:', err);
    return errorResponse('Connection error');
  }
}, 'get-intake');
