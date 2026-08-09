// functions/api/_ics.js
// Minimal iCalendar builder for the 15-minute call fallback path.
//
// Used only when the Google Calendar event could not be created (teacher not
// authorised, or the API failed). On the happy path Google sends its own
// invitation and attaching a second .ics with a different UID would give the
// visitor a duplicate entry.
//
// Pure and dependency-free so it can be unit-tested directly.

const DOMAIN = 'learningwithgioia.ch';

/** iCalendar TEXT escaping (RFC 5545 §3.3.11). Order matters: backslash first. */
function escapeText(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Epoch or ISO → 'YYYYMMDDTHHMMSSZ'. */
export function icsStamp(value) {
  return new Date(value)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

/**
 * Build a METHOD:REQUEST VEVENT for a booked call.
 *
 * @param {object} opts
 * @param {string} opts.uid            — stable id, typically the booking id
 * @param {string} opts.startIso
 * @param {number} [opts.durationMinutes]
 * @param {string} opts.summary
 * @param {string} [opts.description]
 * @param {string} [opts.organizerName]
 * @param {string} opts.organizerEmail
 * @param {string} [opts.attendeeName]
 * @param {string} opts.attendeeEmail
 * @param {string} [opts.url]
 * @param {string|number|Date} [opts.now] — DTSTAMP, injectable for tests
 * @returns {string} CRLF-delimited iCalendar document
 */
export function buildCallIcs({
  uid,
  startIso,
  durationMinutes = 15,
  summary,
  description = '',
  organizerName = 'learning with gioia',
  organizerEmail,
  attendeeName = '',
  attendeeEmail,
  url,
  now = Date.now(),
}) {
  const start = new Date(startIso);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//learning with gioia//call booking//EN`,
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:call-${uid}@${DOMAIN}`,
    `DTSTAMP:${icsStamp(now)}`,
    `DTSTART:${icsStamp(start)}`,
    `DTEND:${icsStamp(end)}`,
    `SUMMARY:${escapeText(summary)}`,
    `ORGANIZER;CN=${escapeText(organizerName)}:mailto:${organizerEmail}`,
    `ATTENDEE;CN=${escapeText(attendeeName || attendeeEmail)};ROLE=REQ-PARTICIPANT;` +
      `PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${attendeeEmail}`,
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
  ];
  if (description) lines.push(`DESCRIPTION:${escapeText(description)}`);
  if (url) lines.push(`URL:${escapeText(url)}`);
  lines.push('END:VEVENT', 'END:VCALENDAR');

  return lines.join('\r\n') + '\r\n';
}

/**
 * Base64-encode an .ics for a Resend attachment.
 *
 * btoa() is byte-oriented, so the string has to go through TextEncoder first
 * or any umlaut in a name breaks it. Chunked to stay clear of the argument
 * limit on String.fromCharCode.
 */
export function icsToBase64(ics) {
  const bytes = new TextEncoder().encode(ics);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}
