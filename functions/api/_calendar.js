// functions/api/_calendar.js
// Shared Google Calendar helpers for course management.

/**
 * Create a recurring Google Calendar event for a course.
 *
 * @param {object} opts
 * @param {string} opts.accessToken  — Google OAuth access token
 * @param {string} opts.calendarId   — Teacher's calendar ID
 * @param {string} opts.courseCode   — e.g. "P-A1-001"
 * @param {object} opts.booking      — Booking data (service, level, language, exam)
 * @param {object} opts.contact      — Contact data (lead, participants)
 * @param {string} opts.teacherName  — Teacher display name
 * @param {string} opts.firstSessionAt — ISO datetime for first session
 * @param {number} opts.durationMinutes — Session duration (default 50)
 * @param {number|null} opts.sessionsTotal — Block size or null for open-ended
 * @returns {Promise<string>} Calendar event ID
 */
export async function createCourseCalendarEvent({
  accessToken,
  calendarId,
  courseCode,
  booking,
  contact,
  teacherName,
  firstSessionAt,
  durationMinutes = 50,
  sessionsTotal,
}) {
  const participants = contact.participants || [];
  const participantNames = participants.map((p) => p.firstName).filter(Boolean);
  const startTime = new Date(firstSessionAt);
  const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);

  const eventTitle = participantNames.length
    ? `${courseCode} — ${participantNames.join('+')} <> ${teacherName}`
    : `${courseCode} <> ${teacherName}`;

  const sessionsLine = sessionsTotal
    ? `Sessions: ${sessionsTotal} × 50min\n`
    : 'Sessions: open-ended\n';

  const dayNames = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  const rruleDay = dayNames[startTime.getDay()];
  const recurrence = sessionsTotal
    ? [`RRULE:FREQ=WEEKLY;BYDAY=${rruleDay};COUNT=${sessionsTotal}`]
    : [`RRULE:FREQ=WEEKLY;BYDAY=${rruleDay}`];

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?sendUpdates=none`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        summary: eventTitle,
        description:
          `Course: ${courseCode}\n` +
          (booking.lessonType
            ? `What: ${booking.lessonType}\n`
            : `Service: ${booking.service || ''}\n`) +
          (booking.level ? `Level: ${booking.level}\n` : '') +
          (booking.language ? `Language: ${booking.language}\n` : '') +
          (booking.exam ? `Exam: ${booking.exam}\n` : '') +
          sessionsLine +
          `\nLead: ${contact.lead?.firstName || ''} ${contact.lead?.lastName || ''}` +
          `\nEmail: ${contact.lead?.email || ''}` +
          `\nPhone: ${contact.lead?.phone || ''}`,
        start: { dateTime: startTime.toISOString(), timeZone: 'Europe/Zurich' },
        end: { dateTime: endTime.toISOString(), timeZone: 'Europe/Zurich' },
        recurrence,
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error('Calendar error:', err);
    throw new Error('Could not create calendar event');
  }

  const data = await res.json();
  return { eventId: data.id, recurrenceRule: recurrence[0].replace('RRULE:', '') };
}

/**
 * Fetch expanded single events from Google Calendar matching a course code.
 *
 * Starts from 90 days ago so we don't blow past the 250-event cap with
 * legacy sessions, and matches the course code as a prefix followed by a
 * non-alphanumeric boundary — otherwise "12345" would false-positive on a
 * summary starting with "123456".
 *
 * @param {object} opts
 * @param {string} opts.accessToken
 * @param {string} opts.calendarId
 * @param {string} opts.courseCode
 * @returns {Promise<{active: object[], cancelled: object[]}>}
 */
export async function fetchCourseEvents({ accessToken, calendarId, courseCode }) {
  const timeMin = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?` +
      `q=${encodeURIComponent(courseCode)}` +
      `&singleEvents=true&orderBy=startTime&maxResults=250` +
      `&timeMin=${encodeURIComponent(timeMin)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error('Calendar fetch error:', err);
    throw new Error(`Calendar API error: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  const items = data.items || [];

  const matches = (e) => {
    const s = e.summary || '';
    if (!s.startsWith(courseCode)) return false;
    const next = s.charAt(courseCode.length);
    return next === '' || /[^A-Za-z0-9]/.test(next);
  };

  return {
    active: items.filter((e) => matches(e) && e.status !== 'cancelled'),
    cancelled: items.filter((e) => matches(e) && e.status === 'cancelled'),
  };
}
