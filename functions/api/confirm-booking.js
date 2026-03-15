// functions/api/confirm-booking.js
// POST /api/confirm-booking
// Body: {
//   enquiry_id,       — UUID of the enquiry being confirmed
//   teacher_id,       — UUID of the assigned teacher
//   sessions_total,   — number of sessions in the block (null = open-ended)
//   first_session_at, — ISO datetime string for the first session
//   duration_minutes, — session duration (default 50)
// }
//
// What this function does:
//   1. Loads the enquiry and teacher from Supabase
//   2. Refreshes the teacher's Google OAuth token if needed
//   3. Auto-generates a course code (e.g. G_A1_3)
//   4. Creates a Google Calendar event for the first session
//   5. Creates a course record in Supabase
//   6. Updates the enquiry status to 'confirmed' and links the course
//   7. Sets up a Google Calendar webhook to watch for future changes
//
// Environment variables:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
//   ADMIN_PASSWORD

const SUPABASE_HEADERS = (key) => ({
  'Content-Type':  'application/json',
  'apikey':        key,
  'Authorization': `Bearer ${key}`,
});

// ── Token management ──────────────────────────────────────────────────

async function getValidAccessToken(teacher, env) {
  /* If token is still valid (with 5 min buffer), return it */
  const expiresAt = new Date(teacher.token_expires_at);
  if (expiresAt > new Date(Date.now() + 5 * 60 * 1000)) {
    return teacher.access_token;
  }

  /* Refresh the token */
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

  const tokens     = await res.json();
  const expiresAt2 = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  /* Store updated token in Supabase */
  await fetch(
    `${env.SUPABASE_URL}/rest/v1/teachers?id=eq.${teacher.id}`,
    {
      method:  'PATCH',
      headers: SUPABASE_HEADERS(env.SUPABASE_SERVICE_KEY),
      body:    JSON.stringify({
        access_token:     tokens.access_token,
        token_expires_at: expiresAt2,
      }),
    }
  );

  return tokens.access_token;
}

// ── Course code generation ────────────────────────────────────────────

function getCoursePrefix(groupType) {
  if (groupType === 'private') return 'P';
  if (groupType === 'duo')     return 'D';
  return 'G';
}

function getLevelCode(booking) {
  /* Swiss German uses CH regardless of CEFR level */
  if (booking.language === 'Swiss German') return 'CH';
  /* Tutoring uses SUB (subject-based) */
  if (booking.service === 'tutoring') return 'SUB';
  /* Exam prep and language courses use CEFR level */
  return booking.level || 'XX';
}

async function getNextCourseCode(prefix, levelCode, env) {
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/rpc/get_next_course_code`,
    {
      method:  'POST',
      headers: SUPABASE_HEADERS(env.SUPABASE_SERVICE_KEY),
      body:    JSON.stringify({ prefix, level_code: levelCode }),
    }
  );
  if (!res.ok) throw new Error(`Course code generation failed: ${await res.text()}`);
  const code = await res.json();
  return code;
}

// ── Calendar event creation ───────────────────────────────────────────

function buildEventTitle(courseCode, participantNames, teacherName) {
  /* Format: G_A1_1 — Anna+Marco+Sofia <> Gioia */
  const names = participantNames.join('+');
  return `${courseCode} — ${names} <> ${teacherName}`;
}

function buildEventDescription(enquiry, course) {
  const b = enquiry.booking_data  || {};
  const c = enquiry.contact_data  || {};
  const lead = c.lead || {};

  const lines = [
    `Course: ${courseCode}`,
    `Service: ${b.service || ''}`,
    b.level    ? `Level: ${b.level}`       : null,
    b.language ? `Language: ${b.language}` : null,
    b.exam     ? `Exam: ${b.exam}`         : null,
    ``,
    `Lead contact: ${lead.firstName || ''} ${lead.lastName || ''}`,
    lead.email ? `Email: ${lead.email}`   : null,
    lead.phone ? `Phone: ${lead.phone}`   : null,
  ].filter(l => l !== null);

  if (c.participants && c.participants.length > 0) {
    lines.push('', 'Participants:');
    c.participants.forEach((p, i) => {
      const name = [p.firstName, p.lastName].filter(Boolean).join(' ');
      const contact = [p.email, p.phone].filter(Boolean).join(' · ');
      lines.push(`  ${i + 1}. ${name}${contact ? ' — ' + contact : ''}`);
    });
  }

  return lines.join('\n');
}

// ── Main handler ──────────────────────────────────────────────────────

export async function onRequestPost({ request, env }) {
  const SUPABASE_URL         = env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = env.SUPABASE_SERVICE_KEY;
  const ADMIN_PASSWORD       = env.ADMIN_PASSWORD;

  // ── Auth check ───────────────────────────────────────────────────────
  const pwd = request.headers.get('x-admin-password');
  if (!pwd || pwd !== ADMIN_PASSWORD) {
    return new Response(JSON.stringify({ error: 'Unauthorised' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── Parse body ───────────────────────────────────────────────────────
  let enquiry_id, teacher_id, sessions_total, first_session_at, duration_minutes;
  try {
    ({ enquiry_id, teacher_id, sessions_total, first_session_at,
       duration_minutes = 50 } = await request.json());
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!enquiry_id || !teacher_id || !first_session_at) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── Load enquiry ─────────────────────────────────────────────────────
  const enquiryRes = await fetch(
    `${SUPABASE_URL}/rest/v1/enquiries?id=eq.${enquiry_id}&select=*`,
    { headers: SUPABASE_HEADERS(SUPABASE_SERVICE_KEY) }
  );
  if (!enquiryRes.ok) {
    return new Response(JSON.stringify({ error: 'Could not load enquiry' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
  const enquiries = await enquiryRes.json();
  if (!enquiries.length) {
    return new Response(JSON.stringify({ error: 'Enquiry not found' }), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }
  const enquiry = enquiries[0];
  const booking = enquiry.booking_data || {};
  const contact = enquiry.contact_data || {};

  // ── Load teacher ─────────────────────────────────────────────────────
  const teacherRes = await fetch(
    `${SUPABASE_URL}/rest/v1/teachers?id=eq.${teacher_id}&select=*`,
    { headers: SUPABASE_HEADERS(SUPABASE_SERVICE_KEY) }
  );
  const teachers = await teacherRes.json();
  if (!teachers.length) {
    return new Response(JSON.stringify({ error: 'Teacher not found' }), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }
  const teacher = teachers[0];

  // ── Check teacher has authorised calendar access ──────────────────────
  if (!teacher.refresh_token) {
    return new Response(JSON.stringify({
      error: 'Teacher has not authorised Google Calendar access. Please authenticate first.',
    }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── Get valid access token ────────────────────────────────────────────
  let accessToken;
  try {
    accessToken = await getValidAccessToken(teacher, env);
  } catch (err) {
    console.error('Token error:', err);
    return new Response(JSON.stringify({ error: 'Could not refresh calendar access token' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── Generate course code ──────────────────────────────────────────────
  const groupType = booking.group?.includes('private') ? 'private'
                  : booking.group?.includes('2')       ? 'duo'
                  : 'group';
  const prefix    = getCoursePrefix(groupType);
  const levelCode = getLevelCode(booking);
  let   courseCode;
  try {
    courseCode = await getNextCourseCode(prefix, levelCode, env);
  } catch (err) {
    console.error('Course code error:', err);
    return new Response(JSON.stringify({ error: 'Could not generate course code' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── Build participant names array ─────────────────────────────────────
  const participantNames = (contact.participants || [])
    .map(p => p.firstName)
    .filter(Boolean);

  // ── Create Google Calendar event ──────────────────────────────────────
  const eventTitle = buildEventTitle(courseCode, participantNames, teacher.name);
  const startTime  = new Date(first_session_at);
  const endTime    = new Date(startTime.getTime() + duration_minutes * 60 * 1000);

  const sessionsLine = sessions_total
    ? `Sessions: ${sessions_total} × 50min\n`
    : 'Sessions: open-ended\n';

  const eventBody = {
    summary:     eventTitle,
    description: `Course: ${courseCode}\nService: ${booking.service || ''}\n` +
                 (booking.level    ? `Level: ${booking.level}\n`       : '') +
                 (booking.language ? `Language: ${booking.language}\n` : '') +
                 (booking.exam     ? `Exam: ${booking.exam}\n`         : '') +
                 sessionsLine +
                 `\nLead: ${(contact.lead?.firstName || '')} ${(contact.lead?.lastName || '')}` +
                 `\nEmail: ${contact.lead?.email || ''}` +
                 `\nPhone: ${contact.lead?.phone || ''}`,
    start: { dateTime: startTime.toISOString(), timeZone: 'Europe/Zurich' },
    end:   { dateTime: endTime.toISOString(),   timeZone: 'Europe/Zurich' },
    attendees: (contact.participants || [])
      .filter(p => p.email)
      .map(p => ({ email: p.email, displayName: `${p.firstName || ''} ${p.lastName || ''}`.trim() })),
  };

  let calendarEventId;
  try {
    const calRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(teacher.calendar_id)}/events?sendUpdates=all`,
      {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(eventBody),
      }
    );

    if (!calRes.ok) {
      const err = await calRes.text();
      console.error('Calendar event creation failed:', err);
      return new Response(JSON.stringify({ error: 'Could not create calendar event', detail: err }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      });
    }

    const calEvent = await calRes.json();
    calendarEventId = calEvent.id;
  } catch (err) {
    console.error('Calendar error:', err);
    return new Response(JSON.stringify({ error: 'Calendar API error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── Create course record in Supabase ──────────────────────────────────
  let courseId;
  try {
    const courseRes = await fetch(
      `${SUPABASE_URL}/rest/v1/courses`,
      {
        method:  'POST',
        headers: { ...SUPABASE_HEADERS(SUPABASE_SERVICE_KEY), 'Prefer': 'return=representation' },
        body: JSON.stringify({
          course_code:       courseCode,
          service:           booking.service || null,
          level:             levelCode,
          group_type:        groupType,
          teacher_id:        teacher_id,
          participant_names: participantNames,
          participants:      contact.participants || [],
          sessions_total:    sessions_total || null,
          sessions_completed: 0,
          calendar_event_id: calendarEventId,
          enquiry_id:        enquiry_id,
          status:            'active',
        }),
      }
    );

    if (!courseRes.ok) {
      console.error('Course creation failed:', await courseRes.text());
      return new Response(JSON.stringify({ error: 'Could not create course record' }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      });
    }

    const courses = await courseRes.json();
    courseId = courses[0]?.id;
  } catch (err) {
    console.error('Supabase course error:', err);
    return new Response(JSON.stringify({ error: 'Database error creating course' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── Create first session record ───────────────────────────────────────
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/sessions`, {
      method:  'POST',
      headers: SUPABASE_HEADERS(SUPABASE_SERVICE_KEY),
      body: JSON.stringify({
        course_id:         courseId,
        teacher_id:        teacher_id,
        scheduled_at:      startTime.toISOString(),
        duration_minutes:  duration_minutes,
        status:            'scheduled',
        calendar_event_id: calendarEventId,
      }),
    });
  } catch (err) {
    /* Non-fatal — course is created, session record is secondary */
    console.error('Session record error:', err);
  }

  // ── Update enquiry status to confirmed and link course ────────────────
  try {
    const updateRes = await fetch(
      `${SUPABASE_URL}/rest/v1/enquiries?id=eq.${enquiry_id}`,
      {
        method:  'PATCH',
        headers: { ...SUPABASE_HEADERS(SUPABASE_SERVICE_KEY), 'Prefer': 'return=representation' },
        body:    JSON.stringify({ status: 'confirmed', course_id: courseId }),
      }
    );
    if (!updateRes.ok) {
      const err = await updateRes.text();
      console.error('Enquiry status update failed:', err);
      // Non-fatal — course and calendar event already created successfully
    }
  } catch (err) {
    console.error('Enquiry update error:', err);
  }

  // ── Set up Google Calendar webhook to watch for changes ───────────────
  // This allows the backend to be notified when calendar events change.
  // The watch channel expires after ~1 week and must be renewed.
  try {
    const watchChannel = crypto.randomUUID();
    const watchRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(teacher.calendar_id)}/events/watch`,
      {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          id:      watchChannel,
          type:    'web_hook',
          address: 'https://oiagi.org/api/calendar-webhook',
        }),
      }
    );

    if (watchRes.ok) {
      const watchData  = await watchRes.json();
      const expiryDate = new Date(parseInt(watchData.expiration)).toISOString();
      await fetch(
        `${SUPABASE_URL}/rest/v1/courses?id=eq.${courseId}`,
        {
          method:  'PATCH',
          headers: SUPABASE_HEADERS(SUPABASE_SERVICE_KEY),
          body:    JSON.stringify({
            calendar_watch_channel: watchChannel,
            calendar_watch_expiry:  expiryDate,
          }),
        }
      );
    }
  } catch (err) {
    /* Non-fatal — calendar still works, just no auto-sync */
    console.error('Watch setup error:', err);
  }

  return new Response(JSON.stringify({
    success:     true,
    course_id:   courseId,
    course_code: courseCode,
    event_id:    calendarEventId,
  }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
}
