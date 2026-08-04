// Run with: node --test tests/
// Validation-boundary tests for the two booking endpoints. Each test invokes
// the real onRequestPost handler with a genuine Request object and asserts
// the response produced before any write reaches Supabase. Reads that the
// handlers perform on the way to a validation verdict (auth check, course/
// slot/teacher lookups) are served by a per-test fetch mock; any fetch a
// test does not explicitly allow fails the test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost as bookCourse } from '../functions/api/book-course.js';
import { onRequestPost as confirmBooking } from '../functions/api/confirm-booking.js';
import {
  PUBLIC_BOOKING_LEVELS,
  PUBLIC_SLOT_PREFERRED_LOCATIONS,
} from '../functions/api/_public-course-booking.js';

const ORIGIN = 'https://learningwithgioia.ch';
const SB_ENV = { SUPABASE_URL: 'https://supabase.test', SUPABASE_SERVICE_KEY: 'service-key' };

function jsonRequest(path, body, headers = {}) {
  return new Request(`${ORIGIN}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN, ...headers },
    body: JSON.stringify(body),
  });
}

async function call(handler, path, body, { headers = {}, env = {} } = {}) {
  const res = await handler({ request: jsonRequest(path, body, headers), env });
  return { status: res.status, body: await res.json() };
}

// Replaces global fetch for one test. routes is an ordered list of
// [urlSubstring, jsonValue] pairs; first match wins, no match throws so a
// test can never silently reach a real network or an unmocked write.
function withMockFetch(t, routes) {
  const original = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    const route = routes.find(([pattern]) => url.includes(pattern));
    if (!route) throw new Error(`Unexpected fetch in test: ${url}`);
    return new Response(JSON.stringify(route[1]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  t.after(() => {
    globalThis.fetch = original;
  });
}

function validStudent(overrides = {}) {
  return {
    first_name: 'Anna',
    last_name: 'Muster',
    gender: 'female',
    email: 'anna@example.com',
    phone: '+41 79 000 00 00',
    street: 'Bahnhofstrasse',
    street_number: '1',
    postcode: '8001',
    city: 'Zürich',
    consent_given: true,
    ...overrides,
  };
}

function eligibleSlotRow(overrides = {}) {
  return {
    id: 'slot-1',
    public_booking_enabled: true,
    status: 'active',
    weekday: 3,
    start_time: '12:15:00',
    end_time: '13:05:00',
    sessions_total: 9,
    minimum_students: 3,
    capacity: 5,
    allow_reduced_lessons: true,
    course_type: 'German course',
    location: 'online',
    access_code: null,
    ...overrides,
  };
}

const bookBody = (extra) => ({ course_id: 'c1', student: validStudent(), ...extra });

async function bookWithStudent(studentOverrides) {
  return call(
    bookCourse,
    '/api/book-course',
    bookBody({ student: validStudent(studentOverrides) })
  );
}

// ── book-course: origin & body shape ─────────────────────────────────

test('book-course rejects missing or disallowed Origin', async () => {
  const noOrigin = await bookCourse({
    request: new Request(`${ORIGIN}/api/book-course`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bookBody()),
    }),
    env: {},
  });
  assert.equal(noOrigin.status, 403);

  const evil = await call(bookCourse, '/api/book-course', bookBody(), {
    headers: { Origin: 'https://evil.example' },
  });
  assert.equal(evil.status, 403);
});

test('book-course rejects non-object JSON bodies', async () => {
  const res = await bookCourse({
    request: new Request(`${ORIGIN}/api/book-course`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
      body: JSON.stringify([1, 2]),
    }),
    env: {},
  });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, 'Invalid JSON');
});

test('book-course requires exactly one of course_id / slot_id', async () => {
  const neither = await call(bookCourse, '/api/book-course', { student: validStudent() });
  assert.equal(neither.status, 400);
  assert.equal(neither.body.error, 'course_id or slot_id is required');

  const both = await call(bookCourse, '/api/book-course', bookBody({ slot_id: 's1' }));
  assert.equal(both.status, 400);
  assert.equal(both.body.error, 'Choose either course_id or slot_id');
});

// ── book-course: student validation ──────────────────────────────────

test('book-course requires core student fields', async () => {
  const noFirst = await bookWithStudent({ first_name: undefined });
  assert.equal(noFirst.status, 400);
  assert.equal(noFirst.body.error, 'first_name is required');

  // Whitespace-only values are cleaned to null before validation.
  const blankFirst = await bookWithStudent({ first_name: '   ' });
  assert.equal(blankFirst.status, 400);
  assert.equal(blankFirst.body.error, 'first_name is required');

  const badEmail = await bookWithStudent({ email: 'not-an-email' });
  assert.equal(badEmail.status, 400);
  assert.equal(badEmail.body.error, 'email must be a valid email address');

  const noPhone = await bookWithStudent({ phone: undefined });
  assert.equal(noPhone.status, 400);
  assert.equal(noPhone.body.error, 'phone is required');
});

test('book-course gender handling', async () => {
  // normalizeStudent nulls anything outside female/male/other before the
  // schema runs, so unknown values surface as "gender is required".
  const unknown = await bookWithStudent({ gender: 'she/her' });
  assert.equal(unknown.status, 400);
  assert.equal(unknown.body.error, 'gender is required');

  const otherNoNote = await bookWithStudent({ gender: 'other' });
  assert.equal(otherNoNote.status, 400);
  assert.equal(otherNoNote.body.error, 'gender_note is required when gender is other');
});

test('book-course requires consent_given === true', async () => {
  const declined = await bookWithStudent({ consent_given: false });
  assert.equal(declined.status, 400);
  assert.equal(declined.body.error, 'consent_given must be one of: true');

  // Truthy non-boolean values are normalized to false, not accepted.
  const stringConsent = await bookWithStudent({ consent_given: 'yes' });
  assert.equal(stringConsent.status, 400);
  assert.equal(stringConsent.body.error, 'consent_given must be one of: true');
});

test('book-course validates optional emergency-contact email', async () => {
  const res = await bookWithStudent({ ec_email: 'nope' });
  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'ec_email must be valid');
});

test('book-course billing block is all-or-nothing', async () => {
  // billing_separate flag alone triggers the full billing requirement…
  const flagged = await bookWithStudent({ billing_separate: true });
  assert.equal(flagged.status, 400);
  assert.equal(flagged.body.error, 'billing_name is required');

  // …and so does any single billing field slipping in.
  const partial = await bookWithStudent({ billing_city: 'Bern' });
  assert.equal(partial.status, 400);
  assert.equal(partial.body.error, 'billing_name is required');
});

test('book-course billing gender and email rules', async () => {
  const billing = {
    billing_name: 'Firma AG',
    billing_gender: 'female',
    billing_email: 'billing@example.com',
    billing_phone: '+41 44 000 00 00',
    billing_street: 'Seestrasse',
    billing_street_number: '2',
    billing_postcode: '8002',
    billing_city: 'Zürich',
  };

  const badGender = await bookWithStudent({ ...billing, billing_gender: 'unknown' });
  assert.equal(badGender.status, 400);
  assert.equal(badGender.body.error, 'billing_gender is required');

  const otherNoNote = await bookWithStudent({ ...billing, billing_gender: 'other' });
  assert.equal(otherNoNote.status, 400);
  assert.equal(
    otherNoNote.body.error,
    'billing_gender_note is required when billing_gender is other'
  );

  const badEmail = await bookWithStudent({ ...billing, billing_email: 'nope' });
  assert.equal(badEmail.status, 400);
  assert.equal(badEmail.body.error, 'billing_email must be valid');
});

// ── book-course: course / slot availability gates ────────────────────

test('book-course returns 409 for an unavailable course', async (t) => {
  withMockFetch(t, [['/rest/v1/courses?public_booking_enabled', []]]);
  const res = await call(bookCourse, '/api/book-course', bookBody(), { env: SB_ENV });
  assert.equal(res.status, 409);
  assert.equal(res.body.error, 'This course is no longer available for direct booking.');
});

test('book-course slot bookings require slot-specific fields', async (t) => {
  withMockFetch(t, [
    ['/rest/v1/public_group_course_slots', [eligibleSlotRow()]],
    ['/rest/v1/enquiries?or=', []],
  ]);
  const slotBody = (extra) => ({ slot_id: 'slot-1', student: validStudent(), ...extra });
  const opts = { env: SB_ENV };
  const level = PUBLIC_BOOKING_LEVELS[0];
  const location = PUBLIC_SLOT_PREFERRED_LOCATIONS[0];

  const noLevel = await call(bookCourse, '/api/book-course', slotBody(), opts);
  assert.equal(noLevel.status, 400);
  assert.equal(noLevel.body.error, 'preferred_level is required for this course slot');

  const badLocation = await call(
    bookCourse,
    '/api/book-course',
    slotBody({ preferred_level: level, preferred_location: 'moon' }),
    opts
  );
  assert.equal(badLocation.status, 400);
  assert.equal(badLocation.body.error, 'preferred_location is required for this course slot');

  const noReducedAnswer = await call(
    bookCourse,
    '/api/book-course',
    slotBody({ preferred_level: level, preferred_location: location }),
    opts
  );
  assert.equal(noReducedAnswer.status, 400);
  assert.equal(noReducedAnswer.body.error, 'reduced_lessons_ok is required for this course slot');
});

test('book-course rejects a wrong slot access code with 409', async (t) => {
  withMockFetch(t, [
    ['/rest/v1/public_group_course_slots', [eligibleSlotRow({ access_code: 'ZH-26' })]],
    ['/rest/v1/enquiries?or=', []],
  ]);
  const res = await call(
    bookCourse,
    '/api/book-course',
    { slot_id: 'slot-1', access_code: 'wrong', student: validStudent() },
    { env: SB_ENV }
  );
  assert.equal(res.status, 409);
  assert.equal(res.body.error, 'This course slot is no longer available for direct booking.');
});

// ── confirm-booking ──────────────────────────────────────────────────

const ADMIN_AUTH = { Authorization: 'Bearer admin-token' };
const AUTH_OK = ['/auth/v1/user', { id: 'admin-user' }];

test('confirm-booking rejects requests without a bearer token', async () => {
  const res = await call(
    confirmBooking,
    '/api/confirm-booking',
    { teacher_id: 't1' },
    { env: SB_ENV }
  );
  assert.equal(res.status, 401);
  assert.equal(res.body.error, 'Unauthorised');
});

test('confirm-booking requires teacher_id and first_session_at', async (t) => {
  withMockFetch(t, [AUTH_OK]);
  const res = await call(
    confirmBooking,
    '/api/confirm-booking',
    { teacher_id: 't1' },
    { headers: ADMIN_AUTH, env: SB_ENV }
  );
  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'Missing teacher_id or first_session_at');
});

test('confirm-booking requires an access code for company-code booking', async (t) => {
  withMockFetch(t, [AUTH_OK]);
  const res = await call(
    confirmBooking,
    '/api/confirm-booking',
    {
      teacher_id: 't1',
      first_session_at: '2026-09-01T10:00:00Z',
      company_code_booking_enabled: true,
      access_code: '   ',
    },
    { headers: ADMIN_AUTH, env: SB_ENV }
  );
  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'access_code is required for company code booking');
});

test('confirm-booking returns 404 for an unknown enquiry', async (t) => {
  withMockFetch(t, [AUTH_OK, ['/rest/v1/enquiries?id=eq.', []]]);
  const res = await call(
    confirmBooking,
    '/api/confirm-booking',
    { enquiry_id: 'missing', teacher_id: 't1', first_session_at: '2026-09-01T10:00:00Z' },
    { headers: ADMIN_AUTH, env: SB_ENV }
  );
  assert.equal(res.status, 404);
  assert.equal(res.body.error, 'Enquiry not found');
});

test('confirm-booking returns 404 for an unknown teacher', async (t) => {
  withMockFetch(t, [AUTH_OK, ['/rest/v1/teachers?id=eq.', []]]);
  const res = await call(
    confirmBooking,
    '/api/confirm-booking',
    { teacher_id: 'missing', first_session_at: '2026-09-01T10:00:00Z', booking_data: {} },
    { headers: ADMIN_AUTH, env: SB_ENV }
  );
  assert.equal(res.status, 404);
  assert.equal(res.body.error, 'Teacher not found');
});

test('confirm-booking blocks unauthorised-calendar teachers unless single_session', async (t) => {
  withMockFetch(t, [
    AUTH_OK,
    ['/rest/v1/teachers?id=eq.', [{ id: 't1', name: 'T', refresh_token: null, calendar_id: null }]],
  ]);
  const res = await call(
    confirmBooking,
    '/api/confirm-booking',
    { teacher_id: 't1', first_session_at: '2026-09-01T10:00:00Z', booking_data: {} },
    { headers: ADMIN_AUTH, env: SB_ENV }
  );
  assert.equal(res.status, 400);
  assert.match(res.body.error, /has not authorised Google Calendar/);
});
