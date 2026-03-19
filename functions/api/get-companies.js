// functions/api/get-companies.js
// GET /api/get-companies?active=true
//
// Returns all companies, optionally filtered by active status.
// Each company includes a count of active courses and enrolled students.
// Used by the admin dashboard companies tab.
//
// Environment variables:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY, ADMIN_PASSWORD

import { supabaseHeaders, requireAdminAuth, jsonResponse, errorResponse } from './api/_utils.js';

export async function onRequestGet({ request, env }) {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;

  const authErr = requireAdminAuth(request, env);
  if (authErr) return authErr;

  const url    = new URL(request.url);
  const active = url.searchParams.get('active');

  let supabaseUrl = `${SUPABASE_URL}/rest/v1/companies?order=name.asc&select=*`;
  if (active === 'true')  supabaseUrl += '&active=eq.true';
  if (active === 'false') supabaseUrl += '&active=eq.false';

  const H = supabaseHeaders(SUPABASE_SERVICE_KEY);

  try {
    const res = await fetch(supabaseUrl, { headers: H });
    if (!res.ok) return errorResponse('Database error');

    const companies = await res.json();

    // ── Enrich each company with course + student counts ────────────────
    const enriched = await Promise.all(companies.map(async (company) => {
      const [coursesRes, studentsRes] = await Promise.all([
        fetch(
          `${SUPABASE_URL}/rest/v1/courses?company_id=eq.${company.id}&status=eq.active&select=id`,
          { headers: H }
        ),
        fetch(
          `${SUPABASE_URL}/rest/v1/students?company_id=eq.${company.id}&active=eq.true&select=id`,
          { headers: H }
        ),
      ]);

      const courses  = coursesRes.ok  ? await coursesRes.json()  : [];
      const students = studentsRes.ok ? await studentsRes.json() : [];

      return {
        ...company,
        active_courses_count: courses.length,
        active_students_count: students.length,
      };
    }));

    return jsonResponse(enriched);
  } catch (err) {
    console.error('Error:', err);
    return errorResponse('Connection error');
  }
}
