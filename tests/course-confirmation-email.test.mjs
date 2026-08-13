// Run with: node --test tests/
// Covers the two variants of the consolidated course-info email in
// functions/api/_course-confirmation-email.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildConfirmationEmail,
  firstLessonLabel,
  formatLocation,
  studentBookingTotal,
  COURSE_EMAIL_VARIANTS,
} from '../functions/api/_course-confirmation-email.js';

const AGB_MARKER_DE = 'Allgemeine Geschäftsbedingungen';
const AGB_MARKER_EN = 'Terms & Conditions';

const course = {
  course_code: 'LWG-2026-14',
  subject: 'Deutsch',
  level: 'B1',
  group_type: 'einzel',
  sessions_total: 3,
  session_length_minutes: 90,
  price_per_person_per_60min: 100,
  currency: 'CHF',
  location_street: 'Bahnhofstrasse',
  location_street_number: '4',
  location_postal_code: '8001',
  location_city: 'Zürich',
};

const sessions = [
  { scheduled_at: '2026-08-03T16:00:00Z', duration_minutes: 90, status: 'scheduled' },
  { scheduled_at: '2026-08-10T16:00:00Z', duration_minutes: 90, status: 'scheduled' },
  { scheduled_at: '2026-08-17T16:00:00Z', duration_minutes: 90, status: 'scheduled' },
];

// Pinned so "the next lesson still ahead of us" stays the 3rd of August.
const BEFORE_COURSE = new Date('2026-07-01T00:00:00Z');

function build(overrides = {}) {
  return buildConfirmationEmail({
    course,
    sessions,
    studentFirstName: 'Anna',
    language: 'de',
    now: BEFORE_COURSE,
    ...overrides,
  });
}

test('both variants are advertised to the endpoint', () => {
  assert.deepEqual(COURSE_EMAIL_VARIANTS, ['confirmation', 'starting_soon']);
});

test('confirmation keeps its subject, title and AGB block', () => {
  const de = build();
  assert.equal(de.subject, 'Kursbestätigung - LWG-2026-14 · learning with gioia');
  assert.match(de.html, /Kursbestätigung/);
  assert.match(de.html, /Vielen Dank für deine Anmeldung, Anna/);
  assert.ok(de.html.includes(AGB_MARKER_DE));

  const en = build({ language: 'en' });
  assert.equal(en.subject, 'Course confirmation - LWG-2026-14 · learning with gioia');
  assert.match(en.html, /Thank you for your registration, Anna/);
  // English confirmations carry both the English and the German terms.
  assert.ok(en.html.includes(AGB_MARKER_EN));
  assert.ok(en.html.includes(AGB_MARKER_DE));
});

test('starting_soon uses its own subject and names the first lesson', () => {
  const de = build({ variant: 'starting_soon' });
  assert.equal(de.subject, 'Dein Kurs startet bald - LWG-2026-14 · learning with gioia');
  assert.match(de.html, /Es ist bald so weit, Anna/);
  assert.match(de.html, /Dein Kurs startet am Montag, 03.08.2026, 18:00/);

  const en = build({ variant: 'starting_soon', language: 'en' });
  assert.equal(en.subject, 'Your course starts soon - LWG-2026-14 · learning with gioia');
  assert.match(en.html, /It&#39;s almost time, Anna/);
  assert.match(en.html, /Your course starts on Monday, 03\/08\/2026, 18:00/);
});

test('starting_soon drops the AGB but keeps details, lessons and cancellation', () => {
  const de = build({ variant: 'starting_soon' });
  assert.ok(!de.html.includes(AGB_MARKER_DE));
  assert.ok(!de.html.includes(AGB_MARKER_EN));
  assert.match(de.html, /Absage und Verschiebung/);
  assert.match(de.html, /Kurscode/);
  assert.match(de.html, /LWG-2026-14/);
  assert.match(de.html, /Geplante Lektionen/);
  assert.match(de.html, /Montag, 03.08.2026, 18:00 - 19:30 \(90 min\)/);
  assert.match(de.html, /Bahnhofstrasse 4, 8001 Zürich/);

  const en = build({ variant: 'starting_soon', language: 'en' });
  assert.ok(!en.html.includes(AGB_MARKER_EN));
  assert.ok(!en.html.includes(AGB_MARKER_DE));
  assert.match(en.html, /Cancellation and postponement/);
});

test('starting_soon falls back to a generic opener without sessions', () => {
  const de = build({ variant: 'starting_soon', sessions: [] });
  assert.match(de.html, /Dein Kurs startet demnächst\./);
  assert.match(de.html, /Noch keine Lektionen geplant\./);

  const en = build({ variant: 'starting_soon', sessions: [], language: 'en' });
  assert.match(en.html, /Your course starts soon\./);
});

test('missing first name falls back to the neutral greeting', () => {
  assert.match(
    build({ variant: 'starting_soon', studentFirstName: '' }).html,
    /Es ist bald so weit, Kursteilnehmer:in/
  );
  assert.match(
    build({ studentFirstName: '', language: 'en' }).html,
    /Thank you for your registration, course participant/
  );
});

test('group courses get the group cancellation policy in both variants', () => {
  const groupCourse = { ...course, group_type: 'duo' };
  for (const variant of COURSE_EMAIL_VARIANTS) {
    const html = build({ course: groupCourse, variant }).html;
    const solo = build({ variant }).html;
    assert.notEqual(
      html.slice(html.indexOf('Absage und Verschiebung')),
      solo.slice(solo.indexOf('Absage und Verschiebung')),
      `${variant} should use a different policy for duo courses`
    );
  }
});

test('firstLessonLabel prefers the next upcoming lesson', () => {
  const now = new Date('2026-08-05T00:00:00Z');
  assert.equal(firstLessonLabel(sessions, 'de', now), 'Montag, 10.08.2026, 18:00');
  // Once the whole course is behind us, the earliest lesson is still named.
  const past = new Date('2027-01-01T00:00:00Z');
  assert.equal(firstLessonLabel(sessions, 'de', past), 'Montag, 03.08.2026, 18:00');
  assert.equal(firstLessonLabel([], 'de', now), null);
  assert.equal(firstLessonLabel([{ scheduled_at: null }], 'de', now), null);
});

test('unsorted sessions still resolve the earliest lesson', () => {
  const now = new Date('2026-07-01T00:00:00Z');
  const shuffled = [sessions[2], sessions[0], sessions[1]];
  assert.equal(firstLessonLabel(shuffled, 'de', now), 'Montag, 03.08.2026, 18:00');
});

test('booking total and location helpers', () => {
  // 100 CHF/60min × 3 lessons × 90 min
  assert.equal(studentBookingTotal(course, sessions), 450);
  assert.equal(
    studentBookingTotal({ ...course, price_per_person_per_60min: null }, sessions),
    null
  );
  assert.equal(formatLocation({ location: 'Online' }), 'Online');
  assert.equal(formatLocation({}), '—');
});
