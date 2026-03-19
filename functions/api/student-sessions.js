// functions/api/student-sessions.js
// GET /api/student-sessions?token=<access_token>
//
// Returns a student's upcoming and completed sessions across all
// their enrolments. No password required — the access token acts
// as the credential (hard-to-guess UUID per student).
//
// Used by the student-facing session page at /sessions.html?token=...
//
// Environment variables:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY

import { supabaseHeaders, jsonResponse, errorResponse } from './_utils.js';

export async function onRequestGet({ request, env }) {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;

  const H = supabaseHeaders(SUPABASE_SERVICE_KEY);

  const url   = new URL(request.url);
  const token = url.searchParams.get('token');

  if (!token) return errorResponse('Missing token', 400);

  // ── Find student by access token ─────────────────────────────────────
  const studentRes = await fetch(
    `${SUPABASE_URL}/rest/v1/students?access_token=eq.${token}&select=id,first_name,last_name,current_level`,
    { headers: H }
  );
  const students = await studentRes.json();
  if (!students.length) return errorResponse('Invalid token', 404);
  const student = students[0];

  // ── Load enrolments → courses → sessions ─────────────────────────────
  const enrolRes = await fetch(
    `${SUPABASE_URL}/rest/v1/enrolments?student_id=eq.${student.id}&select=course_id`,
    { headers: H }
  );
  const enrolments = await enrolRes.json();
  const courseIds  = enrolments.map(e => e.course_id);

  if (!courseIds.length) {
    return jsonResponse({
      student: { firstName: student.first_name, lastName: student.last_name, level: student.current_level },
      courses: [],
    });
  }

  // ── Load courses ──────────────────────────────────────────────────────
  const courseFilter = courseIds.map(id => `id.eq.${id}`).join(',');
  const coursesRes   = await fetch(
    `${SUPABASE_URL}/rest/v1/courses?or=(${courseFilter})&select=id,course_code,service,level,sessions_total,sessions_completed,status`,
    { headers: H }
  );
  const courses = await coursesRes.json();

  // ── Load sessions for each course ────────────────────────────────────
  const enriched = await Promise.all(courses.map(async (course) => {
    const sessRes = await fetch(
      `${SUPABASE_URL}/rest/v1/sessions?course_id=eq.${course.id}&order=scheduled_at.asc&select=id,scheduled_at,status,duration_minutes`,
      { headers: H }
    );
    const sessions = sessRes.ok ? await sessRes.json() : [];
    return { ...course, sessions };
  }));

  return jsonResponse({
    student: {
      firstName: student.first_name,
      lastName:  student.last_name,
      level:     student.current_level,
    },
    courses: enriched,
  });
}
