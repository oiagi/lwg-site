// functions/api/cancel-session.js
// DELETE /api/cancel-session
// Body: { session_id }
//
// Cancels a session by:
//   1. Loading the session and its course/teacher from Supabase
//   2. Cancelling the Google Calendar event (sends cancellation to attendees)
//   3. Deleting the session record from Supabase
//   4. Adjusting sessions_completed count if the session was already logged
//
// Environment variables:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY, ADMIN_PASSWORD,
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET

const H = (key) => ({
  'Content-Type':  'application/json',
  'apikey':        key,
  'Authorization': `Bearer ${key}`,
});

async function getValidAccessToken(teacher, env) {
  const expiresAt = new Date(teacher.token_expires_at);
  if (expiresAt > new Date(Date.now() + 5 * 60 * 1000)) return teacher.access_token;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: teacher.refresh_token,
      grant_type:    'refresh_token',
    }),
  });
  if (!res.ok) throw new Error(`Token refresh failed: ${await res.text()}`);

  const tokens = await res.json();
  const expiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  await fetch(`${env.SUPABASE_URL}/rest/v1/teachers?id=eq.${teacher.id}`, {
    method: 'PATCH', headers: H(env.SUPABASE_SERVICE_KEY),
    body: JSON.stringify({ access_token: tokens.access_token, token_expires_at: expiry }),
  });
  return tokens.access_token;
}

export async function onRequestDelete({ request, env }) {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY, ADMIN_PASSWORD } = env;

  const pwd = request.headers.get('x-admin-password');
  if (!pwd || pwd !== ADMIN_PASSWORD) {
    return new Response(JSON.stringify({ error: 'Unauthorised' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  let session_id;
  try {
    ({ session_id } = await request.json());
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

  // ── Load session ──────────────────────────────────────────────────────
  const sessRes = await fetch(
    `${SUPABASE_URL}/rest/v1/sessions?id=eq.${session_id}&select=*`,
    { headers: H(SUPABASE_SERVICE_KEY) }
  );
  const sessions = await sessRes.json();
  if (!sessions.length) {
    return new Response(JSON.stringify({ error: 'Session not found' }), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }
  const session = sessions[0];

  // ── Load course ───────────────────────────────────────────────────────
  const courseRes = await fetch(
    `${SUPABASE_URL}/rest/v1/courses?id=eq.${session.course_id}&select=*`,
    { headers: H(SUPABASE_SERVICE_KEY) }
  );
  const courses = await courseRes.json();
  if (!courses.length) {
    return new Response(JSON.stringify({ error: 'Course not found' }), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }
  const course = courses[0];

  // ── Load teacher ──────────────────────────────────────────────────────
  const teacherRes = await fetch(
    `${SUPABASE_URL}/rest/v1/teachers?id=eq.${course.teacher_id}&select=*`,
    { headers: H(SUPABASE_SERVICE_KEY) }
  );
  const teachers = await teacherRes.json();
  if (!teachers.length || !teachers[0].refresh_token) {
    return new Response(JSON.stringify({ error: 'Teacher not found or not authorised' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }
  const teacher = teachers[0];

  // ── Cancel Google Calendar event ──────────────────────────────────────
  if (session.calendar_event_id) {
    try {
      const accessToken = await getValidAccessToken(teacher, env);
      const cancelRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(teacher.calendar_id)}/events/${session.calendar_event_id}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${accessToken}` },
        }
      );
      // 204 = deleted, 410 = already gone — both acceptable
      if (!cancelRes.ok && cancelRes.status !== 410) {
        console.error('Calendar cancellation failed:', cancelRes.status, await cancelRes.text());
        // Non-fatal — still remove from Supabase
      }
    } catch (err) {
      console.error('Calendar API error:', err);
      // Non-fatal — still remove from Supabase
    }
  }

  // ── Delete session record from Supabase ───────────────────────────────
  await fetch(`${SUPABASE_URL}/rest/v1/sessions?id=eq.${session_id}`, {
    method: 'DELETE', headers: H(SUPABASE_SERVICE_KEY),
  });

  // ── Adjust sessions_completed if this session was already logged ───────
  if (session.status === 'completed') {
    try {
      const newCount = Math.max(0, (course.sessions_completed || 1) - 1);
      await fetch(`${SUPABASE_URL}/rest/v1/courses?id=eq.${course.id}`, {
        method: 'PATCH', headers: H(SUPABASE_SERVICE_KEY),
        body: JSON.stringify({ sessions_completed: newCount }),
      });
    } catch (err) {
      console.error('Course count update error:', err);
    }
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
}
