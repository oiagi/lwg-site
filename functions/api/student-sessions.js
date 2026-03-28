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

import { supabaseHeaders, jsonResponse, errorResponse, withErrorHandling } from './_utils.js';

export const onRequestGet = withErrorHandling(async ({ request, env }) => {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;

  const H = supabaseHeaders(SUPABASE_SERVICE_KEY);

  const url   = new URL(request.url);
  const token = url.searchParams.get('token');

  if (!token) return errorResponse('Missing token', 400);

  // ── Find student by access token ─────────────────────────────────────
  const studentRes = await fetch(
    `${SUPABASE_URL}/rest/v1/students?access_token=eq.${token}&select=id,first_name,last_name,current_level,token_created_at,created_at`,
    { headers: H }
  );
  if (!studentRes.ok) return errorResponse('Database error');
  const students = await studentRes.json();
  if (!students.length) return errorResponse('Invalid token', 404);
  const student = students[0];

  // ── Token expiry check (90 days) ──────────────────────────────────
  const tokenDate = student.token_created_at || student.created_at;
  if (tokenDate) {
    const ageMs    = Date.now() - new Date(tokenDate).getTime();
    const maxAgeMs = 90 * 24 * 60 * 60 * 1000;
    if (ageMs > maxAgeMs) {
      return errorResponse('This link has expired. Please contact us for a new one.', 410);
    }
  }

  // ── Load enrolments → courses → sessions ─────────────────────────────
  const enrolRes = await fetch(
    `${SUPABASE_URL}/rest/v1/enrolments?student_id=eq.${student.id}&select=course_id`,
    { headers: H }
  );
  if (!enrolRes.ok) return errorResponse('Database error');
  const enrolments = await enrolRes.json();
  const courseIds  = enrolments.map(e => e.course_id);

  if (!courseIds.length) {
    return jsonResponse({
      student: { firstName: student.first_name, lastName: student.last_name, level: student.current_level },
      courses: [],
    });
  }

  // ── Batch load courses and sessions ──────────────────────────────────
  const courseFilter = courseIds.map(id => `id.eq.${id}`).join(',');
  const [coursesRes, sessRes] = await Promise.all([
    fetch(
      `${SUPABASE_URL}/rest/v1/courses?or=(${courseFilter})&select=id,course_code,service,level,sessions_total,sessions_completed,status`,
      { headers: H }
    ),
    fetch(
      `${SUPABASE_URL}/rest/v1/sessions?or=(${courseFilter.replace(/id\.eq\./g, 'course_id.eq.')})&order=scheduled_at.asc&select=id,course_id,scheduled_at,status,duration_minutes`,
      { headers: H }
    ),
  ]);

  const courses  = coursesRes.ok ? await coursesRes.json() : [];
  const sessions = sessRes.ok    ? await sessRes.json()    : [];

  // ── Group sessions by course ─────────────────────────────────────────
  const sessionsByCourse = {};
  for (const s of sessions) {
    (sessionsByCourse[s.course_id] ||= []).push(s);
  }

  const enriched = courses.map(course => ({
    ...course,
    sessions: sessionsByCourse[course.id] || [],
  }));

  return jsonResponse({
    student: {
      firstName: student.first_name,
      lastName:  student.last_name,
      level:     student.current_level,
    },
    courses: enriched,
  });
}, 'student-sessions');
