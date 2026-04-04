// functions/api/get-courses.js
// GET /api/get-courses?status=active
//
// Returns courses with sessions and enrolled students.
// Uses batch queries instead of per-course fetching to avoid N+1.

import {
  supabaseHeaders,
  requireAdminAuth,
  listResponse,
  errorResponse,
  withErrorHandling,
} from './_utils.js';

export const onRequestGet = withErrorHandling(async ({ request, env }) => {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;

  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  const url = new URL(request.url);
  const status = url.searchParams.get('status') || 'all';
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '50', 10), 1), 200);
  const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10), 0);

  let coursesUrl = `${SUPABASE_URL}/rest/v1/courses?order=created_at.desc&limit=${limit}&offset=${offset}&select=*`;
  if (status !== 'all') coursesUrl += `&status=eq.${status}`;

  const H = supabaseHeaders(SUPABASE_SERVICE_KEY);

  try {
    const res = await fetch(coursesUrl, { headers: { ...H, Prefer: 'count=exact' } });
    if (!res.ok) return errorResponse('Database error');

    const contentRange = res.headers.get('Content-Range');
    const total = contentRange ? parseInt(contentRange.split('/')[1] || '0', 10) : 0;

    const courses = await res.json();
    if (!courses.length) return listResponse([], { total: 0, limit, offset });

    // ── Batch fetch sessions and enrolments for all courses ────────────
    const courseIds = courses.map((c) => c.id);
    const courseFilter = courseIds.map((id) => `course_id.eq.${id}`).join(',');

    const [sessRes, enrolRes] = await Promise.all([
      fetch(
        `${SUPABASE_URL}/rest/v1/sessions?or=(${courseFilter})&status=neq.cancelled&order=scheduled_at.asc&select=*`,
        { headers: H }
      ),
      fetch(`${SUPABASE_URL}/rest/v1/enrolments?or=(${courseFilter})&select=student_id,course_id`, {
        headers: H,
      }),
    ]);

    const allSessions = sessRes.ok ? await sessRes.json() : [];
    const allEnrolments = enrolRes.ok ? await enrolRes.json() : [];

    // ── Batch fetch all unique students ────────────────────────────────
    const studentIds = [...new Set(allEnrolments.map((e) => e.student_id))];
    let allStudents = [];
    if (studentIds.length) {
      const studentFilter = studentIds.map((id) => `id.eq.${id}`).join(',');
      const studRes = await fetch(
        `${SUPABASE_URL}/rest/v1/students?or=(${studentFilter})&select=id,first_name,last_name,email,phone,current_level,progress_notes,access_token`,
        { headers: H }
      );
      allStudents = studRes.ok ? await studRes.json() : [];
    }

    // ── Index data by course_id for fast lookup ───────────────────────
    const sessionsByCourse = {};
    for (const s of allSessions) {
      (sessionsByCourse[s.course_id] ||= []).push(s);
    }

    const studentIdsByCourse = {};
    for (const e of allEnrolments) {
      (studentIdsByCourse[e.course_id] ||= new Set()).add(e.student_id);
    }

    const studentsById = {};
    for (const s of allStudents) {
      studentsById[s.id] = s;
    }

    // ── Enrich courses ────────────────────────────────────────────────
    const enriched = courses.map((course) => ({
      ...course,
      sessions: sessionsByCourse[course.id] || [],
      students: [...(studentIdsByCourse[course.id] || [])]
        .map((id) => studentsById[id])
        .filter(Boolean),
    }));

    return listResponse(enriched, { total, limit, offset });
  } catch (err) {
    console.error('get-courses error:', err);
    return errorResponse('Connection error');
  }
}, 'get-courses');
