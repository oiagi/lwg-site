// Run with: node --test tests/
// Handler-level tests for POST /api/book-call. Each test invokes the real
// onRequestPost with a genuine Request and a per-test fetch mock, so the
// ordering that actually matters — availability re-derived server side,
// insert before Google, calendar failure downgrading rather than rolling
// back — is exercised without a database.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost as bookCall } from '../functions/api/book-call.js';

const ORIGIN = 'https://learningwithgioia.ch';
const ENV = {
  SUPABASE_URL: 'https://supabase.test',
  SUPABASE_SERVICE_KEY: 'service-key',
  // RESEND_API_KEY deliberately unset: email sending is skipped, so a test
  // never has to mock Resend to reach the response.
};

// A Monday 09:00 Zurich slot, comfortably beyond the 12h lead time.
function futureMonday() {
  const d = new Date(Date.now() + 9 * 24 * 60 * 60 * 1000);
  d.setUTCHours(7, 0, 0, 0);
  while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1);
  return d;
}
const START = futureMonday();
const START_ISO = START.toISOString();
const WEEKDAY = 1;

function body(over = {}) {
  return {
    start: START_ISO,
    first_name: 'anna',
    last_name: 'muster',
    email: 'Anna@Example.com',
    phone: '+41 79 000 00 00',
    topic: 'Gymivorbereitung',
    language: 'en',
    consent: true,
    ...over,
  };
}

async function call(payload, { env = ENV, headers = {} } = {}) {
  const request = new Request(`${ORIGIN}/api/book-call`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN, ...headers },
    body: JSON.stringify(payload),
  });
  const res = await bookCall({ request, env });
  return { status: res.status, body: await res.json() };
}

/**
 * Route table for the happy path. Each entry is
 * [urlSubstring, method, responder] — first match wins, and an unmatched
 * fetch throws so no test can silently reach the network.
 */
function mockFetch(t, { overrides = [], calls = [] } = {}) {
  const original = globalThis.fetch;
  const json = (value, status = 200) =>
    new Response(JSON.stringify(value), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });

  const defaults = [
    // Abuse guard: no existing upcoming bookings for this address.
    ['call_bookings?select=id', () => json([])],
    // One active window covering the slot.
    [
      'call_availability?select=teacher_id',
      () =>
        json([
          {
            teacher_id: 't-1',
            weekday: WEEKDAY,
            start_time: '09:00:00',
            end_time: '10:00:00',
          },
        ]),
    ],
    [
      'teachers?id=eq.t-1',
      () =>
        json([
          {
            id: 't-1',
            name: 'Gioia',
            calendar_id: 'cal-1',
            refresh_token: 'refresh',
            access_token: 'access',
            token_expires_at: new Date(Date.now() + 3600e3).toISOString(),
          },
        ]),
    ],
    ['blocked_dates', () => json([])],
    ['call_bookings?select=starts_at', () => json([])],
    ['calendar/v3/freeBusy', () => json({ calendars: { 'cal-1': { busy: [] } } })],
    // Insert.
    ['rest/v1/call_bookings', () => json([{ id: 'b-1', starts_at: START_ISO }])],
    ['rest/v1/students', () => json([{ id: 's-1' }])],
    ['calendar/v3/calendars', () => json({ id: 'ev-1', hangoutLink: 'https://meet.test/xyz' })],
  ];

  globalThis.fetch = async (input, init = {}) => {
    const url = String(input?.url || input);
    calls.push({ url, method: init.method || 'GET', body: init.body });
    const all = [...overrides, ...defaults];
    const route = all.find(([pattern]) => url.includes(pattern));
    if (!route) throw new Error(`Unexpected fetch in test: ${url}`);
    return route[1](url, init);
  };
  t.after(() => {
    globalThis.fetch = original;
  });
  return calls;
}

// ── CSRF and validation ──────────────────────────────────────────────────

test('rejects a request with no Origin', async () => {
  const request = new Request(`${ORIGIN}/api/book-call`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body()),
  });
  const res = await bookCall({ request, env: ENV });
  assert.equal(res.status, 403);
});

test('honeypot returns a fake success and writes nothing', async (t) => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error('honeypot must not reach the network');
  };
  t.after(() => {
    globalThis.fetch = original;
  });
  const { status, body: out } = await call(body({ website: 'spam' }));
  assert.equal(status, 200);
  assert.deepEqual(out, { success: true });
});

test('missing consent is rejected', async () => {
  const { status, body: out } = await call(body({ consent: false }));
  assert.equal(status, 400);
  assert.match(out.error, /terms and conditions/);
});

test('invalid email is rejected before any lookup', async () => {
  const { status, body: out } = await call(body({ email: 'not-an-email' }));
  assert.equal(status, 400);
  assert.match(out.error, /email/);
});

test('missing required names are rejected', async () => {
  assert.equal((await call(body({ first_name: '' }))).status, 400);
  assert.equal((await call(body({ last_name: undefined }))).status, 400);
});

test('a start that is not on a 15-minute boundary is rejected', async () => {
  const off = new Date(START.getTime() + 5 * 60000).toISOString();
  const { status, body: out } = await call(body({ start: off }));
  assert.equal(status, 400);
  assert.match(out.error, /Invalid time slot/);
});

test('an unparseable start is rejected', async () => {
  assert.equal((await call(body({ start: 'tomorrow' }))).status, 400);
});

// ── Availability is re-derived server side ───────────────────────────────

test('a slot the server does not offer is refused even if well formed', async (t) => {
  // Window moved to a different weekday, so the submitted slot is not real.
  mockFetch(t, {
    overrides: [
      [
        'call_availability?select=teacher_id',
        () =>
          new Response(
            JSON.stringify([
              {
                teacher_id: 't-1',
                weekday: WEEKDAY === 1 ? 3 : 1,
                start_time: '09:00:00',
                end_time: '10:00:00',
              },
            ]),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          ),
      ],
    ],
  });
  const { status, body: out } = await call(body());
  assert.equal(status, 409);
  assert.match(out.error, /no longer available/);
});

test('a slot blocked by a busy calendar interval is refused', async (t) => {
  mockFetch(t, {
    overrides: [
      [
        'calendar/v3/freeBusy',
        () =>
          new Response(
            JSON.stringify({
              calendars: {
                'cal-1': {
                  busy: [
                    { start: START_ISO, end: new Date(START.getTime() + 900000).toISOString() },
                  ],
                },
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          ),
      ],
    ],
  });
  const { status } = await call(body());
  assert.equal(status, 409);
});

test('too many upcoming bookings for one address is refused', async (t) => {
  mockFetch(t, {
    overrides: [
      [
        'call_bookings?select=id',
        () =>
          new Response(JSON.stringify([{ id: 'a' }, { id: 'b' }]), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
      ],
    ],
  });
  const { status, body: out } = await call(body());
  assert.equal(status, 409);
  assert.match(out.error, /already have a call booked/);
});

// ── The race guard ───────────────────────────────────────────────────────

test('a 409 from the unique index becomes a "just taken" message', async (t) => {
  mockFetch(t, {
    overrides: [
      [
        'rest/v1/call_bookings',
        (url, init) =>
          init.method === 'POST'
            ? new Response(JSON.stringify({ code: '23505' }), {
                status: 409,
                headers: { 'Content-Type': 'application/json' },
              })
            : new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } }),
      ],
    ],
  });
  const { status, body: out } = await call(body());
  assert.equal(status, 409);
  assert.match(out.error, /just taken/);
});

// ── Happy path and calendar fallback ─────────────────────────────────────

test('happy path books, creates the event and returns the Meet link', async (t) => {
  const calls = mockFetch(t);
  const { status, body: out } = await call(body());

  assert.equal(status, 200);
  assert.equal(out.success, true);
  assert.equal(out.delivery, 'calendar');
  assert.equal(out.meet_link, 'https://meet.test/xyz');
  assert.equal(out.start, START_ISO);

  // The insert must happen before Google is contacted.
  const insertAt = calls.findIndex(
    (c) => c.method === 'POST' && c.url.includes('rest/v1/call_bookings')
  );
  const calendarAt = calls.findIndex((c) => c.url.includes('calendar/v3/calendars'));
  assert.ok(insertAt > -1 && calendarAt > insertAt, 'insert must precede the calendar call');

  // Names are stored capitalised and the email lower-cased.
  const inserted = JSON.parse(calls[insertAt].body);
  assert.equal(inserted.first_name, 'Anna');
  assert.equal(inserted.last_name, 'Muster');
  assert.equal(inserted.email, 'anna@example.com');
  assert.equal(inserted.duration_minutes, 15);
  assert.equal(inserted.status, 'booked');

  // The event must invite the visitor and request a Meet room.
  const event = calls.find((c) => c.url.includes('calendar/v3/calendars'));
  assert.match(event.url, /conferenceDataVersion=1/);
  assert.match(event.url, /sendUpdates=all/);
  const payload = JSON.parse(event.body);
  assert.equal(payload.attendees[0].email, 'anna@example.com');
  assert.equal(payload.conferenceData.createRequest.requestId, 'b-1');
});

test('a calendar failure keeps the booking and downgrades to email', async (t) => {
  const calls = mockFetch(t, {
    overrides: [['calendar/v3/calendars', () => new Response('boom', { status: 500 })]],
  });
  const { status, body: out } = await call(body());

  assert.equal(status, 200, 'the visitor must still be booked');
  assert.equal(out.delivery, 'email');
  assert.equal(out.meet_link, null);

  // The row is patched to delivery:'email', never deleted.
  const patches = calls.filter((c) => c.method === 'PATCH' && c.url.includes('call_bookings'));
  assert.ok(patches.some((p) => JSON.parse(p.body).delivery === 'email'));
  assert.equal(
    calls.filter((c) => c.method === 'DELETE').length,
    0,
    'a failed calendar must never roll back the booking'
  );
});

test('an unauthorised teacher skips Google entirely and still books', async (t) => {
  const calls = mockFetch(t, {
    overrides: [
      [
        'teachers?id=eq.t-1',
        () =>
          new Response(
            JSON.stringify([{ id: 't-1', name: 'Gioia', calendar_id: null, refresh_token: null }]),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          ),
      ],
    ],
  });
  const { status, body: out } = await call(body());
  assert.equal(status, 200);
  assert.equal(out.delivery, 'email');
  assert.equal(
    calls.filter((c) => c.url.includes('googleapis.com')).length,
    0,
    'no Google call without authorisation'
  );
});
