// functions/api/delete-course.js
// DELETE /api/delete-course
// Body: { course_id }
//
// Deletes a course entirely:
//   1. Cancels all upcoming Google Calendar events for the course
//   2. Deletes all session records from Supabase
//   3. Deletes all enrolment records
//   4. Deletes the course record
//   5. Unlinks the course from any enquiry (sets course_id to null)
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
  const expiry  = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
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

  // ── Load course ───────────────────────────────────────────────────────
  const courseRes = await fetch(
    `${SUPABASE_URL}/rest/v1/courses?id=eq.${course_id}&select=*`,
    { headers: H(SUPABASE_SERVICE_KEY) }
  );
  const courses = await courseRes.json();
  if (!courses.length) {
    return new Response(JSON.stringify({ error: 'Course not found' }), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }
  const course = courses[0];

  // ── Load sessions ─────────────────────────────────────────────────────
  const sessRes = await fetch(
    `${SUPABASE_URL}/rest/v1/sessions?course_id=eq.${course_id}&select=id,calendar_event_id,status`,
    { headers: H(SUPABASE_SERVICE_KEY) }
  );
  const sessions = await sessRes.json();

  // ── Cancel calendar events for all upcoming sessions ──────────────────
  const upcomingSessions = sessions.filter(s =>
    s.status === 'scheduled' && s.calendar_event_id
  );

  if (upcomingSessions.length && course.teacher_id) {
    try {
      const teacherRes = await fetch(
        `${SUPABASE_URL}/rest/v1/teachers?id=eq.${course.teacher_id}&select=*`,
        { headers: H(SUPABASE_SERVICE_KEY) }
      );
      const teachers = await teacherRes.json();
      if (teachers.length && teachers[0].refresh_token) {
        const accessToken = await getValidAccessToken(teachers[0], env);
        for (const sess of upcomingSessions) {
          try {
            await fetch(
              `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(teachers[0].calendar_id)}/events/${sess.calendar_event_id}`,
              {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${accessToken}` },
              }
            );
          } catch (err) {
            console.error(`Failed to cancel event ${sess.calendar_event_id}:`, err);
          }
        }
      }
    } catch (err) {
      console.error('Calendar cancellation error:', err);
      // Non-fatal — continue with deletion
    }
  }

  // ── Unlink course from enquiry ────────────────────────────────────────
  if (course.enquiry_id) {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/enquiries?id=eq.${course.enquiry_id}`, {
        method: 'PATCH', headers: H(SUPABASE_SERVICE_KEY),
        body: JSON.stringify({ course_id: null, status: 'contacted' }),
      });
    } catch (err) {
      console.error('Enquiry unlink error:', err);
    }
  }

  // ── Delete sessions, enrolments, and course (cascade handles sessions) ─
  // Enrolments reference course_id with ON DELETE CASCADE so they're
  // removed automatically. Sessions too. We just delete the course.
  const deleteRes = await fetch(
    `${SUPABASE_URL}/rest/v1/courses?id=eq.${course_id}`,
    { method: 'DELETE', headers: H(SUPABASE_SERVICE_KEY) }
  );

  if (!deleteRes.ok) {
    return new Response(JSON.stringify({ error: 'Could not delete course' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
}
