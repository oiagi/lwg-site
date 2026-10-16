// Run with: node --test tests/
// Tests for the topic tag endpoints (get-topics, save-topic).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet as getTopics } from '../functions/api/get-topics.js';
import { onRequestPost as saveTopic } from '../functions/api/save-topic.js';

const ENV = {
  SUPABASE_URL: 'https://supabase.test',
  SUPABASE_SERVICE_KEY: 'service-key',
  SUPABASE_ANON_KEY: 'anon-key',
};

// Mimics the topics_kind_name_key unique index: same kind, same name
// ignoring case → 409 from PostgREST.
function makeWorld(t, topics = []) {
  const db = { topics: [...topics] };
  const calls = [];
  const json = (value, status = 200) =>
    new Response(JSON.stringify(value), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  const clash = (row, ignoreId) =>
    db.topics.some(
      (x) =>
        x.id !== ignoreId && x.kind === row.kind && x.name.toLowerCase() === row.name.toLowerCase()
    );

  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });

  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    const method = opts.method || 'GET';
    const body = opts.body ? JSON.parse(opts.body) : null;
    calls.push({ url: u, method, body });
    if (u.includes('/auth/v1/user')) {
      return opts.headers.Authorization === 'Bearer good' ? json({ id: 'admin' }) : json({}, 401);
    }
    const query = u.split('?')[1] || '';
    const id = query.match(/(?:^|&)id=eq\.([^&]+)/)?.[1];
    if (method === 'GET') {
      let rows = db.topics;
      if (query.includes('archived=eq.false')) rows = rows.filter((r) => !r.archived);
      return json(rows);
    }
    if (method === 'POST') {
      if (clash(body)) return json({ code: '23505' }, 409);
      const row = { id: `t${db.topics.length + 1}`, archived: false, ...body };
      db.topics.push(row);
      return json([row], 201);
    }
    if (method === 'PATCH') {
      const row = db.topics.find((r) => r.id === id);
      if (!row) return json([]);
      const next = { ...row, ...body };
      if (clash(next, row.id)) return json({ code: '23505' }, 409);
      Object.assign(row, body);
      return json([row]);
    }
    throw new Error(`unexpected fetch: ${method} ${u}`);
  };

  const save = async (body, token = 'good') => {
    const request = new Request('https://learningwithgioia.ch/api/save-topic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const res = await saveTopic({ request, env: ENV });
    return { status: res.status, body: await res.json() };
  };
  const list = async (qs = '') => {
    const request = new Request(`https://learningwithgioia.ch/api/get-topics${qs}`, {
      headers: { Authorization: 'Bearer good' },
    });
    const res = await getTopics({ request, env: ENV });
    return { status: res.status, body: await res.json() };
  };

  return { db, calls, save, list };
}

test('save-topic requires admin auth', async (t) => {
  const { db, save } = makeWorld(t);
  const res = await save({ kind: 'grammar', name: 'Perfekt' }, 'bad');
  assert.equal(res.status, 401);
  assert.equal(db.topics.length, 0);
});

test('creates a tag with a tidied name', async (t) => {
  const { db, save } = makeWorld(t);
  const res = await save({ kind: 'grammar', name: '  Verben  mit   Dativ ' });
  assert.equal(res.status, 200);
  assert.equal(res.body.name, 'Verben mit Dativ');
  assert.equal(db.topics.length, 1);
});

test('rejects bad kinds, empty or overlong names, and creates without both fields', async (t) => {
  const { db, save } = makeWorld(t);
  for (const body of [
    { kind: 'phonetics', name: 'x' },
    { kind: 'grammar', name: '   ' },
    { kind: 'grammar', name: 'x'.repeat(121) },
    { kind: 'grammar' },
    { name: 'Perfekt' },
    { id: 't1' },
  ]) {
    const res = await save(body);
    assert.equal(res.status, 400, JSON.stringify(body).slice(0, 60));
  }
  assert.equal(db.topics.length, 0);
});

test('a duplicate name within the same kind is a 409; across kinds it is fine', async (t) => {
  const { db, save } = makeWorld(t, [{ id: 't1', kind: 'grammar', name: 'Perfekt' }]);
  let res = await save({ kind: 'grammar', name: 'perfekt' });
  assert.equal(res.status, 409);
  assert.equal(res.body.error, 'Tag existiert bereits');
  res = await save({ kind: 'vocabulary', name: 'Perfekt' });
  assert.equal(res.status, 200);
  assert.equal(db.topics.length, 2);
});

test('renames and archives an existing tag', async (t) => {
  const { db, save } = makeWorld(t, [{ id: 't1', kind: 'grammar', name: 'Perfeckt' }]);
  let res = await save({ id: 't1', name: 'Perfekt' });
  assert.equal(res.status, 200);
  assert.equal(db.topics[0].name, 'Perfekt');
  res = await save({ id: 't1', archived: true });
  assert.equal(db.topics[0].archived, true);
  res = await save({ id: 'missing', name: 'x' });
  assert.equal(res.status, 404);
});

test('get-topics hides archived tags unless asked', async (t) => {
  const { list } = makeWorld(t, [
    { id: 't1', kind: 'grammar', name: 'Perfekt', archived: false },
    { id: 't2', kind: 'grammar', name: 'Alt', archived: true },
  ]);
  assert.deepEqual(
    (await list()).body.map((x) => x.id),
    ['t1']
  );
  assert.equal((await list('?include_archived=1')).body.length, 2);
});
