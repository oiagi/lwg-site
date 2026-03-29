// functions/api/get-attendance.js
// GET /api/get-attendance?session_id=<uuid>
// GET /api/get-attendance?student_id=<uuid>
// GET /api/get-attendance?course_id=<uuid>
//
// Returns attendance records filtered by session, student, or course.
// When filtering by course, returns all attendance for all sessions in
// that course — useful for generating attendance reports for corporate
// clients.
//
// Environment variables:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY, ADMIN_PASSWORD

import { supabaseHeaders, requireAdminAuth, jsonResponse, errorResponse } from './_utils.js';

export async function onRequestGet({ request, env }) {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;

  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  const url = new URL(request.url);
  const sessionId = url.searchParams.get('session_id');
  const studentId = url.searchParams.get('student_id');
  const courseId = url.searchParams.get('course_id');

  const H = supabaseHeaders(SUPABASE_SERVICE_KEY);

  try {
    // ── By session ──────────────────────────────────────────────────────
    if (sessionId) {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/attendance?session_id=eq.${sessionId}&select=*`,
        { headers: H }
      );
      if (!res.ok) return errorResponse('Database error');
      const records = await res.json();
      return jsonResponse(await enrichWithStudentNames(records, env));
    }

    // ── By student ──────────────────────────────────────────────────────
    if (studentId) {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/attendance?student_id=eq.${studentId}&order=created_at.desc&select=*`,
        { headers: H }
      );
      if (!res.ok) return errorResponse('Database error');
      return jsonResponse(await res.json());
    }

    // ── By course ───────────────────────────────────────────────────────
    if (courseId) {
      // First get all session IDs for this course
      const sessRes = await fetch(
        `${SUPABASE_URL}/rest/v1/sessions?course_id=eq.${courseId}&order=scheduled_at.asc&select=id,scheduled_at,status`,
        { headers: H }
      );
      const sessions = sessRes.ok ? await sessRes.json() : [];
      const sessionIds = sessions.map((s) => s.id);

      if (!sessionIds.length) return jsonResponse([]);

      // Load attendance for all sessions
      const filter = sessionIds.map((id) => `session_id.eq.${id}`).join(',');
      const attRes = await fetch(`${SUPABASE_URL}/rest/v1/attendance?or=(${filter})&select=*`, {
        headers: H,
      });
      const attendance = attRes.ok ? await attRes.json() : [];

      // Group by session
      const sessionMap = {};
      for (const sess of sessions) {
        sessionMap[sess.id] = { ...sess, attendance: [] };
      }
      for (const rec of attendance) {
        if (sessionMap[rec.session_id]) {
          sessionMap[rec.session_id].attendance.push(rec);
        }
      }

      return jsonResponse(Object.values(sessionMap));
    }

    return errorResponse('Provide session_id, student_id, or course_id', 400);
  } catch (err) {
    console.error('Error:', err);
    return errorResponse('Connection error');
  }
}

// ── Helper: add student names to attendance records ──────────────────
async function enrichWithStudentNames(records, env) {
  if (!records.length) return records;

  const studentIds = [...new Set(records.map((r) => r.student_id))];
  const filter = studentIds.map((id) => `id.eq.${id}`).join(',');

  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/students?or=(${filter})&select=id,first_name,last_name,email`,
    { headers: supabaseHeaders(env.SUPABASE_SERVICE_KEY) }
  );
  const students = res.ok ? await res.json() : [];

  const nameMap = {};
  for (const s of students) {
    nameMap[s.id] = { first_name: s.first_name, last_name: s.last_name, email: s.email };
  }

  return records.map((r) => ({ ...r, student: nameMap[r.student_id] || null }));
}
