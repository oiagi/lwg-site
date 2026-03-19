// functions/api/create-recurring-sessions.js
// POST /api/create-recurring-sessions
// Body: {
//   course_id,          — UUID of the course
//   start_date,         — ISO date string for the first session (e.g. "2025-09-01")
//   time,               — time string in HH:MM format (e.g. "09:00")
//   day_of_week,        — 0-6 (Sunday-Saturday) — if not provided, derived from start_date
//   count,              — number of sessions to create
//   duration_minutes,   — session duration (default 50)
//   skip_dates,         — optional array of ISO date strings to skip (holidays)
// }
//
// Creates `count` weekly sessions for a course, each with a Google Calendar
// event. Skips any dates in the skip_dates array. Updates the course's
// sessions_total and recurrence_rule fields.
//
// Environment variables:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY, ADMIN_PASSWORD,
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET

import { supabaseHeaders, requireAdminAuth, getValidAccessToken, jsonResponse, errorResponse } from './_utils.js';

export async function onRequestPost({ request, env }) {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;

  const authErr = requireAdminAuth(request, env);
  if (authErr) return authErr;

  let course_id, start_date, time, day_of_week, count,
      duration_minutes, skip_dates;
  try {
    ({ course_id, start_date, time, day_of_week, count,
       duration_minutes = 50, skip_dates = [] } = await request.json());
  } catch {
    return errorResponse('Invalid JSON', 400);
  }

  if (!course_id || !start_date || !time || !count) {
    return errorResponse('Missing required fields: course_id, start_date, time, count', 400);
  }

  if (count < 1 || count > 52) {
    return errorResponse('Count must be between 1 and 52', 400);
  }

  const H = supabaseHeaders(SUPABASE_SERVICE_KEY);
  const skipSet = new Set(skip_dates);

  // ── Load course ──────────────────────────────────────────────────────
  const courseRes = await fetch(
    `${SUPABASE_URL}/rest/v1/courses?id=eq.${course_id}&select=*`,
    { headers: H }
  );
  const courses = await courseRes.json();
  if (!courses.length) return errorResponse('Course not found', 404);
  const course = courses[0];

  // ── Load teacher ─────────────────────────────────────────────────────
  if (!course.teacher_id) {
    return errorResponse('Course has no assigned teacher', 400);
  }

  const teacherRes = await fetch(
    `${SUPABASE_URL}/rest/v1/teachers?id=eq.${course.teacher_id}&select=*`,
    { headers: H }
  );
  const teachers = await teacherRes.json();
  if (!teachers.length || !teachers[0].refresh_token) {
    return errorResponse('Teacher not found or not authorised', 400);
  }
  const teacher = teachers[0];

  // ── Get access token ─────────────────────────────────────────────────
  let accessToken;
  try {
    accessToken = await getValidAccessToken(teacher, env);
  } catch (err) {
    console.error('Token error:', err);
    return errorResponse('Could not refresh token');
  }

  // ── Build attendee list from course participants ──────────────────────
  const participants = course.participants || [];
  const attendees = participants
    .filter(p => p.email)
    .map(p => ({
      email: p.email,
      displayName: `${p.firstName || ''} ${p.lastName || ''}`.trim(),
    }));

  // ── Generate session dates (weekly, skipping holidays) ────────────────
  const sessionDates = [];
  const [year, month, day] = start_date.split('-').map(Number);
  let cursor = new Date(year, month - 1, day);

  while (sessionDates.length < count) {
    const iso = cursor.toISOString().split('T')[0];
    if (!skipSet.has(iso)) {
      sessionDates.push(iso);
    }
    // Advance one week
    cursor.setDate(cursor.getDate() + 7);
  }

  // ── Create sessions with calendar events ─────────────────────────────
  const created = [];
  const errors  = [];

  for (const dateStr of sessionDates) {
    const startDT = new Date(`${dateStr}T${time}:00`);
    const endDT   = new Date(startDT.getTime() + duration_minutes * 60 * 1000);

    // Construct event title matching existing convention
    const participantNames = (course.participant_names || []).filter(Boolean);
    const eventTitle = participantNames.length
      ? `${course.course_code} — ${participantNames.join('+')} <> ${teacher.name}`
      : `${course.course_code} <> ${teacher.name}`;

    // ── Create Google Calendar event ─────────────────────────────────
    let calendarEventId;
    try {
      const calRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(teacher.calendar_id)}/events?sendUpdates=all`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
          body: JSON.stringify({
            summary: eventTitle,
            description:
              `Course: ${course.course_code}\n` +
              (course.service  ? `Service: ${course.service}\n` : '') +
              (course.level    ? `Level: ${course.level}\n`     : '') +
              (course.location ? `Location: ${course.location}\n` : ''),
            start: { dateTime: startDT.toISOString(), timeZone: 'Europe/Zurich' },
            end:   { dateTime: endDT.toISOString(),   timeZone: 'Europe/Zurich' },
            ...(course.location ? { location: course.location } : {}),
            attendees,
          }),
        }
      );
      if (!calRes.ok) {
        console.error(`Calendar error for ${dateStr}:`, await calRes.text());
        errors.push({ date: dateStr, error: 'Calendar event creation failed' });
        continue;
      }
      calendarEventId = (await calRes.json()).id;
    } catch (err) {
      console.error(`Calendar API error for ${dateStr}:`, err);
      errors.push({ date: dateStr, error: 'Calendar API error' });
      continue;
    }

    // ── Create session record in Supabase ────────────────────────────
    try {
      const sessRes = await fetch(`${SUPABASE_URL}/rest/v1/sessions`, {
        method: 'POST',
        headers: { ...H, 'Prefer': 'return=representation' },
        body: JSON.stringify({
          course_id,
          teacher_id: course.teacher_id,
          scheduled_at: startDT.toISOString(),
          duration_minutes,
          status: 'scheduled',
          calendar_event_id: calendarEventId,
        }),
      });
      if (sessRes.ok) {
        const rows = await sessRes.json();
        created.push({ date: dateStr, session_id: rows[0]?.id, event_id: calendarEventId });
      } else {
        errors.push({ date: dateStr, error: 'Session record creation failed' });
      }
    } catch (err) {
      console.error(`Session DB error for ${dateStr}:`, err);
      errors.push({ date: dateStr, error: 'Database error' });
    }
  }

  // ── Update course with sessions_total and recurrence info ─────────────
  const dayNames = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  const firstDate = new Date(`${sessionDates[0]}T${time}:00`);
  const dayIndex  = day_of_week !== undefined ? day_of_week : firstDate.getDay();
  const rrule     = `FREQ=WEEKLY;BYDAY=${dayNames[dayIndex]};COUNT=${count}`;

  try {
    // Get current sessions count to add to it
    const existingRes = await fetch(
      `${SUPABASE_URL}/rest/v1/sessions?course_id=eq.${course_id}&status=neq.cancelled&select=id`,
      { headers: H }
    );
    const existingSessions = existingRes.ok ? await existingRes.json() : [];

    await fetch(`${SUPABASE_URL}/rest/v1/courses?id=eq.${course_id}`, {
      method: 'PATCH', headers: H,
      body: JSON.stringify({
        sessions_total:  existingSessions.length,
        recurrence_rule: rrule,
      }),
    });
  } catch (err) {
    console.error('Course update error:', err);
  }

  return jsonResponse({
    success: true,
    sessions_created: created.length,
    sessions: created,
    errors: errors.length ? errors : undefined,
  });
}
