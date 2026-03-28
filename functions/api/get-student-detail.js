// functions/api/get-student-detail.js
// GET /api/get-student-detail?id=<uuid>
//
// Returns a single student with all fields, their enrolled courses,
// and company info. Used by the admin dashboard when viewing or
// editing a student.
//
// Environment variables:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY

import { supabaseHeaders, requireAdminAuth, jsonResponse, errorResponse } from './_utils.js';

export async function onRequestGet({ request, env }) {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;

  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return errorResponse('Missing id parameter', 400);

  const H = supabaseHeaders(SUPABASE_SERVICE_KEY);

  try {
    // ── Load student ────────────────────────────────────────────────────
    const stuRes = await fetch(`${SUPABASE_URL}/rest/v1/students?id=eq.${id}&select=*`, {
      headers: H,
    });
    const students = await stuRes.json();
    if (!students.length) return errorResponse('Student not found', 404);
    const student = students[0];

    // ── Load enrolments + courses ───────────────────────────────────────
    const enrolRes = await fetch(
      `${SUPABASE_URL}/rest/v1/enrolments?student_id=eq.${id}&select=course_id`,
      { headers: H }
    );
    const enrolments = enrolRes.ok ? await enrolRes.json() : [];
    const courseIds = enrolments.map((e) => e.course_id);

    let courses = [];
    if (courseIds.length) {
      const courseFilter = courseIds.map((cid) => `id.eq.${cid}`).join(',');
      const courseRes = await fetch(
        `${SUPABASE_URL}/rest/v1/courses?or=(${courseFilter})&select=id,course_code,service,level,status,sessions_total,sessions_completed`,
        { headers: H }
      );
      courses = courseRes.ok ? await courseRes.json() : [];
    }

    // ── Load company name if applicable ─────────────────────────────────
    let company_name = null;
    if (student.company_id) {
      const compRes = await fetch(
        `${SUPABASE_URL}/rest/v1/companies?id=eq.${student.company_id}&select=id,name`,
        { headers: H }
      );
      const comps = compRes.ok ? await compRes.json() : [];
      if (comps.length) company_name = comps[0].name;
    }

    return jsonResponse({
      ...student,
      company_name,
      courses,
    });
  } catch (err) {
    console.error('Error:', err);
    return errorResponse('Connection error');
  }
}
