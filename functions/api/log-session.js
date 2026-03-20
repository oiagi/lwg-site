// functions/api/log-session.js
// PATCH /api/log-session
// Body: { session_id, notes? }
//
// Marks a session as completed and optionally adds teacher notes.
// Also increments the sessions_completed count on the parent course.
//
// Environment variables:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY, ADMIN_PASSWORD

import { supabaseHeaders, requireAdminAuth, jsonResponse, errorResponse } from './_utils.js';

export async function onRequestPatch({ request, env }) {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;

  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  // ── Parse body ───────────────────────────────────────────────────────
  let session_id, notes;
  try {
    ({ session_id, notes } = await request.json());
  } catch {
    return errorResponse('Invalid JSON', 400);
  }

  if (!session_id) return errorResponse('Missing session_id', 400);

  const H = supabaseHeaders(SUPABASE_SERVICE_KEY);

  // ── Load session to get course_id ────────────────────────────────────
  const sessRes = await fetch(
    `${SUPABASE_URL}/rest/v1/sessions?id=eq.${session_id}&select=id,course_id,status`,
    { headers: H }
  );
  const sessions = await sessRes.json();
  if (!sessions.length) return errorResponse('Session not found', 404);
  const session = sessions[0];

  // ── Mark session as completed ────────────────────────────────────────
  const patch = {
    status:       'completed',
    completed_at: new Date().toISOString(),
  };
  if (notes !== undefined) patch.notes = notes;

  const updateRes = await fetch(
    `${SUPABASE_URL}/rest/v1/sessions?id=eq.${session_id}`,
    {
      method:  'PATCH',
      headers: { ...H, 'Prefer': 'return=representation' },
      body:    JSON.stringify(patch),
    }
  );

  if (!updateRes.ok) return errorResponse('Could not update session');

  // ── Increment sessions_completed on the course ───────────────────────
  // Only increment if this session wasn't already completed
  if (session.status !== 'completed') {
    try {
      // First get current count
      const courseRes = await fetch(
        `${SUPABASE_URL}/rest/v1/courses?id=eq.${session.course_id}&select=sessions_completed`,
        { headers: H }
      );
      const courses = await courseRes.json();
      if (courses.length) {
        const newCount = (courses[0].sessions_completed || 0) + 1;
        await fetch(
          `${SUPABASE_URL}/rest/v1/courses?id=eq.${session.course_id}`,
          {
            method:  'PATCH',
            headers: H,
            body:    JSON.stringify({ sessions_completed: newCount }),
          }
        );
      }
    } catch (err) {
      console.error('Course count update error:', err);
    }
  }

  const updated = await updateRes.json();
  return jsonResponse(updated[0] || {});
}
