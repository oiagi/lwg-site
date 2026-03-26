// functions/api/get-students.js
// GET /api/get-students?active=true|false|all
//
// Returns all students, optionally filtered by active status.
// Each student includes a count of enrolled courses.
// Used by the admin dashboard students tab.
//
// Environment variables:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY

import { supabaseHeaders, requireAdminAuth, jsonResponse, errorResponse } from './_utils.js';

export async function onRequestGet({ request, env }) {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;

  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  const url    = new URL(request.url);
  const active = url.searchParams.get('active');

  let supabaseUrl = `${SUPABASE_URL}/rest/v1/students?order=last_name.asc,first_name.asc&select=id,first_name,last_name,email,phone,current_level,active,company_id,source,created_at`;
  if (active === 'true')  supabaseUrl += '&active=eq.true';
  if (active === 'false') supabaseUrl += '&active=eq.false';

  const H = supabaseHeaders(SUPABASE_SERVICE_KEY);

  try {
    const res = await fetch(supabaseUrl, { headers: H });
    if (!res.ok) return errorResponse('Database error');

    const students = await res.json();

    // ── Enrich with course counts and company name ──────────────────────
    // Load all companies for name lookup
    const compRes = await fetch(
      `${SUPABASE_URL}/rest/v1/companies?select=id,name`,
      { headers: H }
    );
    const companies = compRes.ok ? await compRes.json() : [];
    const companyMap = {};
    companies.forEach(c => { companyMap[c.id] = c.name; });

    // Load all enrolments for course counts
    const enrolRes = await fetch(
      `${SUPABASE_URL}/rest/v1/enrolments?select=student_id,course_id`,
      { headers: H }
    );
    const enrolments = enrolRes.ok ? await enrolRes.json() : [];
    const courseCountMap = {};
    enrolments.forEach(e => {
      courseCountMap[e.student_id] = (courseCountMap[e.student_id] || 0) + 1;
    });

    const enriched = students.map(s => ({
      ...s,
      company_name: s.company_id ? (companyMap[s.company_id] || '—') : null,
      course_count: courseCountMap[s.id] || 0,
    }));

    return jsonResponse(enriched);
  } catch (err) {
    console.error('Error:', err);
    return errorResponse('Connection error');
  }
}
