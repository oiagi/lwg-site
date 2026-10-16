// Run with: node --test tests/
// Tests for POST /api/save-attendance — the one path that completes a session.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  onRequestPost as saveAttendance,
  normaliseRecord,
} from '../functions/api/save-attendance.js';

const ENV = {
  SUPABASE_URL: 'https://supabase.test',
  SUPABASE_SERVICE_KEY: 'service-key',
  SUPABASE_ANON_KEY: 'anon-key',
};

const SESSION_ID = 'sess-1';
const COURSE_ID = 'course-1';

/**
 * In-memory PostgREST for the three tables the handler touches. Every request
 * is recorded so tests can assert on URLs and headers, not just on state.
 */
function makeWorld(t, { session = {}, course = {}, failStudent = null } = {}) {
  const db = {
    sessions: [{ id: SESSION_ID, course_id: COURSE_ID, status: 'scheduled', ...session }],
    courses: [{ id: COURSE_ID, sessions_completed: 0, ...course }],
    attendance: [],
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

  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    const method = opts.method || 'GET';
    const body = opts.body ? JSON.parse(opts.body) : null;
    calls.push({ url: u, method, body, headers: opts.headers || {} });

    if (u.includes('/auth/v1/user')) {
      return opts.headers.Authorization === 'Bearer good' ? json({ id: 'admin' }) : json({}, 401);
    }

    const rest = u.match(/\/rest\/v1\/(\w+)(?:\?(.*))?$/);
    if (!rest) throw new Error(`unexpected fetch: ${method} ${u}`);
    const [, table, query = ''] = rest;
    const idMatch = query.match(/(?:^|&)id=eq\.([^&]+)/);
    const id = idMatch ? decodeURIComponent(idMatch[1]) : null;

    if (table === 'attendance' && method === 'POST') {
      if (failStudent && body.student_id === failStudent) return json({ error: 'boom' }, 500);
      const existing = db.attendance.find(
        (r) => r.session_id === body.session_id && r.student_id === body.student_id
      );
      if (existing) {
        Object.assign(existing, body);
        return json([existing]);
      }
      const row = { id: `att-${db.attendance.length + 1}`, ...body };
      db.attendance.push(row);
      return json([row]);
    }
    if (method === 'GET') {
      let rows = db[table] || [];
      if (id) rows = rows.filter((r) => r.id === id);
      return json(rows);
    }
    if (method === 'PATCH') {
      const row = (db[table] || []).find((r) => r.id === id);
      if (row) Object.assign(row, body);
      return json(row ? [row] : []);
    }
    throw new Error(`unexpected fetch: ${method} ${u}`);
  };

  const run = async (payload, { token = 'good' } = {}) => {
    const request = new Request('https://learningwithgioia.ch/api/save-attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    const res = await saveAttendance({ request, env: ENV });
    return { status: res.status, body: await res.json() };
  };

  const writes = () => calls.filter((c) => c.method !== 'GET' && !c.url.includes('/auth/'));

  return { db, calls, run, writes };
}

const present = (student_id, extra = {}) => ({ student_id, present: true, ...extra });

// ── normaliseRecord ──────────────────────────────────────────────────────

test('normaliseRecord defaults mode and portion, and resets them for absentees', () => {
  assert.deepEqual(normaliseRecord('s', { student_id: 'a' }), {
    session_id: 's',
    student_id: 'a',
    present: true,
    mode: 'in_person',
    portion: 'full',
  });
  assert.deepEqual(
    normaliseRecord('s', { student_id: 'a', present: true, mode: 'online', portion: 'half' }),
    { session_id: 's', student_id: 'a', present: true, mode: 'online', portion: 'half' }
  );
  // Online and half are independent — one without the other is fine too.
  assert.equal(normaliseRecord('s', { student_id: 'a', mode: 'online' }).portion, 'full');
  assert.deepEqual(
    normaliseRecord('s', { student_id: 'a', present: false, mode: 'online', portion: 'half' }),
    { session_id: 's', student_id: 'a', present: false, mode: 'in_person', portion: 'full' }
  );
  assert.equal(normaliseRecord('s', { student_id: 'a', notes: 'late' }).notes, 'late');
});

// ── Auth and validation ─────────────────────────────────────────────────

test('rejects a bad token before touching the database', async (t) => {
  const { run, writes } = makeWorld(t);
  const res = await run({ session_id: SESSION_ID, records: [present('a')] }, { token: 'bad' });
  assert.equal(res.status, 401);
  assert.equal(writes().length, 0);
});

test('rejects invalid bodies with 400 and writes nothing', async (t) => {
  const { run, writes } = makeWorld(t);

  let res = await run({ records: [present('a')] });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /session_id/);

  res = await run({ session_id: SESSION_ID, records: [] });
  assert.equal(res.status, 400);

  res = await run({ session_id: SESSION_ID, records: [{ present: true }] });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /student_id/);

  res = await run({ session_id: SESSION_ID, records: [present('a', { mode: 'remote' })] });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /mode/);

  res = await run({ session_id: SESSION_ID, records: [present('a', { portion: 'quarter' })] });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /portion/);

  // One bad record spoils the whole request — nothing is half-saved.
  res = await run({
    session_id: SESSION_ID,
    records: [present('a'), present('b', { mode: 'remote' })],
  });
  assert.equal(res.status, 400);
  assert.equal(writes().length, 0);
});

test('404 for an unknown session', async (t) => {
  const { run } = makeWorld(t);
  const res = await run({ session_id: 'nope', records: [present('a')] });
  assert.equal(res.status, 404);
});

// ── Saving ───────────────────────────────────────────────────────────────

test('upserts on (session_id, student_id) and completes the session once', async (t) => {
  const { db, calls, run } = makeWorld(t);

  const res = await run({
    session_id: SESSION_ID,
    records: [
      present('a', { mode: 'online', portion: 'half' }),
      { student_id: 'b', present: false, mode: 'online' },
    ],
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.saved_count, 2);
  assert.equal(res.body.newly_completed, true);

  const upserts = calls.filter((c) => c.method === 'POST' && c.url.includes('/attendance'));
  assert.equal(upserts.length, 2);
  for (const call of upserts) {
    assert.match(call.url, /on_conflict=session_id,student_id/);
    assert.match(call.headers.Prefer, /resolution=merge-duplicates/);
  }
  assert.deepEqual(
    db.attendance.map(({ id: _id, ...rest }) => rest),
    [
      { session_id: SESSION_ID, student_id: 'a', present: true, mode: 'online', portion: 'half' },
      {
        session_id: SESSION_ID,
        student_id: 'b',
        present: false,
        mode: 'in_person',
        portion: 'full',
      },
    ]
  );
  assert.equal(db.sessions[0].status, 'completed');
  assert.equal(db.courses[0].sessions_completed, 1);

  // Correcting the record later does not count the lesson twice.
  const again = await run({ session_id: SESSION_ID, records: [present('a'), present('b')] });
  assert.equal(again.body.newly_completed, false);
  assert.equal(db.attendance.length, 2, 'rows were updated, not duplicated');
  assert.equal(db.attendance.find((r) => r.student_id === 'b').present, true);
  assert.equal(db.courses[0].sessions_completed, 1);
});

test('a failed record leaves the session incomplete', async (t) => {
  const { db, run } = makeWorld(t, { failStudent: 'b' });
  const res = await run({ session_id: SESSION_ID, records: [present('a'), present('b')] });
  assert.equal(res.status, 200);
  assert.equal(res.body.saved_count, 1);
  assert.equal(res.body.errors.length, 1);
  assert.equal(res.body.newly_completed, false);
  assert.equal(db.sessions[0].status, 'scheduled');
  assert.equal(db.courses[0].sessions_completed, 0);
});
