// functions/api/calendar-webhook.js
// POST /api/calendar-webhook
//
// Receives push notifications from Google Calendar when events change.
// Google sends a POST request with headers identifying which calendar
// changed. We then fetch the updated event list and sync session
// records and completed counts in Supabase.
//
// Google Calendar webhook docs:
// https://developers.google.com/calendar/api/guides/push
//
// Environment variables:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET

const SUPABASE_HEADERS = (key) => ({
  'Content-Type':  'application/json',
  'apikey':        key,
  'Authorization': `Bearer ${key}`,
});

async function getValidAccessToken(teacher, env) {
  const expiresAt = new Date(teacher.token_expires_at);
  if (expiresAt > new Date(Date.now() + 5 * 60 * 1000)) {
    return teacher.access_token;
  }
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: teacher.refresh_token,
      grant_type:    'refresh_token',
    }),
  });
  if (!res.ok) throw new Error(`Token refresh failed: ${await res.text()}`);
  const tokens     = await res.json();
  const expiresAt2 = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  await fetch(`${env.SUPABASE_URL}/rest/v1/teachers?id=eq.${teacher.id}`, {
    method:  'PATCH',
    headers: SUPABASE_HEADERS(env.SUPABASE_SERVICE_KEY),
    body:    JSON.stringify({ access_token: tokens.access_token, token_expires_at: expiresAt2 }),
  });
  return tokens.access_token;
}

export async function onRequestPost({ request, env }) {
  const SUPABASE_URL         = env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = env.SUPABASE_SERVICE_KEY;

  // Google identifies the watch channel in the request headers
  const channelId    = request.headers.get('x-goog-channel-id');
  const resourceState = request.headers.get('x-goog-resource-state');

  // Ignore sync messages (sent when watch is first set up)
  if (resourceState === 'sync') {
    return new Response('OK', { status: 200 });
  }

  if (!channelId) {
    return new Response('Missing channel ID', { status: 400 });
  }

  // ── Find the course associated with this watch channel ────────────────
  const courseRes = await fetch(
    `${SUPABASE_URL}/rest/v1/courses?calendar_watch_channel=eq.${channelId}&select=*`,
    { headers: SUPABASE_HEADERS(SUPABASE_SERVICE_KEY) }
  );
  const courses = await courseRes.json();
  if (!courses.length) {
    console.error('No course found for channel:', channelId);
    return new Response('OK', { status: 200 }); // Return 200 to stop Google retrying
  }
  const course = courses[0];

  // ── Load the teacher to get calendar access ───────────────────────────
  const teacherRes = await fetch(
    `${SUPABASE_URL}/rest/v1/teachers?id=eq.${course.teacher_id}&select=*`,
    { headers: SUPABASE_HEADERS(SUPABASE_SERVICE_KEY) }
  );
  const teachers = await teacherRes.json();
  if (!teachers.length) return new Response('OK', { status: 200 });
  const teacher = teachers[0];

  let accessToken;
  try {
    accessToken = await getValidAccessToken(teacher, env);
  } catch (err) {
    console.error('Token refresh error in webhook:', err);
    return new Response('OK', { status: 200 });
  }

  // ── Fetch all events for this course from Google Calendar ─────────────
  // We search for events whose summary starts with the course code
  const calRes = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(teacher.calendar_id)}/events?` +
    `q=${encodeURIComponent(course.course_code)}&singleEvents=true&orderBy=startTime`,
    {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    }
  );

  if (!calRes.ok) {
    console.error('Calendar fetch error:', await calRes.text());
    return new Response('OK', { status: 200 });
  }

  const calData = await calRes.json();
  const events  = (calData.items || []).filter(e =>
    e.summary?.startsWith(course.course_code) && e.status !== 'cancelled'
  );

  // ── Count completed and upcoming sessions ─────────────────────────────
  const now               = new Date();
  const completedEvents   = events.filter(e => new Date(e.start.dateTime || e.start.date) < now);
  const sessionsCompleted = completedEvents.length;

  // ── Update session count on course ───────────────────────────────────
  await fetch(
    `${SUPABASE_URL}/rest/v1/courses?id=eq.${course.id}`,
    {
      method:  'PATCH',
      headers: SUPABASE_HEADERS(SUPABASE_SERVICE_KEY),
      body:    JSON.stringify({ sessions_completed: sessionsCompleted }),
    }
  );

  // ── Upsert session records for each calendar event ────────────────────
  // This keeps our session table in sync with what's in Google Calendar.
  for (const event of events) {
    const scheduledAt = event.start.dateTime || event.start.date;
    const isPast      = new Date(scheduledAt) < now;
    const status      = isPast ? 'completed' : 'scheduled';

    // Check if session record exists for this calendar event
    const existingRes = await fetch(
      `${SUPABASE_URL}/rest/v1/sessions?calendar_event_id=eq.${event.id}&select=id`,
      { headers: SUPABASE_HEADERS(SUPABASE_SERVICE_KEY) }
    );
    const existing = await existingRes.json();

    if (existing.length) {
      // Update existing session
      await fetch(
        `${SUPABASE_URL}/rest/v1/sessions?id=eq.${existing[0].id}`,
        {
          method:  'PATCH',
          headers: SUPABASE_HEADERS(SUPABASE_SERVICE_KEY),
          body:    JSON.stringify({ scheduled_at: scheduledAt, status }),
        }
      );
    } else {
      // Create new session record
      await fetch(
        `${SUPABASE_URL}/rest/v1/sessions`,
        {
          method:  'POST',
          headers: SUPABASE_HEADERS(SUPABASE_SERVICE_KEY),
          body:    JSON.stringify({
            course_id:         course.id,
            teacher_id:        course.teacher_id,
            scheduled_at:      scheduledAt,
            duration_minutes:  50,
            status,
            calendar_event_id: event.id,
          }),
        }
      );
    }
  }

  return new Response('OK', { status: 200 });
}
