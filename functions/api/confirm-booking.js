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
//   6. Sync session records from the recurring calendar event
//   7. Find or create student records per participant + enrolments
//   8. Update enquiry status to confirmed
//
// Environment variables:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY, GOOGLE_CLIENT_ID,
//   GOOGLE_CLIENT_SECRET

import {
  supabaseHeaders,
  requireAdminAuth,
  getValidAccessToken,
  jsonResponse,
  errorResponse,
  withErrorHandling,
  parseJsonBody,
} from './_utils.js';
import { createCourseCalendarEvent, fetchCourseEvents } from './_calendar.js';
import {
  completeEnquiriesForEnrolment,
  findOrCreateStudent,
  setStudentStatus,
} from './_student-utils.js';
import { normalizeAccessCode } from './_public-course-booking.js';

// ── Course code helpers ──────────────────────────────────────────────

function getGroupType(booking) {
  const group = (booking.groupSize || booking.group || '').toLowerCase();
  if (!group || group.includes('private') || group.includes('1')) return 'private';
  if (group.includes('duo') || group.includes('2')) return 'duo';
  return 'group';
}

function getLevelCode(booking) {
  if (booking.language === 'Swiss German') return 'CH';
  if (booking.course_type === 'tutoring') return 'SUB';
  return booking.level || 'XX';
}

// 5-digit random course code (10000–99999). Uniqueness is enforced by the
// courses.course_code unique index; callers retry on insert collision.
function generateCourseCode() {
  return String(10000 + Math.floor(Math.random() * 90000));
}

function dateOnly(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

// ── Main handler ─────────────────────────────────────────────────────

export const onRequestPost = withErrorHandling(async ({ request, env }) => {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;

  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  const { body, error } = await parseJsonBody(request);
  if (error) return error;

  const {
    enquiry_id,
    teacher_id,
    sessions_total,
    first_session_at,
    duration_minutes = 50,
    session_length_minutes,
    price_per_session,
    price_per_person_per_60min,
    location,
    location_company,
    location_street,
    location_street_number,
    location_postal_code,
    location_city,
    public_booking_enabled,
    company_code_booking_enabled,
    access_code,
    access_label,
    course_code_override,
    single_session = false,
    booking_data,
    contact_data,
  } = body;

  if (!teacher_id || !first_session_at) {
    return errorResponse('Missing teacher_id or first_session_at', 400);
  }
  if (company_code_booking_enabled && !normalizeAccessCode(access_code)) {
    return errorResponse('access_code is required for company code booking', 400);
  }

  // ── Load enquiry or use inline booking/contact data ─────────────────
  let booking = booking_data || {},
    contact = contact_data || {};
  if (enquiry_id) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/enquiries?id=eq.${enquiry_id}&select=*`, {
      headers: supabaseHeaders(SUPABASE_SERVICE_KEY),
    });
    const rows = await r.json();
    if (!rows.length) return errorResponse('Enquiry not found', 404);
    booking = { ...(rows[0].booking_data || {}), ...(booking_data || {}) };
    contact = contact_data || rows[0].contact_data || {};
  }

  // ── Load teacher ────────────────────────────────────────────────────
  const tr = await fetch(`${SUPABASE_URL}/rest/v1/teachers?id=eq.${teacher_id}&select=*`, {
    headers: supabaseHeaders(SUPABASE_SERVICE_KEY),
  });
  const teachers = await tr.json();
  if (!teachers.length) return errorResponse('Teacher not found', 404);
  const teacher = teachers[0];

  const canUseCalendar = !!teacher.refresh_token && !!teacher.calendar_id;
  if (!canUseCalendar && !single_session) {
    return errorResponse(
      'Teacher has not authorised Google Calendar. Re-authorise the teacher or choose the manual first-session option.',
      400
    );
  }

  let accessToken;
  if (canUseCalendar) {
    try {
      accessToken = await getValidAccessToken(teacher, env);
    } catch (err) {
      console.error('Token error:', err);
      if (!single_session) return errorResponse(err.message, err.statusCode || 500);
    }
  }

  // ── Course code ───────────────────────────────────────────────────────
  const groupType = getGroupType(booking);
  const levelCode = getLevelCode(booking);

  let courseCode = course_code_override;
  if (!courseCode) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = generateCourseCode();
      const check = await fetch(
        `${SUPABASE_URL}/rest/v1/courses?course_code=eq.${candidate}&select=id`,
        { headers: supabaseHeaders(SUPABASE_SERVICE_KEY) }
      );
      const existing = await check.json();
      if (Array.isArray(existing) && existing.length === 0) {
        courseCode = candidate;
        break;
      }
    }
    if (!courseCode) {
      console.error('Course code generation: exhausted retries');
      return errorResponse('Could not generate course code');
    }
  }

  // ── Calendar event ───────────────────────────────────────────────────
  let calendarEventId = null,
    recurrenceRule = null;
  if (accessToken && teacher.calendar_id) {
    try {
      ({ eventId: calendarEventId, recurrenceRule } = await createCourseCalendarEvent({
        accessToken,
        calendarId: teacher.calendar_id,
        courseCode,
        booking,
        contact,
        teacherName: teacher.name,
        firstSessionAt: first_session_at,
        durationMinutes: duration_minutes,
        sessionsTotal: sessions_total,
        singleSession: single_session,
      }));
    } catch (err) {
      console.error('Calendar API error:', err);
      if (!single_session) return errorResponse(err.message || 'Calendar API error');
    }
  }

  // ── Course record ────────────────────────────────────────────────────
  const participants = contact.participants || [];
  const participantNames = participants.map((p) => p.firstName).filter(Boolean);

  let courseId;
  try {
    const cr = await fetch(`${SUPABASE_URL}/rest/v1/courses`, {
      method: 'POST',
      headers: { ...supabaseHeaders(SUPABASE_SERVICE_KEY), Prefer: 'return=representation' },
      body: JSON.stringify({
        course_code: courseCode,
        course_type: booking.course_type || null,
        subject: booking.subject || null,
        level: levelCode,
        group_type: groupType,
        teacher_id,
        participant_names: participantNames,
        participants,
        sessions_total: sessions_total || null,
        sessions_completed: 0,
        session_length_minutes: session_length_minutes || duration_minutes || null,
        price_per_session: price_per_session ?? null,
        price_per_person_per_60min: price_per_person_per_60min ?? null,
        location: location || null,
        location_company: location_company || null,
        location_street: location_street || null,
        location_street_number: location_street_number || null,
        location_postal_code: location_postal_code || null,
        location_city: location_city || null,
        public_booking_enabled: !!public_booking_enabled,
        company_code_booking_enabled: !!company_code_booking_enabled,
        access_code: normalizeAccessCode(access_code),
        access_label: access_label || null,
        recurrence_rule: recurrenceRule,
        calendar_event_id: calendarEventId,
        enquiry_id: enquiry_id || null,
        status: 'active',
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

  // ── Sync/create sessions ─────────────────────────────────────────────
  if (calendarEventId) {
    try {
      const { active } = await fetchCourseEvents({
        accessToken,
        calendarId: teacher.calendar_id,
        courseCode,
      });
      const now = new Date();
      for (const event of active) {
        const scheduledAt = event.start.dateTime || event.start.date;
        const isPast = new Date(scheduledAt) < now;
        await fetch(`${SUPABASE_URL}/rest/v1/sessions`, {
          method: 'POST',
          headers: supabaseHeaders(SUPABASE_SERVICE_KEY),
          body: JSON.stringify({
            course_id: courseId,
            teacher_id,
            scheduled_at: scheduledAt,
            duration_minutes,
            status: isPast ? 'completed' : 'scheduled',
            calendar_event_id: event.id,
          }),
        });
      }
    } catch (err) {
      console.error('Session sync error:', err);
    }
  }

  if (!calendarEventId) {
    const now = new Date();
    const isPast = new Date(first_session_at) < now;
    const sr = await fetch(`${SUPABASE_URL}/rest/v1/sessions`, {
      method: 'POST',
      headers: supabaseHeaders(SUPABASE_SERVICE_KEY),
      body: JSON.stringify({
        course_id: courseId,
        teacher_id,
        scheduled_at: first_session_at,
        duration_minutes,
        status: isPast ? 'completed' : 'scheduled',
        calendar_event_id: null,
      }),
    });
    if (!sr.ok) console.error('Manual session creation failed:', await sr.text());
  }

  // ── Students + enrolments ────────────────────────────────────────────
  const source = enquiry_id ? 'website' : 'manual';
  const studentIds = [];
  for (const p of participants) {
    try {
      // Existing student was picked from autocomplete: skip dedup, use id directly.
      const sid = p.studentId
        ? p.studentId
        : await findOrCreateStudent(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
            first_name: p.firstName,
            last_name: p.lastName,
            email: p.email,
            phone: p.phone,
            postcode: p.postcode,
            source,
          });
      studentIds.push(sid);
      await fetch(`${SUPABASE_URL}/rest/v1/enrolments`, {
        method: 'POST',
        headers: {
          ...supabaseHeaders(SUPABASE_SERVICE_KEY),
          Prefer: 'resolution=ignore-duplicates',
        },
        body: JSON.stringify({
          student_id: sid,
          course_id: courseId,
          joined_at: dateOnly(first_session_at),
        }),
      });
      await setStudentStatus(SUPABASE_URL, SUPABASE_SERVICE_KEY, sid, 'active');
      if (!enquiry_id) {
        await completeEnquiriesForEnrolment(SUPABASE_URL, SUPABASE_SERVICE_KEY, sid, courseId);
      }
    } catch (err) {
      console.error('Student/enrolment error:', err);
    }
  }

  // ── Update enquiry ───────────────────────────────────────────────────
  if (enquiry_id) {
    try {
      const ur = await fetch(`${SUPABASE_URL}/rest/v1/enquiries?id=eq.${enquiry_id}`, {
        method: 'PATCH',
        headers: { ...supabaseHeaders(SUPABASE_SERVICE_KEY), Prefer: 'return=representation' },
        body: JSON.stringify({
          status: 'confirmed',
          course_id: courseId,
          student_id: studentIds[0] || null,
        }),
      });
      if (!ur.ok) console.error('Enquiry update failed:', await ur.text());
    } catch (err) {
      console.error('Enquiry update error:', err);
    }
  }

  return jsonResponse({
    success: true,
    course_id: courseId,
    course_code: courseCode,
    event_id: calendarEventId,
    student_ids: studentIds,
  });
}, 'confirm-booking');
