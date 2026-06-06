// functions/api/get-teacher-availability.js
// GET /api/get-teacher-availability?teacher_id=<uuid>&days=14
//
// Returns a teacher's scheduled sessions for the next N days,
// grouped by date. Uses existing session data from the database.
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

const HIDDEN_TEACHER_NAMES = new Set(['test teacher']);

function visibleTeachers(teachers) {
  return teachers.filter(
    (teacher) =>
      !HIDDEN_TEACHER_NAMES.has(
        String(teacher.name || '')
          .trim()
          .toLowerCase()
      )
  );
}

export const onRequestGet = withErrorHandling(async ({ request, env }) => {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;

  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  const url = new URL(request.url);
  const teacherId = url.searchParams.get('teacher_id');
  const days = parseInt(url.searchParams.get('days') || '14', 10);

  const H = supabaseHeaders(SUPABASE_SERVICE_KEY);

  try {
    // If no teacher specified, return all teachers with session counts
    if (!teacherId) {
      const teachRes = await fetch(
        `${SUPABASE_URL}/rest/v1/teachers?active=eq.true&select=id,name`,
        { headers: H }
      );
      if (!teachRes.ok) return errorResponse('Database error');
      const teachers = visibleTeachers(await teachRes.json());
      return jsonResponse(teachers);
    }

    // Get courses for this teacher
    const coursesRes = await fetch(
      `${SUPABASE_URL}/rest/v1/courses?teacher_id=eq.${teacherId}&status=eq.active&select=id,course_code`,
      { headers: H }
    );
    if (!coursesRes.ok) return errorResponse('Database error');
    const courses = await coursesRes.json();

    if (!courses.length) return jsonResponse({ teacher_id: teacherId, days: [] });

    // Get scheduled sessions for those courses within date range
    const now = new Date();
    const until = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const fromISO = now.toISOString();
    const untilISO = until.toISOString();

    const courseFilter = courses.map((c) => `course_id.eq.${c.id}`).join(',');
    const sessRes = await fetch(
      `${SUPABASE_URL}/rest/v1/sessions?or=(${courseFilter})&scheduled_at=gte.${fromISO}&scheduled_at=lte.${untilISO}&order=scheduled_at.asc&select=id,course_id,scheduled_at,duration_minutes,status`,
      { headers: H }
    );
    if (!sessRes.ok) return errorResponse('Database error');
    const sessions = await sessRes.json();

    // Build course code lookup
    const codeMap = {};
    for (const c of courses) codeMap[c.id] = c.course_code;

    // Group sessions by date
    const dayMap = {};
    for (const s of sessions) {
      const date = s.scheduled_at.slice(0, 10);
      if (!dayMap[date]) dayMap[date] = [];
      dayMap[date].push({
        id: s.id,
        course_code: codeMap[s.course_id] || '—',
        time: s.scheduled_at,
        duration_minutes: s.duration_minutes || 60,
        status: s.status,
      });
    }

    // Build array of days (including empty days for the grid)
    const dayList = [];
    const cursor = new Date(now);
    cursor.setHours(0, 0, 0, 0);
    for (let i = 0; i < days; i++) {
      const dateStr = cursor.toISOString().slice(0, 10);
      dayList.push({
        date: dateStr,
        weekday: cursor.toLocaleDateString('en-GB', { weekday: 'short' }),
        sessions: dayMap[dateStr] || [],
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    return jsonResponse({ teacher_id: teacherId, days: dayList });
  } catch (err) {
    console.error('Error:', err);
    return errorResponse('Connection error');
  }
}, 'get-teacher-availability');
