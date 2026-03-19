// functions/api/confirm-booking.js
// POST /api/confirm-booking
// Body: {
//   enquiry_id,           — UUID of the enquiry (null for manual creation)
//   teacher_id,           — UUID of the assigned teacher
//   sessions_total,       — block size (null = open-ended)
//   first_session_at,     — ISO datetime string for the first session
//   duration_minutes,     — session duration (default 50)
//   course_code_override, — optional: skip auto-generation
// }
//
// Steps:
//   1. Load enquiry + teacher from Supabase
//   2. Refresh Google OAuth token if needed
//   3. Generate course code
//   4. Create Google Calendar event (with invites to participants)
//   5. Create course record in Supabase
//   6. Create first session record
//   7. Find or create student records per participant + enrolments
//   8. Update enquiry status to confirmed
//
// Environment variables:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY, GOOGLE_CLIENT_ID,
//   GOOGLE_CLIENT_SECRET, ADMIN_PASSWORD

import { supabaseHeaders, requireAdminAuth, getValidAccessToken, jsonResponse, errorResponse } from './_utils.js';

// ── Course code helpers ──────────────────────────────────────────────

function getGroupType(group) {
  if (!group || group.includes('private') || group.includes('1')) return 'private';
  if (group.includes('2')) return 'duo';
  return 'group';
}

function getCoursePrefix(groupType) {
  return groupType === 'private' ? 'P' : groupType === 'duo' ? 'D' : 'G';
}

function getLevelCode(booking) {
  if (booking.language === 'Swiss German') return 'CH';
  if (booking.service  === 'tutoring')     return 'SUB';
  return booking.level || 'XX';
}

async function getNextCourseCode(prefix, levelCode, env) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/get_next_course_code`, {
    method: 'POST', headers: supabaseHeaders(env.SUPABASE_SERVICE_KEY),
    body: JSON.stringify({ prefix, level_code: levelCode }),
  });
  if (!res.ok) throw new Error(`Course code error: ${await res.text()}`);
  return res.json();
}

// ── Student matching ─────────────────────────────────────────────────
// Find existing student by email or create a new one.

async function findOrCreateStudent(p, source, env) {
  if (p.email) {
    const res = await fetch(
      `${env.SUPABASE_URL}/rest/v1/students?email=eq.${encodeURIComponent(p.email)}&select=id`,
      { headers: supabaseHeaders(env.SUPABASE_SERVICE_KEY) }
    );
    const existing = await res.json();
    if (existing.length) return existing[0].id;
  }

  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/students`, {
    method: 'POST',
    headers: { ...supabaseHeaders(env.SUPABASE_SERVICE_KEY), 'Prefer': 'return=representation' },
    body: JSON.stringify({
      first_name: p.firstName || null,
      last_name:  p.lastName  || null,
      email:      p.email     || null,
      phone:      p.phone     || null,
      postcode:   p.postcode  || null,
      source,
    }),
  });
  if (!res.ok) throw new Error(`Student creation failed: ${await res.text()}`);
  const rows = await res.json();
  return rows[0].id;
}

// ── Main handler ─────────────────────────────────────────────────────

export async function onRequestPost({ request, env }) {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;

  const authErr = requireAdminAuth(request, env);
  if (authErr) return authErr;

  let enquiry_id, teacher_id, sessions_total, first_session_at,
      duration_minutes, course_code_override, booking_data, contact_data;
  try {
    ({ enquiry_id, teacher_id, sessions_total, first_session_at,
       duration_minutes = 50, course_code_override,
       booking_data, contact_data } = await request.json());
  } catch {
    return errorResponse('Invalid JSON', 400);
  }

  if (!teacher_id || !first_session_at) {
    return errorResponse('Missing teacher_id or first_session_at', 400);
  }

  // ── Load enquiry or use inline booking/contact data ─────────────────
  // When called from the admin manual course creation form, booking_data
  // and contact_data are passed directly instead of loading from an enquiry.
  let booking = booking_data || {}, contact = contact_data || {};
  if (enquiry_id) {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/enquiries?id=eq.${enquiry_id}&select=*`,
      { headers: supabaseHeaders(SUPABASE_SERVICE_KEY) }
    );
    const rows = await r.json();
    if (!rows.length) return errorResponse('Enquiry not found', 404);
    booking = rows[0].booking_data || {};
    contact = rows[0].contact_data || {};
  }

  // ── Load teacher ────────────────────────────────────────────────────
  const tr = await fetch(
    `${SUPABASE_URL}/rest/v1/teachers?id=eq.${teacher_id}&select=*`,
    { headers: supabaseHeaders(SUPABASE_SERVICE_KEY) }
  );
  const teachers = await tr.json();
  if (!teachers.length) return errorResponse('Teacher not found', 404);
  const teacher = teachers[0];

  if (!teacher.refresh_token) {
    return errorResponse('Teacher has not authorised Google Calendar. Please authenticate first.', 400);
  }

  // ── Token ────────────────────────────────────────────────────────────
  let accessToken;
  try {
    accessToken = await getValidAccessToken(teacher, env);
  } catch (err) {
    console.error('Token error:', err);
    return errorResponse('Could not refresh calendar token');
  }

  // ── Derive group type and level once — used for course code and record ─
  const groupType = getGroupType(booking.group);
  const levelCode = getLevelCode(booking);

  // ── Course code ───────────────────────────────────────────────────────
  let courseCode = course_code_override;
  if (!courseCode) {
    const prefix = getCoursePrefix(groupType);
    try {
      courseCode = await getNextCourseCode(prefix, levelCode, env);
    } catch (err) {
      console.error('Course code error:', err);
      return errorResponse('Could not generate course code');
    }
  }

  // ── Calendar event ───────────────────────────────────────────────────
  const participants     = contact.participants || [];
  const participantNames = participants.map(p => p.firstName).filter(Boolean);
  const startTime        = new Date(first_session_at);
  const endTime          = new Date(startTime.getTime() + duration_minutes * 60 * 1000);
  const eventTitle       = participantNames.length
    ? `${courseCode} — ${participantNames.join('+')} <> ${teacher.name}`
    : `${courseCode} <> ${teacher.name}`;
  const sessionsLine = sessions_total
    ? `Sessions: ${sessions_total} × 50min\n`
    : 'Sessions: open-ended\n';

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
            `Course: ${courseCode}\nService: ${booking.service || ''}\n` +
            (booking.level    ? `Level: ${booking.level}\n`       : '') +
            (booking.language ? `Language: ${booking.language}\n` : '') +
            (booking.exam     ? `Exam: ${booking.exam}\n`         : '') +
            sessionsLine +
            `\nLead: ${contact.lead?.firstName || ''} ${contact.lead?.lastName || ''}` +
            `\nEmail: ${contact.lead?.email || ''}` +
            `\nPhone: ${contact.lead?.phone || ''}`,
          start: { dateTime: startTime.toISOString(), timeZone: 'Europe/Zurich' },
          end:   { dateTime: endTime.toISOString(),   timeZone: 'Europe/Zurich' },
          attendees: participants
            .filter(p => p.email)
            .map(p => ({ email: p.email, displayName: `${p.firstName||''} ${p.lastName||''}`.trim() })),
        }),
      }
    );
    if (!calRes.ok) {
      const err = await calRes.text();
      console.error('Calendar error:', err);
      return errorResponse('Could not create calendar event');
    }
    calendarEventId = (await calRes.json()).id;
  } catch (err) {
    console.error('Calendar API error:', err);
    return errorResponse('Calendar API error');
  }

  // ── Course record ────────────────────────────────────────────────────
  let courseId;
  try {
    const cr = await fetch(`${SUPABASE_URL}/rest/v1/courses`, {
      method: 'POST',
      headers: { ...supabaseHeaders(SUPABASE_SERVICE_KEY), 'Prefer': 'return=representation' },
      body: JSON.stringify({
        course_code:        courseCode,
        service:            booking.service || null,
        level:              levelCode,
        group_type:         groupType,
        teacher_id,
        participant_names:  participantNames,
        participants,
        sessions_total:     sessions_total || null,
        sessions_completed: 0,
        calendar_event_id:  calendarEventId,
        enquiry_id:         enquiry_id || null,
        status:             'active',
      }),
    });
    if (!cr.ok) {
      console.error('Course creation failed:', await cr.text());
      return errorResponse('Could not create course');
    }
    courseId = (await cr.json())[0]?.id;
  } catch (err) {
    console.error('Course DB error:', err);
    return errorResponse('Database error');
  }

  // ── First session record ─────────────────────────────────────────────
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/sessions`, {
      method: 'POST', headers: supabaseHeaders(SUPABASE_SERVICE_KEY),
      body: JSON.stringify({
        course_id: courseId, teacher_id,
        scheduled_at: startTime.toISOString(),
        duration_minutes, status: 'scheduled',
        calendar_event_id: calendarEventId,
      }),
    });
  } catch (err) { console.error('Session record error:', err); }

  // ── Students + enrolments ────────────────────────────────────────────
  const source     = enquiry_id ? 'website' : 'manual';
  const studentIds = [];
  for (const p of participants) {
    try {
      const sid = await findOrCreateStudent(p, source, env);
      studentIds.push(sid);
      await fetch(`${SUPABASE_URL}/rest/v1/enrolments`, {
        method: 'POST',
        headers: { ...supabaseHeaders(SUPABASE_SERVICE_KEY), 'Prefer': 'resolution=ignore-duplicates' },
        body: JSON.stringify({ student_id: sid, course_id: courseId }),
      });
    } catch (err) { console.error('Student/enrolment error:', err); }
  }

  // ── Update enquiry ───────────────────────────────────────────────────
  if (enquiry_id) {
    try {
      const ur = await fetch(`${SUPABASE_URL}/rest/v1/enquiries?id=eq.${enquiry_id}`, {
        method: 'PATCH',
        headers: { ...supabaseHeaders(SUPABASE_SERVICE_KEY), 'Prefer': 'return=representation' },
        body: JSON.stringify({ status: 'confirmed', course_id: courseId }),
      });
      if (!ur.ok) console.error('Enquiry update failed:', await ur.text());
    } catch (err) { console.error('Enquiry update error:', err); }
  }

  return jsonResponse({
    success: true, course_id: courseId,
    course_code: courseCode, event_id: calendarEventId, student_ids: studentIds,
  });
}
