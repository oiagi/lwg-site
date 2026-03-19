// functions/api/get-courses.js
// GET /api/get-courses?status=active
//
// Returns courses with sessions and enrolled students.
// Used by the admin dashboard courses tab.
//
// Environment variables:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY, ADMIN_PASSWORD

import { supabaseHeaders, requireAdminAuth, jsonResponse, errorResponse } from './_utils.js';

export async function onRequestGet({ request, env }) {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;

  const authErr = requireAdminAuth(request, env);
  if (authErr) return authErr;

  const url    = new URL(request.url);
  const status = url.searchParams.get('status') || 'all';

  let supabaseUrl = `${SUPABASE_URL}/rest/v1/courses?order=created_at.desc&select=*`;
  if (status !== 'all') supabaseUrl += `&status=eq.${status}`;

  const H = supabaseHeaders(SUPABASE_SERVICE_KEY);

  try {
    const res = await fetch(supabaseUrl, { headers: H });
    if (!res.ok) return errorResponse('Database error');

    const courses = await res.json();

    // ── Enrich each course with sessions and enrolled students ──────────
    const enriched = await Promise.all(courses.map(async (course) => {
      const [sessRes, enrolRes] = await Promise.all([
        fetch(
          `${SUPABASE_URL}/rest/v1/sessions?course_id=eq.${course.id}&status=neq.cancelled&order=scheduled_at.asc&select=*`,
          { headers: H }
        ),
        fetch(
          `${SUPABASE_URL}/rest/v1/enrolments?course_id=eq.${course.id}&select=student_id`,
          { headers: H }
        ),
      ]);

      const sessions   = sessRes.ok  ? await sessRes.json()  : [];
      const enrolments = enrolRes.ok ? await enrolRes.json() : [];
      const studentIds = enrolments.map(e => e.student_id);

      // Load student records
      let students = [];
      if (studentIds.length) {
        const filter  = studentIds.map(id => `id.eq.${id}`).join(',');
        const studRes = await fetch(
          `${SUPABASE_URL}/rest/v1/students?or=(${filter})&select=id,first_name,last_name,email,phone,current_level,progress_notes,access_token`,
          { headers: H }
        );
        students = studRes.ok ? await studRes.json() : [];
      }

      return { ...course, sessions, students };
    }));

    return jsonResponse(enriched);
  } catch (err) {
    console.error('Error:', err);
    return errorResponse('Connection error');
  }
}
