// functions/api/save-attendance.js
// POST /api/save-attendance
// Body: {
//   session_id,
//   records: [
//     { student_id, present: true/false, notes? },
//     ...
//   ]
// }
//
// Upserts attendance records for a session. Each record maps a student
// to a present/absent status. Uses Supabase's conflict resolution to
// update existing records on re-submission (e.g. correcting a mistake).
// When attendance is saved successfully, the session is marked completed
// and the parent course's completed-session count is incremented once.
//
// Environment variables:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY, SUPABASE_ANON_KEY

import {
  supabaseHeaders,
  requireAdminAuth,
  jsonResponse,
  errorResponse,
  withErrorHandling,
  parseJsonBody,
} from './_utils.js';

export const onRequestPost = withErrorHandling(async ({ request, env }) => {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;

  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  const { body, error } = await parseJsonBody(request);
  if (error) return error;

  const { session_id, records } = body;
  if (!session_id || !Array.isArray(records) || records.length === 0) {
    return errorResponse('Missing session_id or records array', 400);
  }

  const H = supabaseHeaders(SUPABASE_SERVICE_KEY);

  // ── Verify session exists ────────────────────────────────────────────
  const sessRes = await fetch(
    `${SUPABASE_URL}/rest/v1/sessions?id=eq.${session_id}&select=id,course_id,status`,
    { headers: H }
  );
  const sessions = await sessRes.json();
  if (!sessions.length) return errorResponse('Session not found', 404);
  const session = sessions[0];

  // ── Upsert attendance records ─────────────────────────────────────────
  const saved = [];
  const errors = [];

  for (const rec of records) {
    if (!rec.student_id) {
      errors.push({ error: 'Missing student_id', record: rec });
      continue;
    }

    const data = {
      session_id,
      student_id: rec.student_id,
      present: rec.present !== false, // default to present
    };
    if (rec.notes !== undefined) data.notes = rec.notes;

    try {
      // Upsert: on conflict (session_id, student_id) update present + notes
      const res = await fetch(`${SUPABASE_URL}/rest/v1/attendance`, {
        method: 'POST',
        headers: {
          ...H,
          Prefer: 'return=representation,resolution=merge-duplicates',
        },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        const rows = await res.json();
        saved.push(rows[0]);
      } else {
        console.error('Attendance upsert error:', await res.text());
        errors.push({ student_id: rec.student_id, error: 'Database error' });
      }
    } catch (err) {
      console.error('Attendance error:', err);
      errors.push({ student_id: rec.student_id, error: 'Connection error' });
    }
  }

  let completedSession = null;
  let newlyCompleted = false;

  if (!errors.length) {
    const completionPatch = {
      status: 'completed',
    };

    const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/sessions?id=eq.${session_id}`, {
      method: 'PATCH',
      headers: { ...H, Prefer: 'return=representation' },
      body: JSON.stringify(completionPatch),
    });

    if (!updateRes.ok) {
      console.error('Session completion error:', await updateRes.text());
      return errorResponse('Attendance saved, but session completion failed');
    }

    const updated = await updateRes.json();
    completedSession = updated[0] || null;
    newlyCompleted = session.status !== 'completed';

    if (newlyCompleted) {
      try {
        const courseRes = await fetch(
          `${SUPABASE_URL}/rest/v1/courses?id=eq.${session.course_id}&select=sessions_completed`,
          { headers: H }
        );
        const courses = await courseRes.json();
        if (courses.length) {
          const newCount = (courses[0].sessions_completed || 0) + 1;
          await fetch(`${SUPABASE_URL}/rest/v1/courses?id=eq.${session.course_id}`, {
            method: 'PATCH',
            headers: H,
            body: JSON.stringify({ sessions_completed: newCount }),
          });
        }
      } catch (err) {
        console.error('Course count update error:', err);
      }
    }
  }

  return jsonResponse({
    success: true,
    saved_count: saved.length,
    records: saved,
    session: completedSession,
    newly_completed: newlyCompleted,
    errors: errors.length ? errors : undefined,
  });
}, 'save-attendance');
