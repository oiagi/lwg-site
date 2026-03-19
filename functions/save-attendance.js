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
//
// Environment variables:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY, ADMIN_PASSWORD

import { supabaseHeaders, requireAdminAuth, jsonResponse, errorResponse } from './api/_utils.js';

export async function onRequestPost({ request, env }) {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;

  const authErr = requireAdminAuth(request, env);
  if (authErr) return authErr;

  let session_id, records;
  try {
    ({ session_id, records } = await request.json());
  } catch {
    return errorResponse('Invalid JSON', 400);
  }

  if (!session_id || !Array.isArray(records) || records.length === 0) {
    return errorResponse('Missing session_id or records array', 400);
  }

  const H = supabaseHeaders(SUPABASE_SERVICE_KEY);

  // ── Verify session exists ────────────────────────────────────────────
  const sessRes = await fetch(
    `${SUPABASE_URL}/rest/v1/sessions?id=eq.${session_id}&select=id`,
    { headers: H }
  );
  const sessions = await sessRes.json();
  if (!sessions.length) return errorResponse('Session not found', 404);

  // ── Upsert attendance records ─────────────────────────────────────────
  const saved  = [];
  const errors = [];

  for (const rec of records) {
    if (!rec.student_id) {
      errors.push({ error: 'Missing student_id', record: rec });
      continue;
    }

    const data = {
      session_id,
      student_id: rec.student_id,
      present:    rec.present !== false, // default to present
    };
    if (rec.notes !== undefined) data.notes = rec.notes;

    try {
      // Upsert: on conflict (session_id, student_id) update present + notes
      const res = await fetch(`${SUPABASE_URL}/rest/v1/attendance`, {
        method: 'POST',
        headers: {
          ...H,
          'Prefer': 'return=representation,resolution=merge-duplicates',
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

  return jsonResponse({
    success: true,
    saved_count: saved.length,
    records: saved,
    errors: errors.length ? errors : undefined,
  });
}
