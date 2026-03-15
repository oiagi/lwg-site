// functions/api/log-session.js
// PATCH /api/log-session
// Body: { session_id, notes? }
//
// Marks a session as completed and optionally adds teacher notes.
// Also increments the sessions_completed count on the parent course.
//
// Environment variables:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY, ADMIN_PASSWORD

export async function onRequestPatch({ request, env }) {
  const SUPABASE_URL         = env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = env.SUPABASE_SERVICE_KEY;
  const ADMIN_PASSWORD       = env.ADMIN_PASSWORD;

  const HEADERS = {
    'Content-Type':  'application/json',
    'apikey':        SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
  };

  // ── Password check ───────────────────────────────────────────────────
  const pwd = request.headers.get('x-admin-password');
  if (!pwd || pwd !== ADMIN_PASSWORD) {
    return new Response(JSON.stringify({ error: 'Unauthorised' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── Parse body ───────────────────────────────────────────────────────
  let session_id, notes;
  try {
    ({ session_id, notes } = await request.json());
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!session_id) {
    return new Response(JSON.stringify({ error: 'Missing session_id' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── Load session to get course_id ────────────────────────────────────
  const sessRes = await fetch(
    `${SUPABASE_URL}/rest/v1/sessions?id=eq.${session_id}&select=id,course_id,status`,
    { headers: HEADERS }
  );
  const sessions = await sessRes.json();
  if (!sessions.length) {
    return new Response(JSON.stringify({ error: 'Session not found' }), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }
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
      headers: { ...HEADERS, 'Prefer': 'return=representation' },
      body:    JSON.stringify(patch),
    }
  );

  if (!updateRes.ok) {
    return new Response(JSON.stringify({ error: 'Could not update session' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── Increment sessions_completed on the course ───────────────────────
  // Only increment if this session wasn't already completed
  if (session.status !== 'completed') {
    try {
      // First get current count
      const courseRes = await fetch(
        `${SUPABASE_URL}/rest/v1/courses?id=eq.${session.course_id}&select=sessions_completed`,
        { headers: HEADERS }
      );
      const courses = await courseRes.json();
      if (courses.length) {
        const newCount = (courses[0].sessions_completed || 0) + 1;
        await fetch(
          `${SUPABASE_URL}/rest/v1/courses?id=eq.${session.course_id}`,
          {
            method:  'PATCH',
            headers: HEADERS,
            body:    JSON.stringify({ sessions_completed: newCount }),
          }
        );
      }
    } catch (err) {
      console.error('Course count update error:', err);
    }
  }

  const updated = await updateRes.json();
  return new Response(JSON.stringify(updated[0] || {}), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
}
