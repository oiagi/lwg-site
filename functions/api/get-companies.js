// functions/api/get-companies.js
// GET /api/get-companies
//
// Returns all companies with their booking_code, plus the students
// associated with each company (id, first_name, last_name, email).
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

export const onRequestGet = withErrorHandling(async ({ request, env }) => {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;

  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  const H = supabaseHeaders(SUPABASE_SERVICE_KEY);

  const [compRes, studRes] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/companies?select=id,name,booking_code&order=name.asc`, {
      headers: H,
    }),
    fetch(
      `${SUPABASE_URL}/rest/v1/students?select=id,first_name,last_name,email,company_id&company_id=not.is.null&order=last_name.asc,first_name.asc`,
      { headers: H }
    ),
  ]);

  if (!compRes.ok) return errorResponse('Database error loading companies');

  const companies = await compRes.json();
  const students = studRes.ok ? await studRes.json() : [];

  const studentsByCompany = {};
  for (const s of students) {
    (studentsByCompany[s.company_id] ||= []).push({
      id: s.id,
      first_name: s.first_name,
      last_name: s.last_name,
      email: s.email,
    });
  }

  const result = companies.map((c) => ({
    ...c,
    students: studentsByCompany[c.id] || [],
  }));

  return jsonResponse(result);
}, 'get-companies');
