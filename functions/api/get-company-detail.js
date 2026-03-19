// functions/api/get-company-detail.js
// GET /api/get-company-detail?id=<uuid>
//
// Returns a single company with all its courses, enrolled students,
// and aggregate session/attendance stats. Used by the admin dashboard
// when viewing a corporate client profile.
//
// Environment variables:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY, ADMIN_PASSWORD

import { supabaseHeaders, requireAdminAuth } from './_utils.js';

export async function onRequestGet({ request, env }) {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;

  const authErr = requireAdminAuth(request, env);
  if (authErr) return authErr;

  const url = new URL(request.url);
  const id  = url.searchParams.get('id');
  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing id parameter' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const H = supabaseHeaders(SUPABASE_SERVICE_KEY);

  try {
    // ── Load company ────────────────────────────────────────────────────
    const compRes = await fetch(
      `${SUPABASE_URL}/rest/v1/companies?id=eq.${id}&select=*`,
      { headers: H }
    );
    const companies = await compRes.json();
    if (!companies.length) {
      return new Response(JSON.stringify({ error: 'Company not found' }), {
        status: 404, headers: { 'Content-Type': 'application/json' },
      });
    }
    const company = companies[0];

    // ── Load courses for this company ───────────────────────────────────
    const coursesRes = await fetch(
      `${SUPABASE_URL}/rest/v1/courses?company_id=eq.${id}&order=created_at.desc&select=*`,
      { headers: H }
    );
    const courses = coursesRes.ok ? await coursesRes.json() : [];

    // ── Load students for this company ──────────────────────────────────
    const studentsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/students?company_id=eq.${id}&order=last_name.asc&select=id,first_name,last_name,email,phone,current_level,active`,
      { headers: H }
    );
    const students = studentsRes.ok ? await studentsRes.json() : [];

    // ── Compute aggregate stats ─────────────────────────────────────────
    const activeCourses   = courses.filter(c => c.status === 'active');
    const totalSessions   = courses.reduce((sum, c) => sum + (c.sessions_completed || 0), 0);
    const totalPlanned    = courses.reduce((sum, c) => sum + (c.sessions_total || 0), 0);
    const activeStudents  = students.filter(s => s.active);

    return new Response(JSON.stringify({
      ...company,
      courses,
      students,
      stats: {
        active_courses:   activeCourses.length,
        total_courses:    courses.length,
        active_students:  activeStudents.length,
        total_students:   students.length,
        sessions_completed: totalSessions,
        sessions_planned:   totalPlanned,
      },
    }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Error:', err);
    return new Response(JSON.stringify({ error: 'Connection error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
