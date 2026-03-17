// functions/api/sync-calendar.js
// POST /api/sync-calendar
// Body: { course_id }
//
// On-demand Google Calendar sync for a course.
// Called when opening a course in the admin dashboard to get fresh
// session data without relying on webhooks (which expire and can miss
// notifications). Fetches all calendar events matching the course code,
// upserts session records in Supabase, and updates sessions_completed.
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

export async function onRequestPost({ request, env }) {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY, ADMIN_PASSWORD } = env;

  const pwd = request.headers.get('x-admin-password');
  if (!pwd || pwd !== ADMIN_PASSWORD) {
    return new Response(JSON.stringify({ error: 'Unauthorised' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  let course_id;
  try {
    ({ course_id } = await request.json());
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!course_id) {
    return new Response(JSON.stringify({ error: 'Missing course_id' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── Load course ──────────────────────────────────────────────────────
  const cr = await fetch(
    `${SUPABASE_URL}/rest/v1/courses?id=eq.${course_id}&select=*`,
    { headers: H(SUPABASE_SERVICE_KEY) }
  );
  const courses = await cr.json();
  if (!courses.length) {
    return new Response(JSON.stringify({ error: 'Course not found' }), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }
  const course = courses[0];

  // ── Load teacher ─────────────────────────────────────────────────────
  const tr = await fetch(
    `${SUPABASE_URL}/rest/v1/teachers?id=eq.${course.teacher_id}&select=*`,
    { headers: H(SUPABASE_SERVICE_KEY) }
  );
  const teachers = await tr.json();
  if (!teachers.length || !teachers[0].refresh_token) {
    return new Response(JSON.stringify({ error: 'Teacher not found or not authorised' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }
  const teacher = teachers[0];

  // ── Get access token ─────────────────────────────────────────────────
  let accessToken;
  try {
    accessToken = await getValidAccessToken(teacher, env);
  } catch (err) {
    console.error('Token error:', err);
    return new Response(JSON.stringify({ error: 'Could not refresh token' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── Fetch events from Google Calendar matching this course code ───────
  // Search by course code prefix so we find all sessions regardless of title
  const calRes = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(teacher.calendar_id)}/events?` +
    `q=${encodeURIComponent(course.course_code)}&singleEvents=true&orderBy=startTime&maxResults=250`,
    { headers: { 'Authorization': `Bearer ${accessToken}` } }
  );

  if (!calRes.ok) {
    const err = await calRes.text();
    console.error('Calendar fetch error:', err);
    return new Response(JSON.stringify({ error: 'Calendar API error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  const calData = await calRes.json();

  /* Active events — present and not cancelled in Google Calendar */
  const activeEvents    = (calData.items || []).filter(e =>
    e.summary?.startsWith(course.course_code) && e.status !== 'cancelled'
  );
  /* Cancelled events — still returned by the API with status=cancelled */
  const cancelledEvents = (calData.items || []).filter(e =>
    e.summary?.startsWith(course.course_code) && e.status === 'cancelled'
  );
  const activeEventIds    = new Set(activeEvents.map(e => e.id));
  const cancelledEventIds = new Set(cancelledEvents.map(e => e.id));

  // ── Upsert active session records ────────────────────────────────────
  const now = new Date();
  let completedCount = 0;

  for (const event of activeEvents) {
    const scheduledAt = event.start.dateTime || event.start.date;
    const isPast      = new Date(scheduledAt) < now;
    const status      = isPast ? 'completed' : 'scheduled';
    if (isPast) completedCount++;

    const existRes = await fetch(
      `${SUPABASE_URL}/rest/v1/sessions?calendar_event_id=eq.${event.id}&select=id,status`,
      { headers: H(SUPABASE_SERVICE_KEY) }
    );
    const existing = await existRes.json();

    if (existing.length) {
      await fetch(`${SUPABASE_URL}/rest/v1/sessions?id=eq.${existing[0].id}`, {
        method: 'PATCH', headers: H(SUPABASE_SERVICE_KEY),
        body: JSON.stringify({ scheduled_at: scheduledAt, status }),
      });
    } else {
      await fetch(`${SUPABASE_URL}/rest/v1/sessions`, {
        method: 'POST', headers: H(SUPABASE_SERVICE_KEY),
        body: JSON.stringify({
          course_id:         course.id,
          teacher_id:        course.teacher_id,
          scheduled_at:      scheduledAt,
          duration_minutes:  50,
          status,
          calendar_event_id: event.id,
        }),
      });
    }
  }

  // ── Remove sessions no longer in Google Calendar ─────────────────────
  // Fetch all session records for this course from Supabase, then delete
  // any whose calendar_event_id is not in the active events from Google.
  // This covers both explicitly cancelled and silently deleted events.
  const allDbRes = await fetch(
    `${SUPABASE_URL}/rest/v1/sessions?course_id=eq.${course.id}&select=id,calendar_event_id`,
    { headers: H(SUPABASE_SERVICE_KEY) }
  );
  const allDbSessions = await allDbRes.json();
  for (const sess of allDbSessions) {
    if (!sess.calendar_event_id || !activeEventIds.has(sess.calendar_event_id)) {
      await fetch(`${SUPABASE_URL}/rest/v1/sessions?id=eq.${sess.id}`, {
        method: 'DELETE', headers: H(SUPABASE_SERVICE_KEY),
      });
    }
  }

  // ── Update sessions_completed count on course ─────────────────────────
  await fetch(`${SUPABASE_URL}/rest/v1/courses?id=eq.${course.id}`, {
    method: 'PATCH', headers: H(SUPABASE_SERVICE_KEY),
    body: JSON.stringify({ sessions_completed: completedCount }),
  });

  return new Response(JSON.stringify({
    success:      true,
    events_found: activeEvents.length,
    cancelled:    cancelledEvents.length,
    completed:    completedCount,
    scheduled:    activeEvents.length - completedCount,
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
