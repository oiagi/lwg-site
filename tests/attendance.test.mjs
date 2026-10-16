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
function makeWorld(
  t,
  { session = {}, course = {}, failStudent = null, failTable = null, seed = {} } = {}
) {
  const db = {
    sessions: [{ id: SESSION_ID, course_id: COURSE_ID, status: 'scheduled', ...session }],
    courses: [{ id: COURSE_ID, sessions_completed: 0, ...course }],
    attendance: [],
    session_topics: [],
    session_materials: [],
    ...seed,
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
    if (table === 'session_topics' || table === 'session_materials') {
      if (failTable === table) return json({ error: 'boom' }, 500);
      const sid = decodeURIComponent(query.match(/session_id=eq\.([^&]+)/)?.[1] || '');
      if (method === 'DELETE') {
        db[table] = db[table].filter((r) => r.session_id !== sid);
        return new Response(null, { status: 204 });
      }
      if (method === 'POST') {
        db[table].push(...body);
        return new Response(null, { status: 201 });
      }
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

// ── Lesson content: topics, materials, notes ────────────────────────────

test('topic_ids, materials and notes replace what was stored, then the session completes', async (t) => {
  const { db, calls, run } = makeWorld(t, {
    seed: {
      session_topics: [
        { session_id: SESSION_ID, topic_id: 'old' },
        { session_id: 'other', topic_id: 'keep' },
      ],
      session_materials: [{ session_id: SESSION_ID, material_id: 'old-book' }],
    },
  });

  const res = await run({
    session_id: SESSION_ID,
    records: [present('a')],
    topic_ids: ['perfekt', 'dativ', 'perfekt'],
    materials: [
      { material_id: 'book', chapter: ' 3 ', pages: '45–52' },
      { material_id: 'book', pages: '60' },
    ],
    notes: '  Hausaufgabe: S. 53  ',
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.newly_completed, true);

  assert.deepEqual(db.session_topics, [
    { session_id: 'other', topic_id: 'keep' },
    { session_id: SESSION_ID, topic_id: 'perfekt' },
    { session_id: SESSION_ID, topic_id: 'dativ' },
  ]);
  assert.deepEqual(db.session_materials, [
    { session_id: SESSION_ID, material_id: 'book', chapter: '3', pages: '45–52', position: 0 },
    { session_id: SESSION_ID, material_id: 'book', chapter: null, pages: '60', position: 1 },
  ]);
  assert.equal(db.sessions[0].notes, 'Hausaufgabe: S. 53');
  assert.equal(db.sessions[0].status, 'completed');

  // Each list is deleted before it is re-inserted.
  const crmCalls = calls
    .filter((c) => /session_(topics|materials)/.test(c.url))
    .map((c) => `${c.method} ${c.url.match(/session_\w+/)[0]}`);
  assert.deepEqual(crmCalls, [
    'DELETE session_topics',
    'POST session_topics',
    'DELETE session_materials',
    'POST session_materials',
  ]);
});

test('an empty list clears it; absent keys leave stored content untouched', async (t) => {
  const { db, calls, run } = makeWorld(t, {
    session: { notes: 'keep me' },
    seed: { session_topics: [{ session_id: SESSION_ID, topic_id: 'old' }] },
  });

  await run({ session_id: SESSION_ID, records: [present('a')] });
  assert.equal(calls.filter((c) => /session_(topics|materials)/.test(c.url)).length, 0);
  assert.equal(db.session_topics.length, 1);
  assert.equal(db.sessions[0].notes, 'keep me');

  await run({ session_id: SESSION_ID, records: [present('a')], topic_ids: [], notes: '' });
  assert.equal(db.session_topics.length, 0);
  assert.equal(
    calls.filter((c) => c.method === 'POST' && c.url.includes('session_topics')).length,
    0,
    'nothing to insert after clearing'
  );
  assert.equal(db.sessions[0].notes, null);
});

test('malformed lesson content is rejected with 400 before any write', async (t) => {
  const { run, writes } = makeWorld(t);
  const base = { session_id: SESSION_ID, records: [present('a')] };
  const bad = [
    [{ topic_ids: 'perfekt' }, /topic_ids/],
    [{ topic_ids: ['ok', 7] }, /topic_ids/],
    [{ topic_ids: Array.from({ length: 31 }, (_, i) => `t${i}`) }, /topic_ids/],
    [{ materials: [{ chapter: '3' }] }, /material_id/],
    [{ materials: ['book'] }, /materials/],
    [{ materials: [{ material_id: 'b', pages: 'x'.repeat(101) }] }, /pages/],
    [{ materials: Array.from({ length: 21 }, () => ({ material_id: 'b' })) }, /materials/],
    [{ notes: 'x'.repeat(5001) }, /notes/],
  ];
  for (const [extra, pattern] of bad) {
    const res = await run({ ...base, ...extra });
    assert.equal(res.status, 400, JSON.stringify(extra).slice(0, 60));
    assert.match(res.body.error, pattern);
  }
  assert.equal(writes().length, 0);
});

test('a failed topic write leaves the session incomplete', async (t) => {
  const { db, run } = makeWorld(t, { failTable: 'session_topics' });
  const res = await run({
    session_id: SESSION_ID,
    records: [present('a')],
    topic_ids: ['perfekt'],
    materials: [{ material_id: 'book' }],
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.newly_completed, false);
  assert.deepEqual(res.body.errors, [{ field: 'topic_ids', error: 'Database error' }]);
  assert.equal(db.sessions[0].status, 'scheduled');
  assert.equal(db.session_materials.length, 0, 'materials are not written after a topic failure');
});
