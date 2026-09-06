// Run with: node --test tests/
// Regression tests for the on-demand calendar sync.
//
// These drive the real POST /api/sync-calendar handler against a mock Google
// Calendar that expands RRULE/EXDATE the way Google does, plus an in-memory
// stand-in for PostgREST. Syncing is idempotent by contract — the admin hits
// the button repeatedly — so most tests here run it several times and assert
// the state stops moving.
//
// Every fixture date is relative to today: blocked dates only apply to
// strictly-future occurrences, and the fetch window only reaches back 90
// days, so hard-coded dates would quietly stop testing anything.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost as syncCalendar } from '../functions/api/sync-calendar.js';
import { applyBlockedDatesToSeries } from '../functions/api/_calendar.js';
import { zurichParts, addDays, excludedSlotKeys } from '../functions/api/_blocked-dates.js';

const MASTER_ID = 'master123';
const COURSE_ID = 'course-1';
const COURSE_CODE = 'P-A1-001';
const LESSON_TIME = '18:30:00';

const today = () => new Date().toISOString().slice(0, 10);

/** A Monday `weeksAhead` weeks out, so a fixture series starts in the future. */
function upcomingMonday(weeksAhead = 1) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 7 * weeksAhead);
  while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Zurich wall clock → the UTC instant Google would report. */
function zurichToUtc(date, time) {
  for (const offset of [1, 2]) {
    const guess = new Date(`${date}T${time}Z`);
    guess.setUTCHours(guess.getUTCHours() - offset);
    const parts = zurichParts(guess);
    if (parts.date === date && parts.time === time) return guess;
  }
  const fallback = new Date(`${date}T${time}Z`);
  fallback.setUTCHours(fallback.getUTCHours() - 2);
  return fallback;
}

const basicUtc = (d) =>
  d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
const instanceId = (date, time = LESSON_TIME) =>
  `${MASTER_ID}_${basicUtc(zurichToUtc(date, time))}`;

/**
 * A calendar holding one weekly series.
 *
 * `overrides` maps an original slot key to [date, time] — how Google
 * represents an instance the teacher moved: its own resource, carrying
 * originalStartTime, keyed to the slot it came from.
 *
 * `overrideSurvivesExdate` picks which way an EXDATE naming an overridden
 * slot resolves. Google does not specify this, so the sync has to be correct
 * either way and both settings are exercised below.
 *
 * `lagSlots` names slots that keep the old summary after a master rename while
 * still reporting the master's `updated` stamp — Google having not finished
 * propagating. They must be left alone, not patched into overrides.
 *
 * `standalone` holds events that belong to no series: the sessions a teacher
 * adds by hand to a course created with singleSession.
 */
function makeCalendar({
  startDate = upcomingMonday(),
  startTime = LESSON_TIME,
  count = 10,
  overrides = {},
  overrideSurvivesExdate = false,
  summary = `${COURSE_CODE} — Anna <> Gioia`,
  lagSlots = [],
  standalone = [],
} = {}) {
  return {
    master: {
      id: MASTER_ID,
      summary,
      updated: 'master-v0',
      start: {
        dateTime: zurichToUtc(startDate, startTime).toISOString(),
        timeZone: 'Europe/Zurich',
      },
      recurrence: [`RRULE:FREQ=WEEKLY;BYDAY=MO;COUNT=${count}`],
    },
    startDate,
    startTime,
    overrides: new Map(Object.entries(overrides)),
    overrideSurvivesExdate,
    // The summary an override froze at the moment it was created — a real
    // override carries its own copy, so a later master rename never reaches it.
    originalSummary: summary,
    lagSlots: new Set(lagSlots),
    standalone,
    // Titles written directly onto an instance or a standalone event.
    instancePatches: new Map(),
    // Event ids whose PATCH Google refuses, for the non-fatal-failure test.
    failPatch: new Set(),
    patches: 0,
    titlePatches: 0,
    updateSeq: 0,
  };
}

/** Expand the series into single events, honouring COUNT and every EXDATE. */
function expand(cal, timeMin) {
  const start = zurichParts(cal.master.start.dateTime);
  const rrule = cal.master.recurrence.find((l) => l.startsWith('RRULE:')) || '';
  const countMatch = rrule.match(/COUNT=(\d+)/);
  const slots = countMatch ? Number(countMatch[1]) : 40;
  const excluded = excludedSlotKeys(cal.master.recurrence);

  const out = [];
  for (let i = 0; i < slots; i++) {
    const date = addDays(start.date, 7 * i);
    const override = cal.overrides.get(`${date}T${start.time}`);
    const isExcluded = excluded.has(`${date}T${start.time}`) || excluded.has(date);
    if (isExcluded && !(override && cal.overrideSurvivesExdate)) continue;

    const originalUtc = zurichToUtc(date, start.time);
    const [actualDate, actualTime] = override || [date, start.time];
    const actualUtc = zurichToUtc(actualDate, actualTime);
    // Google stamps originalStartTime on *every* instance of a recurring
    // event, not only on ones that were dragged — verified against the live
    // API, where an untouched series reports it equal to `start` throughout.
    // Emitting it only for overrides is what let a sync that read its mere
    // presence as "hand-moved" pass these tests while enforcing nothing.
    //
    // Titles work the other way round: an override is its own resource with its
    // own frozen summary and its own `updated`, while an ordinary instance is
    // re-rendered from the parent on every read and so reports the parent's.
    // `lagSlots` is the awkward middle case Google occasionally serves —
    // parent stamp, stale title.
    const key = `${date}T${start.time}`;
    const id = `${MASTER_ID}_${basicUtc(originalUtc)}`;
    const inherited = override || cal.lagSlots.has(key) ? cal.originalSummary : cal.master.summary;

    out.push({
      id,
      recurringEventId: MASTER_ID,
      status: 'confirmed',
      summary: cal.instancePatches.get(id) ?? inherited,
      updated: override ? `override-${key}` : cal.master.updated,
      start: { dateTime: actualUtc.toISOString(), timeZone: 'Europe/Zurich' },
      end: { dateTime: new Date(actualUtc.getTime() + 50 * 60000).toISOString() },
      originalStartTime: { dateTime: originalUtc.toISOString() },
    });
  }
  for (const event of cal.standalone) {
    out.push({
      status: 'confirmed',
      ...event,
      summary: cal.instancePatches.get(event.id) ?? event.summary,
    });
  }
  return out
    .filter((e) => !timeMin || e.start.dateTime >= timeMin)
    .sort((a, b) => a.start.dateTime.localeCompare(b.start.dateTime));
}

const ENV = {
  SUPABASE_URL: 'https://supabase.test',
  SUPABASE_SERVICE_KEY: 'service-key',
  SUPABASE_ANON_KEY: 'anon-key',
  GOOGLE_CLIENT_ID: 'client-id',
  GOOGLE_CLIENT_SECRET: 'client-secret',
};

/**
 * Wire up a world: mock Google + mock PostgREST over an in-memory db.
 * Returns { db, cal, run } where run() performs one full sync.
 */
function makeWorld(
  t,
  {
    cal = makeCalendar(),
    sessions = [],
    blocked = [],
    course = {},
    attendance = [],
    companies = [],
    enrolments = [],
    students = [],
  } = {}
) {
  const db = {
    courses: [
      {
        id: COURSE_ID,
        course_code: COURSE_CODE,
        teacher_id: 't1',
        calendar_event_id: MASTER_ID,
        sessions_total: 10,
        sessions_completed: 0,
        recurrence_rule: 'FREQ=WEEKLY;BYDAY=MO;COUNT=10',
        ...course,
      },
    ],
    teachers: [
      {
        id: 't1',
        name: 'Gioia',
        refresh_token: 'refresh',
        access_token: 'access',
        token_expires_at: '2099-01-01T00:00:00Z',
        calendar_id: 'cal@example.com',
      },
    ],
    blocked_dates: blocked,
    sessions,
    attendance,
    companies,
    enrolments,
    students,
  };

  let nextId = 1;
  const json = (value, status = 200) =>
    new Response(JSON.stringify(value), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });

  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });

  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    const method = opts.method || 'GET';

    if (u.includes('/auth/v1/user')) return json({ id: 'admin' });
    if (u.includes('oauth2.googleapis.com')) return json({ access_token: 'a', expires_in: 3600 });

    if (u.includes('googleapis.com/calendar')) {
      if (u.includes('/events?')) {
        const timeMin = new URL(u).searchParams.get('timeMin');
        return json({ items: expand(cal, timeMin) });
      }
      // Must be an exact match on the id: an instance id starts with the
      // master's, so `includes` would route every instance patch to the parent
      // and hide the very mistake these tests exist to catch.
      const eventMatch = u.match(/\/events\/([^?]+)/);
      if (eventMatch) {
        const eventId = decodeURIComponent(eventMatch[1]);
        if (method === 'PATCH' && cal.failPatch.has(eventId)) return json({ error: 'boom' }, 500);
        if (eventId === MASTER_ID) {
          if (method === 'PATCH') {
            const patch = JSON.parse(opts.body);
            if (patch.recurrence) {
              cal.master.recurrence = patch.recurrence;
              cal.patches++;
            }
            if (patch.summary !== undefined) {
              cal.master.summary = patch.summary;
              cal.master.updated = `master-v${++cal.updateSeq}`;
              cal.titlePatches++;
            }
          }
          return json(structuredClone(cal.master));
        }
        if (method === 'PATCH') cal.instancePatches.set(eventId, JSON.parse(opts.body).summary);
        return json({ id: eventId });
      }
    }

    const rest = u.match(/\/rest\/v1\/(\w+)(?:\?(.*))?$/);
    if (rest) {
      const [, table, query = ''] = rest;
      if (method === 'POST') {
        const row = { id: `s${nextId++}`, ...JSON.parse(opts.body) };
        db[table].push(row);
        return json([row]);
      }
      // Anchored so course_id=eq.… is not mistaken for a primary-key filter.
      const idMatch = query.match(/(?:^|&)id=eq\.([^&]+)/);
      const id = idMatch ? decodeURIComponent(idMatch[1]) : null;
      const courseMatch = query.match(/(?:^|&)course_id=eq\.([^&]+)/);
      const courseId = courseMatch ? decodeURIComponent(courseMatch[1]) : null;

      if (method === 'GET') {
        let rows = db[table] || [];
        if (id) rows = rows.filter((r) => r.id === id);
        if (courseId) rows = rows.filter((r) => r.course_id === courseId);
        // or=(session_id.eq.a,session_id.eq.b) — the only or-filter the sync sends.
        const or = query.match(/(?:^|&)or=\(([^)]*)\)/);
        if (or) {
          const wanted = new Set(
            or[1].split(',').map((term) => decodeURIComponent(term.split('.eq.')[1] || ''))
          );
          rows = rows.filter((r) => wanted.has(r.session_id));
        }
        return json(rows);
      }
      if (method === 'PATCH') {
        const row = (db[table] || []).find((r) => r.id === id);
        if (row) Object.assign(row, JSON.parse(opts.body));
        return json([row]);
      }
      if (method === 'DELETE') {
        db[table] = db[table].filter((r) => r.id !== id);
        return json([]);
      }
    }
    throw new Error(`unexpected fetch: ${method} ${u}`);
  };

  const run = async () => {
    const request = new Request('https://learningwithgioia.ch/api/sync-calendar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
      body: JSON.stringify({ course_id: COURSE_ID }),
    });
    const res = await syncCalendar({ request, env: ENV });
    return { status: res.status, body: await res.json() };
  };

  return { db, cal, run };
}

const sessionDates = (db) => db.sessions.map((s) => zurichParts(s.scheduled_at).date).sort();

// ── Blocked dates on a clean series ─────────────────────────────────────

test('blocked occurrences are excluded and re-appended after the series', async (t) => {
  // Ten weekly Mondays; the break covers occurrences 4 and 5 (indices 3, 4).
  const startDate = upcomingMonday();
  const { db, cal, run } = makeWorld(t, {
    cal: makeCalendar({ startDate }),
    blocked: [{ start_date: addDays(startDate, 21), end_date: addDays(startDate, 28) }],
  });

  const res = await run();
  assert.equal(res.status, 200);
  assert.equal(res.body.blocked_sessions_moved, 2);
  assert.match(cal.master.recurrence[0], /COUNT=12$/);

  // Still ten lessons: the two blocked Mondays reappear after the last one.
  const expected = [0, 1, 2, 5, 6, 7, 8, 9, 10, 11].map((i) => addDays(startDate, 7 * i));
  assert.equal(db.sessions.length, 10);
  assert.deepEqual(sessionDates(db), expected.slice().sort());
});

test('repeated syncs neither re-exclude nor grow the series', async (t) => {
  const startDate = upcomingMonday();
  const { db, cal, run } = makeWorld(t, {
    cal: makeCalendar({ startDate }),
    blocked: [{ start_date: addDays(startDate, 21), end_date: addDays(startDate, 28) }],
  });

  await run();
  const settled = { recurrence: [...cal.master.recurrence], dates: sessionDates(db) };

  for (let i = 0; i < 3; i++) {
    const res = await run();
    assert.equal(res.body.blocked_sessions_moved, 0, 'nothing new to exclude');
  }

  assert.equal(cal.patches, 1, 'the series is patched once, not once per sync');
  assert.deepEqual(cal.master.recurrence, settled.recurrence);
  assert.equal(db.sessions.length, 10);
  assert.deepEqual(sessionDates(db), settled.dates);
});

// ── Hand-moved instances ────────────────────────────────────────────────

for (const overrideSurvives of [false, true]) {
  test(
    'a hand-moved session on a blocked date is left alone and reported ' +
      `(override survives EXDATE: ${overrideSurvives})`,
    async (t) => {
      // The teacher postponed occurrence 4 by two days, and only then was the
      // new date blocked.
      const startDate = upcomingMonday();
      const movedFrom = addDays(startDate, 21);
      const movedTo = addDays(startDate, 23);
      const cal = makeCalendar({
        startDate,
        overrides: { [`${movedFrom}T${LESSON_TIME}`]: [movedTo, LESSON_TIME] },
        overrideSurvivesExdate: overrideSurvives,
      });
      const { db, run } = makeWorld(t, {
        cal,
        blocked: [{ start_date: movedTo, end_date: movedTo }],
      });

      const res = await run();
      assert.deepEqual(res.body.moved_onto_blocked_dates, [movedTo]);
      assert.equal(res.body.blocked_sessions_moved, 0);
      assert.equal(cal.patches, 0, 'a deliberate reschedule is never rewritten');

      // The postponed lesson is still on the books, on the date it was moved to.
      assert.ok(sessionDates(db).includes(movedTo));
      assert.equal(db.sessions.length, 10);

      // The trigger persists, so this is exactly where the series used to gain
      // a session — and the session list a duplicate — on every sync.
      for (let i = 0; i < 3; i++) await run();
      assert.equal(cal.patches, 0);
      assert.equal(db.sessions.length, 10);
      assert.match(cal.master.recurrence[0], /COUNT=10$/);
      assert.equal(cal.master.recurrence.filter((l) => l.startsWith('EXDATE')).length, 0);
    }
  );
}

// ── Exclusions already on the series ────────────────────────────────────

const blockedSlotFixture = (exdateLineForSlot) => {
  const startDate = upcomingMonday();
  const blockedDate = addDays(startDate, 21);
  const cal = makeCalendar({ startDate, count: 11 });
  cal.master.recurrence.push(exdateLineForSlot(blockedDate));
  return { cal, blockedDate };
};

/** Ask the series to absorb one blocked occurrence Google is still serving. */
async function applyTo(cal, blockedDate) {
  const original = globalThis.fetch;
  globalThis.fetch = async (url, opts = {}) => {
    if ((opts.method || 'GET') === 'PATCH') {
      cal.master.recurrence = JSON.parse(opts.body).recurrence;
      cal.patches++;
    }
    return new Response(JSON.stringify(cal.master), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  try {
    return await applyBlockedDatesToSeries({
      accessToken: 'a',
      calendarId: 'cal@example.com',
      masterEventId: MASTER_ID,
      activeEvents: [
        {
          id: instanceId(blockedDate),
          recurringEventId: MASTER_ID,
          status: 'confirmed',
          start: { dateTime: zurichToUtc(blockedDate, LESSON_TIME).toISOString() },
        },
      ],
      blockedPeriods: [{ start_date: blockedDate, end_date: blockedDate }],
    });
  } finally {
    globalThis.fetch = original;
  }
}

test('an already-excluded slot is not excluded a second time', async () => {
  const { cal, blockedDate } = blockedSlotFixture(
    (date) => `EXDATE;TZID=Europe/Zurich:${date.replace(/-/g, '')}T183000`
  );

  const result = await applyTo(cal, blockedDate);

  assert.equal(result.patched, false, 'COUNT must not be extended twice for one slot');
  assert.equal(result.excludedCount, 0);
  assert.equal(cal.patches, 0);
  assert.match(cal.master.recurrence[0], /COUNT=11$/);
});

test('EXDATEs Google rewrote to UTC are still recognised as exclusions', async () => {
  // Google may hand back a UTC instant rather than the TZID wall clock it was
  // sent; unmatched, the same slot would be excluded again on every sync.
  const { cal, blockedDate } = blockedSlotFixture(
    (date) => `EXDATE;VALUE=DATE-TIME:${basicUtc(zurichToUtc(date, LESSON_TIME))}`
  );

  const result = await applyTo(cal, blockedDate);

  assert.equal(result.patched, false);
  assert.match(cal.master.recurrence[0], /COUNT=11$/);
});

test('a date-only EXDATE covers every time on that day', async () => {
  const { cal, blockedDate } = blockedSlotFixture(
    (date) => `EXDATE;VALUE=DATE:${date.replace(/-/g, '')}`
  );

  const result = await applyTo(cal, blockedDate);

  assert.equal(result.patched, false);
  assert.match(cal.master.recurrence[0], /COUNT=11$/);
});

// ── The fetch window ────────────────────────────────────────────────────

test('sessions older than the fetch window survive a sync', async (t) => {
  // A course that finished long ago. Google is only asked about the last 90
  // days, so none of its events come back.
  const startDate = addDays(today(), -400);
  const sessions = Array.from({ length: 10 }, (_, i) => {
    const utc = zurichToUtc(addDays(startDate, 7 * i), LESSON_TIME);
    return {
      id: `seed${i}`,
      course_id: COURSE_ID,
      calendar_event_id: `${MASTER_ID}_${basicUtc(utc)}`,
      scheduled_at: utc.toISOString(),
      duration_minutes: 50,
      status: 'completed',
    };
  });

  const { db, run } = makeWorld(t, {
    cal: makeCalendar({ startDate }),
    sessions,
    course: { sessions_completed: 10 },
  });

  const res = await run();
  assert.equal(res.body.events_found, 0, 'nothing inside the 90-day window');
  assert.equal(res.body.removed, 0, 'absence outside the window is not deletion');
  assert.equal(db.sessions.length, 10, 'the history is intact');
  assert.equal(db.courses[0].sessions_completed, 10, 'progress is not reset');
});

test('a session whose event really was deleted inside the window is removed', async (t) => {
  const startDate = addDays(today(), -14);
  const { db, run } = makeWorld(t, {
    cal: makeCalendar({ startDate }),
    sessions: [
      {
        id: 'ghost',
        course_id: COURSE_ID,
        calendar_event_id: `${MASTER_ID}_deleted-by-hand`,
        scheduled_at: zurichToUtc(startDate, LESSON_TIME).toISOString(),
        duration_minutes: 50,
        status: 'scheduled',
      },
    ],
  });

  const res = await run();
  assert.equal(res.body.removed, 1);
  assert.equal(
    db.sessions.some((s) => s.id === 'ghost'),
    false
  );
});

// ── Duplicate session rows ──────────────────────────────────────────────

/** Two rows recording the same calendar instance, as seen on course 50145. */
function duplicatePair(startDate, [idA, idB]) {
  const utc = zurichToUtc(startDate, LESSON_TIME);
  return [idA, idB].map((id) => ({
    id,
    course_id: COURSE_ID,
    calendar_event_id: instanceId(startDate),
    scheduled_at: utc.toISOString(),
    duration_minutes: 50,
    status: 'scheduled',
  }));
}

test('two rows for one calendar instance are collapsed to one', async (t) => {
  const startDate = upcomingMonday();
  const { db, run } = makeWorld(t, {
    cal: makeCalendar({ startDate, count: 3 }),
    sessions: duplicatePair(startDate, ['dupe-a', 'dupe-b']),
  });

  const res = await run();
  assert.equal(res.body.deduplicated, 1);
  assert.equal(db.sessions.filter((s) => s.calendar_event_id === instanceId(startDate)).length, 1);
  assert.equal(db.sessions.length, 3, 'one row per occurrence of the series');

  // The pass is a no-op once there is nothing left to collapse.
  const again = await run();
  assert.equal(again.body.deduplicated, 0);
  assert.equal(db.sessions.length, 3);
});

test('the duplicate carrying attendance is the copy that survives', async (t) => {
  const startDate = upcomingMonday();
  const { db, run } = makeWorld(t, {
    cal: makeCalendar({ startDate, count: 3 }),
    // 'dupe-a' would win on id order alone; the logged lesson has to outrank it.
    sessions: duplicatePair(startDate, ['dupe-a', 'dupe-b']),
    attendance: [{ id: 'att1', session_id: 'dupe-b', student_id: 'stud1', present: true }],
  });

  const res = await run();
  assert.equal(res.body.deduplicated, 1);
  assert.deepEqual(
    db.sessions.filter((s) => s.calendar_event_id === instanceId(startDate)).map((s) => s.id),
    ['dupe-b']
  );
});

test('duplicates with attendance on both copies are left for a human', async (t) => {
  const startDate = upcomingMonday();
  const { db, run } = makeWorld(t, {
    cal: makeCalendar({ startDate, count: 3 }),
    sessions: duplicatePair(startDate, ['dupe-a', 'dupe-b']),
    attendance: [
      { id: 'att1', session_id: 'dupe-a', student_id: 'stud1', present: true },
      { id: 'att2', session_id: 'dupe-b', student_id: 'stud2', present: false },
    ],
  });

  const res = await run();
  assert.equal(res.body.deduplicated, 0, 'merging attendance is not a sync decision');
  assert.equal(db.sessions.filter((s) => s.calendar_event_id === instanceId(startDate)).length, 2);
});

// ── Status handling ─────────────────────────────────────────────────────

test('a cancelled session is not revived by a surviving calendar event', async (t) => {
  const startDate = upcomingMonday();
  const { db, run } = makeWorld(t, {
    cal: makeCalendar({ startDate }),
    sessions: [
      {
        id: 'cancelled-1',
        course_id: COURSE_ID,
        calendar_event_id: instanceId(startDate),
        scheduled_at: zurichToUtc(startDate, LESSON_TIME).toISOString(),
        duration_minutes: 50,
        status: 'cancelled',
      },
    ],
  });

  const res = await run();
  assert.equal(res.body.kept_cancelled, 1);
  assert.equal(db.sessions.find((s) => s.id === 'cancelled-1').status, 'cancelled');
});

test('a cancelled session survives its calendar event being gone', async (t) => {
  // Cancelling a lesson deletes the calendar event, so a cancelled row always
  // looks deleted-from-Google to the reconcile pass. Removing it would erase
  // the cancellation itself — the row is the only record that the lesson was
  // called off rather than never scheduled.
  const startDate = addDays(today(), -14);
  const { db, run } = makeWorld(t, {
    cal: makeCalendar({ startDate }),
    sessions: [
      {
        id: 'cancelled-gone',
        course_id: COURSE_ID,
        calendar_event_id: `${MASTER_ID}_cancelled-and-deleted`,
        scheduled_at: zurichToUtc(startDate, LESSON_TIME).toISOString(),
        duration_minutes: 50,
        status: 'cancelled',
      },
    ],
  });

  const res = await run();
  assert.equal(res.body.removed, 0);
  assert.ok(db.sessions.some((s) => s.id === 'cancelled-gone'));
});

test('sessions_completed counts the whole course, cancelled rows excluded', async (t) => {
  // Two logged lessons and one cancelled, all outside the fetch window, plus
  // one occurrence inside it that has just passed.
  const old = addDays(today(), -300);
  const sessions = ['completed', 'completed', 'cancelled'].map((status, i) => {
    const utc = zurichToUtc(addDays(old, 7 * i), LESSON_TIME);
    return {
      id: `old${i}`,
      course_id: COURSE_ID,
      calendar_event_id: `${MASTER_ID}_${basicUtc(utc)}`,
      scheduled_at: utc.toISOString(),
      duration_minutes: 50,
      status,
    };
  });

  const { db, run } = makeWorld(t, {
    cal: makeCalendar({ startDate: addDays(today(), -7), count: 1 }),
    sessions,
  });

  const res = await run();
  assert.equal(res.body.completed, 3, 'two historical plus the one just past');
  assert.equal(db.courses[0].sessions_completed, 3);
});

// ── Calendar titles ─────────────────────────────────────────────────────
//
// The title is derived from the course record, so sync is what pushes it to
// Google. Two properties matter more than the string itself: an event must
// still be findable after a rename (or the deletion pass above removes its
// session), and an ordinary instance must never be patched into an override.

const GROUP_COURSE = { subject: 'German', level: 'B1.2', group_type: 'group' };
const NEW_TITLE = `German B1.2 class · ${COURSE_CODE}`;

test('a stale series is renamed once, and repeated syncs leave it alone', async (t) => {
  const { db, cal, run } = makeWorld(t, { course: GROUP_COURSE });

  const res = await run();
  assert.equal(res.status, 200);
  assert.equal(res.body.renamed_title, NEW_TITLE);
  assert.equal(res.body.renamed_events, 1);
  assert.equal(cal.master.summary, NEW_TITLE);
  assert.equal(cal.titlePatches, 1);

  const settled = sessionDates(db);
  for (let i = 0; i < 3; i++) {
    const again = await run();
    assert.equal(again.body.renamed_events, 0, 'nothing left to rename');
  }
  assert.equal(cal.titlePatches, 1, 'the series is renamed once, not once per sync');
  assert.deepEqual(sessionDates(db), settled);
});

test('events already in the new format are still found', async (t) => {
  // The regression that matters most: the matcher used to demand the course
  // code at the *start* of the summary. Under that rule every event here
  // vanishes, the deletion pass calls them deleted, and the course loses its
  // entire session history.
  const { db, cal, run } = makeWorld(t, {
    cal: makeCalendar({ summary: NEW_TITLE }),
    course: GROUP_COURSE,
  });

  const res = await run();
  assert.equal(res.body.events_found, 10);
  assert.equal(res.body.removed, 0);
  assert.equal(db.sessions.length, 10);
  assert.equal(cal.titlePatches, 0, 'already correct — no write at all');
});

test('renaming leaves every session row untouched', async (t) => {
  const { db, run } = makeWorld(t, { course: GROUP_COURSE });
  await run();
  const before = db.sessions.map((s) => `${s.id}:${s.calendar_event_id}`).sort();

  await run();
  assert.deepEqual(db.sessions.map((s) => `${s.id}:${s.calendar_event_id}`).sort(), before);
});

test('a hand-moved instance is renamed by its own patch', async (t) => {
  const startDate = upcomingMonday();
  const movedSlot = addDays(startDate, 14);
  const { cal, run } = makeWorld(t, {
    cal: makeCalendar({
      startDate,
      overrides: { [`${movedSlot}T${LESSON_TIME}`]: [addDays(movedSlot, 2), LESSON_TIME] },
    }),
    course: GROUP_COURSE,
  });

  const res = await run();
  assert.equal(cal.master.summary, NEW_TITLE);
  // The override froze its own copy of the summary, so the parent patch never
  // reached it and it needed one of its own.
  assert.deepEqual([...cal.instancePatches.values()], [NEW_TITLE]);
  assert.equal(res.body.renamed_events, 2);
});

test('an instance that merely lagged is never patched into an override', async (t) => {
  const startDate = upcomingMonday();
  const { cal, run } = makeWorld(t, {
    cal: makeCalendar({ startDate, lagSlots: [`${addDays(startDate, 7)}T${LESSON_TIME}`] }),
    course: GROUP_COURSE,
  });

  const res = await run();
  assert.equal(res.status, 200);
  assert.equal(cal.master.summary, NEW_TITLE);
  assert.equal(cal.instancePatches.size, 0, 'a stale instance is left for the next sync');
  assert.equal(res.body.renamed_events, 1, 'only the master');
});

test('a standalone hand-made session is renamed directly', async (t) => {
  const startDate = upcomingMonday();
  const utc = zurichToUtc(addDays(startDate, 3), LESSON_TIME);
  const { cal, run } = makeWorld(t, {
    cal: makeCalendar({
      startDate,
      standalone: [
        {
          id: 'manual-1',
          summary: `${COURSE_CODE} — catch-up`,
          start: { dateTime: utc.toISOString(), timeZone: 'Europe/Zurich' },
          end: { dateTime: new Date(utc.getTime() + 50 * 60000).toISOString() },
        },
      ],
    }),
    course: GROUP_COURSE,
  });

  const res = await run();
  assert.equal(res.body.events_found, 11, 'the hand-made session syncs too');
  assert.equal(cal.instancePatches.get('manual-1'), NEW_TITLE);
});

test('a rename that Google refuses does not fail the sync', async (t) => {
  const { db, cal, run } = makeWorld(t, { course: GROUP_COURSE });
  cal.failPatch.add(MASTER_ID);

  const res = await run();
  assert.equal(res.status, 200);
  assert.equal(res.body.events_found, 10);
  assert.equal(db.sessions.length, 10, 'sessions are synced regardless');
  assert.equal(res.body.renamed_events, 0);
  assert.notEqual(cal.master.summary, NEW_TITLE);
  // And it must not fall back to renaming the instances one by one — that
  // would turn a failed rename into ten new overrides.
  assert.equal(cal.instancePatches.size, 0);
});

test('a course with nothing to say about itself keeps its title', async (t) => {
  const { cal, run } = makeWorld(t, { course: { group_type: 'group', level: 'XX' } });
  const before = cal.master.summary;

  const res = await run();
  assert.equal(res.body.renamed_title, null);
  assert.equal(cal.titlePatches, 0);
  assert.equal(cal.master.summary, before);
});

test('a linked company leads the title', async (t) => {
  const { cal, run } = makeWorld(t, {
    course: { ...GROUP_COURSE, company_id: 'comp-1', location_company: 'Some Building' },
    companies: [{ id: 'comp-1', name: 'Apple' }],
  });

  await run();
  assert.equal(cal.master.summary, `Apple German B1.2 · ${COURSE_CODE}`);
});

test('a private lesson at a company address is titled by the student, not the venue', async (t) => {
  const course = {
    subject: 'German',
    level: 'A2',
    group_type: 'private',
    location_company: 'Apple',
  };
  const { cal, run } = makeWorld(t, {
    course,
    enrolments: [{ id: 'e1', course_id: COURSE_ID, student_id: 'stu-1' }],
    students: [{ id: 'stu-1', first_name: 'Bharat' }],
  });

  await run();
  assert.equal(cal.master.summary, `Bharat German A2 · ${COURSE_CODE}`);
});

test('an unlinked group course falls back to the venue name', async (t) => {
  const { cal, run } = makeWorld(t, {
    course: { ...GROUP_COURSE, location_company: 'Apple' },
  });

  await run();
  assert.equal(cal.master.summary, `Apple German B1.2 · ${COURSE_CODE}`);
});

test('the student first name comes from enrolments, not the creation snapshot', async (t) => {
  const { cal, run } = makeWorld(t, {
    course: {
      subject: 'German',
      level: 'A2',
      group_type: 'private',
      participant_names: ['Anna'],
    },
    enrolments: [{ id: 'e1', course_id: COURSE_ID, student_id: 'stu-1' }],
    students: [{ id: 'stu-1', first_name: 'Annika' }],
  });

  await run();
  assert.equal(cal.master.summary, `Annika German A2 · ${COURSE_CODE}`);
});
