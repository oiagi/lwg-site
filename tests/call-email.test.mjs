import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildCallIcs, icsStamp, icsToBase64 } from '../functions/api/_ics.js';
import {
  buildCallConfirmationEmail,
  buildCallNotificationEmail,
  formatCallWhen,
  formatCallWhenShort,
} from '../functions/api/_call-email.js';

const START = '2026-08-21T07:00:00.000Z'; // 09:00 Zurich, CEST

const booking = (over = {}) => ({
  id: 'abc-123',
  starts_at: START,
  duration_minutes: 15,
  first_name: 'Anna',
  last_name: 'Muster',
  email: 'anna@example.com',
  phone: '+41 79 000 00 00',
  topic: 'Gymivorbereitung',
  language: 'en',
  delivery: 'calendar',
  meet_link: 'https://meet.google.com/abc-defg-hij',
  ...over,
});

// ── Formatting ───────────────────────────────────────────────────────────

test('formatCallWhen renders Zurich local time, not UTC', () => {
  assert.match(formatCallWhen(START, 'en'), /09:00/);
  assert.match(formatCallWhen(START, 'en'), /Friday/);
  assert.match(formatCallWhen(START, 'de'), /09:00/);
  assert.match(formatCallWhen(START, 'de'), /um/);
});

test('formatCallWhenShort is compact and carries the time', () => {
  assert.match(formatCallWhenShort(START, 'en'), /09:00/);
  assert.ok(formatCallWhenShort(START, 'en').length < 24);
});

// ── Visitor confirmation ─────────────────────────────────────────────────

test('confirmation: English subject carries the short date', () => {
  const { subject } = buildCallConfirmationEmail(booking());
  assert.match(subject, /Your 15-minute call is booked/);
  assert.match(subject, /09:00/);
  assert.match(subject, /Zürich/);
});

test('confirmation: German copy is used for language "de"', () => {
  const { subject, html } = buildCallConfirmationEmail(booking({ language: 'de' }));
  assert.match(subject, /Dein 15-Minuten-Gespräch ist gebucht/);
  assert.match(html, /lang="de"/);
  assert.match(html, /Danke, Anna/);
  // Informal "du", never "Sie" or "Student".
  assert.match(html, /Antworte einfach auf diese E-Mail/);
  assert.doesNotMatch(html, /Student/);
});

test('confirmation: calendar delivery mentions the Google invitation', () => {
  const { html } = buildCallConfirmationEmail(booking({ delivery: 'calendar' }));
  assert.match(html, /Google Calendar invitation/);
  assert.doesNotMatch(html, /\.ics/);
});

test('confirmation: email delivery mentions the attached .ics instead', () => {
  const { html } = buildCallConfirmationEmail(booking({ delivery: 'email' }));
  assert.match(html, /\.ics/);
  assert.doesNotMatch(html, /Google Calendar invitation/);
});

test('confirmation: a Meet link renders a join button', () => {
  const { html } = buildCallConfirmationEmail(booking());
  assert.match(html, /Join the call/);
  assert.match(html, /meet\.google\.com/);
});

test('confirmation: a missing Meet link degrades to "link follows"', () => {
  const { html } = buildCallConfirmationEmail(booking({ meet_link: null }));
  assert.doesNotMatch(html, /Join the call/);
  assert.match(html, /The link follows in the calendar invitation/);
});

test('confirmation: the reschedule line is always present', () => {
  for (const delivery of ['calendar', 'email']) {
    const { html } = buildCallConfirmationEmail(booking({ delivery }));
    assert.match(html, /Need a different time\? Just reply to this email\./);
  }
});

test('confirmation: visitor-supplied values are escaped', () => {
  const { html } = buildCallConfirmationEmail(booking({ first_name: '<script>x</script>' }));
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});

// ── Internal notification ────────────────────────────────────────────────

test('notification: normal subject when the event reached the calendar', () => {
  const { subject, html } = buildCallNotificationEmail(booking());
  assert.match(subject, /^New 15min call — Anna Muster/);
  assert.doesNotMatch(subject, /NOT ON CALENDAR/);
  assert.match(html, /calendar invite sent/);
});

test('notification: fallback delivery is flagged loudly in the subject', () => {
  const { subject, html } = buildCallNotificationEmail(booking({ delivery: 'email' }));
  assert.match(subject, /^⚠ NOT ON CALENDAR — New 15min call/);
  assert.match(html, /add it manually/);
});

test('notification: a pending delivery also counts as not-on-calendar', () => {
  const { subject } = buildCallNotificationEmail(booking({ delivery: 'pending' }));
  assert.match(subject, /NOT ON CALENDAR/);
});

test('notification: carries every field Gioia needs to act on', () => {
  const { html } = buildCallNotificationEmail(booking());
  for (const needle of ['anna@example.com', '+41 79 000 00 00', 'Gymivorbereitung', 'abc-123']) {
    assert.ok(html.includes(needle), `expected notification to include ${needle}`);
  }
});

test('notification: topic is escaped', () => {
  const { html } = buildCallNotificationEmail(booking({ topic: '<img src=x onerror=1>' }));
  assert.doesNotMatch(html, /<img/);
});

// ── ICS ──────────────────────────────────────────────────────────────────

test('icsStamp formats as basic UTC', () => {
  assert.equal(icsStamp(START), '20260821T070000Z');
});

test('buildCallIcs produces a CRLF REQUEST with matching start and end', () => {
  const ics = buildCallIcs({
    uid: 'abc-123',
    startIso: START,
    durationMinutes: 15,
    summary: 'Test call',
    organizerEmail: 'hello@oiagi.org',
    attendeeEmail: 'anna@example.com',
    now: Date.parse('2026-08-09T12:00:00Z'),
  });
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /\r\nEND:VCALENDAR\r\n$/);
  assert.match(ics, /METHOD:REQUEST/);
  assert.match(ics, /UID:call-abc-123@learningwithgioia\.ch/);
  assert.match(ics, /DTSTART:20260821T070000Z/);
  assert.match(ics, /DTEND:20260821T071500Z/);
  assert.match(ics, /DTSTAMP:20260809T120000Z/);
  assert.match(ics, /mailto:anna@example\.com/);
  // Every line must be CRLF-terminated, never bare LF.
  assert.equal(ics.split('\n').length - 1, ics.split('\r\n').length - 1);
});

test('buildCallIcs escapes commas, semicolons and newlines in TEXT values', () => {
  const ics = buildCallIcs({
    uid: 'x',
    startIso: START,
    summary: 'A, B; C\\D',
    description: 'line one\nline two',
    organizerEmail: 'hello@oiagi.org',
    attendeeEmail: 'a@b.ch',
  });
  assert.match(ics, /SUMMARY:A\\, B\\; C\\\\D/);
  assert.match(ics, /DESCRIPTION:line one\\nline two/);
});

test('icsToBase64 survives umlauts', () => {
  const ics = buildCallIcs({
    uid: 'x',
    startIso: START,
    summary: 'Gespräch mit Jürg',
    organizerEmail: 'hello@oiagi.org',
    attendeeEmail: 'a@b.ch',
  });
  const decoded = new TextDecoder().decode(
    Uint8Array.from(atob(icsToBase64(ics)), (c) => c.charCodeAt(0))
  );
  assert.equal(decoded, ics);
  assert.match(decoded, /Gespräch mit Jürg/);
});
