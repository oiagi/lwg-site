// Run with: node --test tests/
// Tests for GET /api/get-courses: attendance is attached to every session and
// past sessions without it are flagged as unlogged.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet as getCourses, annotateSessions } from '../functions/api/get-courses.js';

const ENV = {
  SUPABASE_URL: 'https://supabase.test',
  SUPABASE_SERVICE_KEY: 'service-key',
  SUPABASE_ANON_KEY: 'anon-key',
};

const HOUR = 60 * 60 * 1000;
const iso = (offsetMs) => new Date(Date.now() + offsetMs).toISOString();

// `attendanceStatuses` is consumed one status per attendance request, so a
// test can make the first select fail and the retry succeed.
function makeWorld(t, { sessions = [], attendance = [], attendanceStatuses = [] } = {}) {
  const db = {
    courses: [{ id: 'c1', course_code: 'P-A1-001', status: 'active', session_length_minutes: 50 }],
    sessions,
    attendance,
    enrolments: [{ student_id: 'stu-1', course_id: 'c1' }],
    students: [{ id: 'stu-1', first_name: 'Anna' }],
  };
  const calls = [];
  const json = (value, status = 200) =>
    new Response(JSON.stringify(value), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });

  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });

  globalThis.fetch = async (url) => {
    const u = String(url);
    calls.push(u);
    if (u.includes('/auth/v1/user')) return json({ id: 'admin' });
    const rest = u.match(/\/rest\/v1\/(\w+)(?:\?(.*))?$/);
    if (!rest) throw new Error(`unexpected fetch: ${u}`);
    const [, table, query = ''] = rest;
    if (table === 'attendance') {
      const status = attendanceStatuses.shift() ?? 200;
      if (status !== 200) return json({ message: 'column missing' }, status);
      const inMatch = query.match(/session_id=in\.\(([^)]*)\)/);
      const wanted = new Set(inMatch ? inMatch[1].split(',') : []);
      const rows = db.attendance.filter((r) => wanted.has(r.session_id));
      // A compat select never returns the columns it did not ask for.
      if (!/select=[^&]*\bmode\b/.test(query)) {
        return json(rows.map(({ mode: _mode, portion: _portion, ...rest }) => rest));
      }
      return json(rows);
    }
    return json(db[table] || []);
  };

  const run = async () => {
    const request = new Request('https://learningwithgioia.ch/api/get-courses?status=all', {
      headers: { Authorization: 'Bearer token' },
    });
    const res = await getCourses({ request, env: ENV });
    return { status: res.status, body: await res.json() };
  };

  return { calls, run };
}

const session = (id, offsetMs, extra = {}) => ({
  id,
  course_id: 'c1',
  scheduled_at: iso(offsetMs),
  duration_minutes: 50,
  status: 'scheduled',
  ...extra,
});

// ── annotateSessions ─────────────────────────────────────────────────────

test('annotateSessions flags past sessions that have no attendance', () => {
  const now = Date.parse('2026-10-16T12:00:00Z');
  const course = { session_length_minutes: 60 };
  const sessions = [
    { id: 'past', scheduled_at: '2026-10-15T10:00:00Z', duration_minutes: 50, status: 'scheduled' },
    {
      id: 'logged',
      scheduled_at: '2026-10-14T10:00:00Z',
      duration_minutes: 50,
      status: 'completed',
    },
    {
      id: 'future',
      scheduled_at: '2026-10-17T10:00:00Z',
      duration_minutes: 50,
      status: 'scheduled',
    },
    // Still running: starts 30 minutes before `now`, lasts an hour by course default.
    {
      id: 'running',
      scheduled_at: '2026-10-16T11:30:00Z',
      duration_minutes: null,
      status: 'scheduled',
    },
    // The old sync completed this by date alone; it still needs logging.
    {
      id: 'legacy',
      scheduled_at: '2026-09-01T10:00:00Z',
      duration_minutes: 50,
      status: 'completed',
    },
    { id: 'off', scheduled_at: '2026-09-01T10:00:00Z', duration_minutes: 50, status: 'cancelled' },
    { id: 'undated', scheduled_at: null, duration_minutes: 50, status: 'scheduled' },
  ];
  const byId = Object.fromEntries(
    annotateSessions(
      sessions,
      { logged: [{ session_id: 'logged', student_id: 'stu-1', present: true }] },
      course,
      now
    ).map((s) => [s.id, s])
  );

  assert.deepEqual(
    Object.fromEntries(Object.entries(byId).map(([id, s]) => [id, [s.logged, s.unlogged]])),
    {
      past: [false, true],
      logged: [true, false],
      future: [false, false],
      running: [false, false],
      legacy: [false, true],
      off: [false, false],
      undated: [false, false],
    }
  );
  assert.equal(byId.logged.attendance.length, 1);
  assert.deepEqual(byId.past.attendance, []);
});

// ── The handler ──────────────────────────────────────────────────────────

test('attendance is fetched once per batch and attached to its session', async (t) => {
  const { calls, run } = makeWorld(t, {
    sessions: [
      session('s-past', -48 * HOUR),
      session('s-done', -24 * HOUR, { status: 'completed' }),
      session('s-next', 24 * HOUR),
    ],
    attendance: [
      { session_id: 's-done', student_id: 'stu-1', present: true, mode: 'online', portion: 'half' },
    ],
  });

  const res = await run();
  assert.equal(res.status, 200);
  const attendanceCalls = calls.filter((u) => u.includes('/rest/v1/attendance'));
  assert.equal(attendanceCalls.length, 1, 'one query for all sessions');
  assert.match(attendanceCalls[0], /session_id=in\.\(s-past,s-done,s-next\)/);

  const [course] = res.body;
  const byId = Object.fromEntries(course.sessions.map((s) => [s.id, s]));
  assert.deepEqual(byId['s-done'].attendance, [
    { session_id: 's-done', student_id: 'stu-1', present: true, mode: 'online', portion: 'half' },
  ]);
  assert.equal(byId['s-done'].logged, true);
  assert.equal(byId['s-done'].unlogged, false);
  assert.equal(byId['s-past'].unlogged, true);
  assert.equal(byId['s-next'].unlogged, false);
  assert.equal(course.unlogged_count, 1);
});

test('a database without the new columns falls back to the compat select', async (t) => {
  // The first select names mode/portion; a 400 means the migration has not
  // run yet, so the sync-era columns are requested instead.
  const { calls, run } = makeWorld(t, {
    sessions: [session('s1', -24 * HOUR)],
    attendance: [{ session_id: 's1', student_id: 'stu-1', present: true }],
    attendanceStatuses: [400],
  });

  const res = await run();
  const attendanceCalls = calls.filter((u) => u.includes('/rest/v1/attendance'));
  assert.equal(attendanceCalls.length, 2);
  assert.match(attendanceCalls[1], /select=session_id,student_id,present$/);
  const [s1] = res.body[0].sessions;
  assert.equal(s1.logged, true);
  assert.equal(s1.attendance[0].mode, 'in_person', 'missing columns read as the defaults');
  assert.equal(s1.attendance[0].portion, 'full');
});

test('an attendance outage degrades to "nothing logged" instead of failing', async (t) => {
  const { run } = makeWorld(t, {
    sessions: [session('s1', -24 * HOUR)],
    attendanceStatuses: [500],
  });
  const res = await run();
  assert.equal(res.status, 200);
  assert.equal(res.body[0].sessions[0].unlogged, true);
});
