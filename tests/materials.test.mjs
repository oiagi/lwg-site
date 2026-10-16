// Run with: node --test tests/
// Tests for the PDF material library endpoints and their Storage calls.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost as createUpload } from '../functions/api/create-material-upload.js';
import { onRequestPost as saveMaterial } from '../functions/api/save-material.js';
import { onRequestGet as getMaterials } from '../functions/api/get-materials.js';
import { onRequestGet as getMaterialFile } from '../functions/api/get-material-file.js';
import { onRequestPost as deleteMaterial } from '../functions/api/delete-material.js';
import { onRequestPost as removeSessionMaterial } from '../functions/api/remove-session-material.js';
import { sanitiseFileName, isMaterialPath } from '../functions/api/_materials.js';

const ENV = {
  SUPABASE_URL: 'https://supabase.test',
  SUPABASE_SERVICE_KEY: 'service-key',
  SUPABASE_ANON_KEY: 'anon-key',
};
const UUID = '0b6f1c1e-1234-4abc-8def-0123456789ab';
const PATH = `${UUID}/Menschen A2.pdf`;

function makeWorld(t, { materials = [], sessionMaterials = [], storageDeleteStatus = 200 } = {}) {
  const db = { materials: [...materials], session_materials: [...sessionMaterials] };
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
    if (u.includes('/storage/v1/object/upload/sign/')) {
      const path = u.split('/upload/sign/')[1];
      return json({ url: `/object/upload/sign/${path}?token=up`, token: 'up' });
    }
    if (u.includes('/storage/v1/object/sign/')) {
      const path = u.split('/object/sign/')[1];
      return json({ signedURL: `/object/sign/${path}?token=dl` });
    }
    if (u.includes('/storage/v1/object/') && method === 'DELETE') {
      return json({}, storageDeleteStatus);
    }

    const rest = u.match(/\/rest\/v1\/(\w+)(?:\?(.*))?$/);
    if (!rest) throw new Error(`unexpected fetch: ${method} ${u}`);
    const [, table, query = ''] = rest;
    const eq = (field) => {
      const m = query.match(new RegExp(`(?:^|&)${field}=eq\\.([^&]+)`));
      return m ? decodeURIComponent(m[1]) : null;
    };

    if (table === 'materials') {
      if (method === 'GET') {
        let rows = db.materials;
        if (eq('id')) rows = rows.filter((r) => r.id === eq('id'));
        if (query.includes('archived=eq.false')) rows = rows.filter((r) => !r.archived);
        if (query.includes('session_materials(count)')) {
          rows = rows.map((r) => ({
            ...r,
            session_materials: [
              { count: db.session_materials.filter((s) => s.material_id === r.id).length },
            ],
          }));
        }
        return json(rows);
      }
      if (method === 'POST') {
        const row = { id: `mat-${db.materials.length + 1}`, archived: false, ...body };
        db.materials.push(row);
        return json([row], 201);
      }
      if (method === 'PATCH') {
        const row = db.materials.find((r) => r.id === eq('id'));
        if (row) Object.assign(row, body);
        return json(row ? [row] : []);
      }
      if (method === 'DELETE') {
        db.materials = db.materials.filter((r) => r.id !== eq('id'));
        return new Response(null, { status: 204 });
      }
    }
    if (table === 'session_materials' && method === 'GET') {
      return json(db.session_materials.filter((s) => s.material_id === eq('material_id')));
    }
    throw new Error(`unexpected fetch: ${method} ${u}`);
  };

  const call = async (handler, path, { method = 'POST', body, token = 'good' } = {}) => {
    const request = new Request(`https://learningwithgioia.ch/api/${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const res = await handler({ request, env: ENV });
    return { status: res.status, body: await res.json() };
  };

  return { db, calls, call };
}

// ── Helpers ──────────────────────────────────────────────────────────────

test('sanitiseFileName keeps readable PDF names and rejects everything else', () => {
  assert.equal(sanitiseFileName('Menschen A2.pdf'), 'Menschen A2.pdf');
  assert.equal(sanitiseFileName('Übungen für Schüler.PDF'), 'Ubungen fur Schuler.pdf');
  assert.equal(sanitiseFileName('../../etc/passwd.pdf'), '.._.._etc_passwd.pdf');
  assert.equal(sanitiseFileName('a/b?c#d.pdf'), 'a_b_c_d.pdf');
  assert.equal(sanitiseFileName('notes.docx'), null);
  assert.equal(sanitiseFileName(''), null);
});

test('isMaterialPath only accepts <uuid>/<name>.pdf', () => {
  assert.equal(isMaterialPath(PATH), true);
  assert.equal(isMaterialPath('Menschen.pdf'), false);
  assert.equal(isMaterialPath(`${UUID}/../x.pdf`), false);
  assert.equal(isMaterialPath(`${UUID}/x.exe`), false);
  assert.equal(isMaterialPath(`contracts/${UUID}/x.pdf`), false);
});

// ── create-material-upload ───────────────────────────────────────────────

test('upload URLs require admin auth', async (t) => {
  const { calls, call } = makeWorld(t);
  const res = await call(createUpload, 'create-material-upload', {
    body: { file_name: 'a.pdf', size_bytes: 10 },
    token: 'bad',
  });
  assert.equal(res.status, 401);
  assert.equal(calls.filter((c) => c.url.includes('/storage/')).length, 0);
});

test('non-PDF, empty and oversized files are refused', async (t) => {
  const { calls, call } = makeWorld(t);
  for (const body of [
    { file_name: 'book.epub', size_bytes: 10 },
    { file_name: 'book.pdf', size_bytes: 0 },
    { file_name: 'book.pdf', size_bytes: 50 * 1024 * 1024 + 1 },
    { file_name: 'book.pdf' },
  ]) {
    const res = await call(createUpload, 'create-material-upload', { body });
    assert.equal(res.status, 400, JSON.stringify(body));
  }
  assert.equal(calls.filter((c) => c.url.includes('/storage/')).length, 0);
});

test('a signed upload URL is issued for a sanitised path in the materials bucket', async (t) => {
  const { calls, call } = makeWorld(t);
  const res = await call(createUpload, 'create-material-upload', {
    body: { file_name: 'Übungen/Kapitel 3.pdf', size_bytes: 12_000_000 },
  });
  assert.equal(res.status, 200);
  assert.match(res.body.file_path, /^[0-9a-f-]{36}\/Ubungen_Kapitel 3\.pdf$/);
  assert.equal(isMaterialPath(res.body.file_path), true);

  const sign = calls.find((c) => c.url.includes('/storage/'));
  assert.equal(sign.method, 'POST');
  // Storage answers 400 to a JSON content-type with an empty body.
  assert.deepEqual(sign.body, {});
  assert.match(
    sign.url,
    /\/storage\/v1\/object\/upload\/sign\/materials\/[0-9a-f-]{36}\/Ubungen_Kapitel%203\.pdf$/
  );
  assert.match(
    res.body.upload_url,
    /^https:\/\/supabase\.test\/storage\/v1\/object\/upload\/sign\/materials\/.+\?token=up$/
  );
  assert.equal(JSON.stringify(res.body).includes('service-key'), false, 'service key never leaves');
});

// ── save-material ────────────────────────────────────────────────────────

test('save-material registers an upload and edits it later', async (t) => {
  const { db, call } = makeWorld(t);
  let res = await call(saveMaterial, 'save-material', {
    body: { title: ' Menschen A2 ', file_path: PATH, file_name: 'Menschen A2.pdf', size_bytes: 5 },
  });
  assert.equal(res.status, 200);
  assert.equal(db.materials[0].title, 'Menschen A2');
  assert.equal(db.materials[0].content_type, 'application/pdf');

  res = await call(saveMaterial, 'save-material', {
    body: { id: res.body.id, description: 'Kursbuch', archived: true },
  });
  assert.equal(res.status, 200);
  assert.equal(db.materials[0].description, 'Kursbuch');
  assert.equal(db.materials[0].archived, true);
  assert.equal(db.materials[0].file_path, PATH, 'the file never changes');
});

test('save-material refuses paths outside the <uuid>/<name>.pdf scheme', async (t) => {
  const { db, call } = makeWorld(t);
  for (const file_path of ['contracts/x/signed.pdf', `${UUID}/x.exe`, undefined]) {
    const res = await call(saveMaterial, 'save-material', {
      body: { title: 'x', file_path, file_name: 'x.pdf' },
    });
    assert.equal(res.status, 400);
  }
  const res = await call(saveMaterial, 'save-material', {
    body: { file_path: PATH, file_name: 'x.pdf' },
  });
  assert.equal(res.status, 400, 'title is required');
  assert.equal(db.materials.length, 0);
});

// ── get-materials / get-material-file ───────────────────────────────────

test('get-materials reports how often each material is used', async (t) => {
  const { call } = makeWorld(t, {
    materials: [
      { id: 'm1', title: 'A', archived: false },
      { id: 'm2', title: 'B', archived: true },
    ],
    sessionMaterials: [
      { material_id: 'm1', session_id: 's1' },
      { material_id: 'm1', session_id: 's2' },
    ],
  });
  let res = await call(getMaterials, 'get-materials', { method: 'GET' });
  assert.deepEqual(
    res.body.map((m) => [m.id, m.usage_count, 'session_materials' in m]),
    [['m1', 2, false]]
  );
  res = await call(getMaterials, 'get-materials?include_archived=1', { method: 'GET' });
  assert.equal(res.body.length, 2);
});

test('get-material-file returns a signed download URL', async (t) => {
  const { calls, call } = makeWorld(t, {
    materials: [{ id: 'm1', file_path: PATH, file_name: 'Menschen A2.pdf' }],
  });
  const res = await call(getMaterialFile, 'get-material-file?id=m1', { method: 'GET' });
  assert.equal(res.status, 200);
  assert.equal(
    res.body.url,
    `https://supabase.test/storage/v1/object/sign/materials/${UUID}/Menschen%20A2.pdf?token=dl`
  );
  const sign = calls.find((c) => c.url.includes('/object/sign/'));
  assert.equal(sign.body.expiresIn, 3600);

  const missing = await call(getMaterialFile, 'get-material-file?id=nope', { method: 'GET' });
  assert.equal(missing.status, 404);
});

// ── delete-material ──────────────────────────────────────────────────────

test('a material referenced by a lesson cannot be deleted', async (t) => {
  const { db, calls, call } = makeWorld(t, {
    materials: [{ id: 'm1', file_path: PATH }],
    sessionMaterials: [{ material_id: 'm1', session_id: 's1' }],
  });
  const res = await call(deleteMaterial, 'delete-material', { body: { id: 'm1' } });
  assert.equal(res.status, 409);
  assert.equal(db.materials.length, 1);
  assert.equal(calls.filter((c) => c.method === 'DELETE').length, 0);
});

test('an unused material is deleted from Storage first, then from the table', async (t) => {
  const { db, calls, call } = makeWorld(t, { materials: [{ id: 'm1', file_path: PATH }] });
  const res = await call(deleteMaterial, 'delete-material', { body: { id: 'm1' } });
  assert.equal(res.status, 200);
  assert.equal(db.materials.length, 0);
  const deletes = calls.filter((c) => c.method === 'DELETE').map((c) => c.url);
  assert.deepEqual(deletes, [
    `https://supabase.test/storage/v1/object/materials/${UUID}/Menschen%20A2.pdf`,
    'https://supabase.test/rest/v1/materials?id=eq.m1',
  ]);
});

test('a Storage failure keeps the row so nothing points at a lost file', async (t) => {
  const { db, call } = makeWorld(t, {
    materials: [{ id: 'm1', file_path: PATH }],
    storageDeleteStatus: 500,
  });
  const res = await call(deleteMaterial, 'delete-material', { body: { id: 'm1' } });
  assert.equal(res.status, 502);
  assert.equal(db.materials.length, 1);
});

// ── remove-session-material ──────────────────────────────────────────────

test('remove-session-material deletes only the one reference row', async (t) => {
  const calls = [];
  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  let rows = [{ id: 'sm1' }];
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    calls.push({ url: u, method: opts.method || 'GET' });
    if (u.includes('/auth/v1/user')) {
      const ok = opts.headers.Authorization === 'Bearer good';
      return new Response(JSON.stringify(ok ? { id: 'admin' } : {}), { status: ok ? 200 : 401 });
    }
    const id = u.match(/id=eq\.([^&]+)/)?.[1];
    const deleted = rows.filter((r) => r.id === id);
    rows = rows.filter((r) => r.id !== id);
    return new Response(JSON.stringify(deleted), { status: 200 });
  };
  const call = async (body, token = 'good') => {
    const request = new Request('https://learningwithgioia.ch/api/remove-session-material', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const res = await removeSessionMaterial({ request, env: ENV });
    return res.status;
  };

  assert.equal(await call({ id: 'sm1' }, 'bad'), 401);
  assert.equal(await call({}), 400);
  assert.equal(await call({ id: 'sm1' }), 200);
  assert.equal(await call({ id: 'sm1' }), 404, 'already gone');
  const deletes = calls.filter((c) => c.method === 'DELETE').map((c) => c.url);
  assert.deepEqual(deletes, [
    'https://supabase.test/rest/v1/session_materials?id=eq.sm1',
    'https://supabase.test/rest/v1/session_materials?id=eq.sm1',
  ]);
});
