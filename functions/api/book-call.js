// functions/api/book-call.js
// POST /api/book-call — public booking of a 15-minute intro call.
//
// Ordering matters here:
//   1. availability is re-derived server side, never taken from the client;
//   2. the row is inserted BEFORE Google is touched, so the partial unique
//      index on (teacher_id, starts_at) is what decides a race — two visitors
//      cannot both walk away with a Meet link;
//   3. everything after the insert (student record, calendar, emails) is
//      best effort. A calendar failure downgrades delivery to 'email' and
//      keeps the booking; it never rolls the row back, because that would
//      free the slot while a confirmed visitor is holding it.

import {
  supabaseHeaders,
  jsonResponse,
  errorResponse,
  withErrorHandling,
  parseJsonBody,
  validateOrigin,
  checkRateLimit,
  capitalizeNameFields,
  getValidAccessToken,
} from './_utils.js';
import { validate } from './_validate.js';
import { loadCallContext } from './_call-availability.js';
import { slotIsAvailable, SLOT_MINUTES } from './_call-slots.js';
import { createCallCalendarEvent } from './_calendar.js';
import { buildCallIcs, icsToBase64 } from './_ics.js';
import { sendResendEmail, FROM_EMAIL } from './_email.js';
import {
  buildCallConfirmationEmail,
  buildCallNotificationEmail,
  formatCallWhen,
} from './_call-email.js';
import { findOrCreateStudent } from './_student-utils.js';

const NOTIFY_EMAILS = ['info@learningwithgioia.ch'];
const ORGANIZER_EMAIL = 'hello@oiagi.org';
const MAX_UPCOMING_PER_EMAIL = 2;

function cleanString(value, max) {
  if (value === null || value === undefined) return null;
  const cleaned = String(value).replace(/\s+/g, ' ').trim();
  return cleaned ? cleaned.slice(0, max) : null;
}

export const onRequestPost = withErrorHandling(async ({ request, env }) => {
  const originErr = validateOrigin(request, env);
  if (originErr) return originErr;

  // Stricter than the default 5/60s: every accepted request consumes a
  // scarce slot in Gioia's week.
  const limited = await checkRateLimit(request, { maxRequests: 3, windowSeconds: 600 });
  if (limited) return limited;

  const { body, error } = await parseJsonBody(request);
  if (error) return error;

  // Honeypot — pretend success so a bot has nothing to tune against.
  if (body.website) return jsonResponse({ success: true });

  const validationErr = validate(body, {
    start: { required: true, type: 'string', maxLength: 40 },
    first_name: { required: true, type: 'string', maxLength: 100 },
    last_name: { required: true, type: 'string', maxLength: 100 },
    email: { required: true, type: 'string', email: true, maxLength: 320 },
    phone: { type: 'string', maxLength: 40 },
    topic: { type: 'string', maxLength: 1000 },
    language: { type: 'string', oneOf: ['en', 'de'] },
  });
  if (validationErr) return errorResponse(validationErr, 400);

  if (body.consent !== true) {
    return errorResponse('Please accept the terms and conditions.', 400);
  }

  const startMs = Date.parse(body.start);
  if (Number.isNaN(startMs) || startMs % (SLOT_MINUTES * 60 * 1000) !== 0) {
    return errorResponse('Invalid time slot.', 400);
  }
  const startIso = new Date(startMs).toISOString();

  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;
  const headers = supabaseHeaders(SUPABASE_SERVICE_KEY);
  const language = body.language === 'de' ? 'de' : 'en';
  const email = String(body.email).trim().toLowerCase();

  const fields = capitalizeNameFields(
    {
      first_name: cleanString(body.first_name, 100),
      last_name: cleanString(body.last_name, 100),
    },
    ['first_name', 'last_name']
  );
  const phone = cleanString(body.phone, 40);
  const topic = cleanString(body.topic, 1000);

  // ── Abuse guard: a handful of upcoming calls per address is plenty ──────
  const existingRes = await fetch(
    `${SUPABASE_URL}/rest/v1/call_bookings?select=id&status=eq.booked` +
      `&email=eq.${encodeURIComponent(email)}&starts_at=gte.${new Date().toISOString()}`,
    { headers }
  );
  if (existingRes.ok) {
    const existing = await existingRes.json();
    if (existing.length >= MAX_UPCOMING_PER_EMAIL) {
      return errorResponse(
        'You already have a call booked. Reply to your confirmation email to change it.',
        409
      );
    }
  }

  // ── Re-derive availability; never trust the submitted slot ──────────────
  let context;
  try {
    context = await loadCallContext(env);
  } catch (err) {
    console.error('book-call availability error:', err?.message || err);
    return errorResponse('Live availability is unavailable right now.', 503);
  }
  if (!context.teacher || !slotIsAvailable(startIso, context.days)) {
    return errorResponse('That time is no longer available. Please choose another slot.', 409);
  }
  const teacher = context.teacher;

  // ── Insert first: the unique index is the real race guard ───────────────
  const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/call_bookings`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'return=representation' },
    body: JSON.stringify({
      teacher_id: teacher.id,
      starts_at: startIso,
      duration_minutes: SLOT_MINUTES,
      status: 'booked',
      first_name: fields.first_name,
      last_name: fields.last_name,
      email,
      phone,
      topic,
      language,
      delivery: 'pending',
      consent_at: new Date().toISOString(),
    }),
  });
  if (insertRes.status === 409) {
    return errorResponse('That time was just taken. Please pick another slot.', 409);
  }
  if (!insertRes.ok) {
    console.error('book-call insert error:', await insertRes.text());
    return errorResponse('Could not book the call. Please try again.');
  }
  const booking = (await insertRes.json())[0];

  // ── Everything below is best effort ─────────────────────────────────────
  try {
    const studentId = await findOrCreateStudent(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      first_name: fields.first_name,
      last_name: fields.last_name,
      email,
      phone,
      source: 'website',
    });
    if (studentId) {
      booking.student_id = studentId;
      await fetch(`${SUPABASE_URL}/rest/v1/call_bookings?id=eq.${booking.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ student_id: studentId }),
      });
    }
  } catch (err) {
    console.error('book-call student error:', err?.message || err);
  }

  // getValidAccessToken throws (401 on invalid_grant, 502 on invalid_client).
  // Letting that escape would hand a 401 to a visitor whose booking already
  // exists, so the whole Google block is contained.
  let delivery = 'email';
  try {
    if (!teacher.refresh_token || !teacher.calendar_id) {
      throw new Error('teacher has no Google Calendar authorisation');
    }
    const accessToken = await getValidAccessToken(teacher, env);
    const event = await createCallCalendarEvent({
      accessToken,
      calendarId: teacher.calendar_id,
      bookingId: booking.id,
      startIso,
      durationMinutes: SLOT_MINUTES,
      visitorName: `${fields.first_name} ${fields.last_name || ''}`.trim(),
      visitorEmail: email,
      visitorPhone: phone,
      topic,
      language,
      teacherName: teacher.name || 'learning with gioia',
    });
    booking.calendar_event_id = event.eventId;
    booking.meet_link = event.meetLink;
    delivery = 'calendar';
    await fetch(`${SUPABASE_URL}/rest/v1/call_bookings?id=eq.${booking.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        calendar_event_id: event.eventId,
        meet_link: event.meetLink,
        delivery: 'calendar',
      }),
    });
  } catch (err) {
    console.error('book-call calendar error:', err?.message || err);
    await fetch(`${SUPABASE_URL}/rest/v1/call_bookings?id=eq.${booking.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ delivery: 'email' }),
    }).catch(() => {});
  }
  booking.delivery = delivery;

  if (env.RESEND_API_KEY) {
    const confirmation = buildCallConfirmationEmail(booking);
    const message = {
      to: [email],
      reply_to: NOTIFY_EMAILS,
      subject: confirmation.subject,
      html: confirmation.html,
    };

    // Only on the fallback path: on the calendar path Google sends its own
    // invitation, and a second .ics with a different UID would duplicate the
    // entry in the visitor's calendar.
    if (delivery === 'email') {
      const ics = buildCallIcs({
        uid: booking.id,
        startIso,
        durationMinutes: SLOT_MINUTES,
        summary:
          language === 'de'
            ? `${SLOT_MINUTES}-Minuten-Gespräch mit learning with gioia`
            : `${SLOT_MINUTES}min call with learning with gioia`,
        description: formatCallWhen(startIso, language),
        organizerEmail: ORGANIZER_EMAIL,
        attendeeName: `${fields.first_name} ${fields.last_name || ''}`.trim(),
        attendeeEmail: email,
        url: 'https://learningwithgioia.ch',
      });
      message.attachments = [
        {
          filename: 'call.ics',
          content: icsToBase64(ics),
          content_type: 'text/calendar; method=REQUEST',
        },
      ];
    }

    const notification = buildCallNotificationEmail(booking);
    const results = await Promise.allSettled([
      sendResendEmail(env.RESEND_API_KEY, message),
      sendResendEmail(env.RESEND_API_KEY, {
        from: FROM_EMAIL,
        to: NOTIFY_EMAILS,
        reply_to: [email],
        subject: notification.subject,
        html: notification.html,
      }),
    ]);
    for (const r of results) {
      if (r.status === 'rejected') console.error('book-call email error:', r.reason);
      else if (!r.value.ok) console.error('book-call email error:', await r.value.text());
    }
  }

  return jsonResponse({
    success: true,
    start: startIso,
    meet_link: booking.meet_link || null,
    delivery,
  });
}, 'book-call');
