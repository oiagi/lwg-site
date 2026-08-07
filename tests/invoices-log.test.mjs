// Run with: node --test tests/
// Covers logInvoice()'s tolerant retry behaviour in functions/api/_invoices.js
// by stubbing global fetch — no network involved.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { logInvoice } from '../functions/api/_invoices.js';

const ENV = { SUPABASE_URL: 'https://db.example', SUPABASE_SERVICE_KEY: 'key' };
const BODY = {
  student_id: 'stu-1',
  course_id: 'crs-1',
  language: 'de',
  invoice: {
    invoice_number: 'LWG-2026-0046',
    subject: 'Deutsch · A1.1',
    quantity: 1,
    unit_price: 31.25,
    total_amount: -31.25,
    currency: 'CHF',
    invoice_date: '2026-08-07',
  },
};

const realFetch = globalThis.fetch;
let calls;

function stubFetch(responders) {
  let i = 0;
  globalThis.fetch = async (url, init) => {
    const payload = JSON.parse(init.body);
    calls.push(payload);
    const respond = responders[Math.min(i, responders.length - 1)];
    i += 1;
    return respond(payload);
  };
}

const okResponse = (payload) => ({
  ok: true,
  json: async () => [{ id: 'new-row', ...payload }],
});
const errResponse = (message) => ({ ok: false, text: async () => message });

beforeEach(() => {
  calls = [];
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

test('inserts line items and extra fields on the first try', async () => {
  stubFetch([okResponse]);
  const record = await logInvoice(ENV, BODY, ['storno'], { cancels_invoice_id: 'orig-1' });
  assert.equal(record.id, 'new-row');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].status, 'storno');
  assert.equal(calls[0].item_subject, 'Deutsch · A1.1');
  assert.equal(calls[0].item_quantity, 1);
  assert.equal(calls[0].item_unit_price, 31.25);
  assert.equal(calls[0].cancels_invoice_id, 'orig-1');
  assert.equal(calls[0].due_date, null);
});

test('falls back to issued_date when due_date is still NOT NULL', async () => {
  stubFetch([
    () =>
      errResponse(
        '{"code":"23502","message":"null value in column \\"due_date\\" of relation \\"invoices\\" violates not-null constraint"}'
      ),
    okResponse,
  ]);
  const record = await logInvoice(ENV, BODY, ['storno']);
  assert.equal(record.id, 'new-row');
  assert.equal(calls.length, 2);
  assert.equal(calls[0].due_date, null);
  assert.equal(calls[1].due_date, '2026-08-07'); // = issued_date
});

test('strips optional columns the database does not have yet', async () => {
  stubFetch([
    () => errResponse("Could not find the 'item_subject' column of 'invoices'"),
    () => errResponse("Could not find the 'invoice_language' column of 'invoices'"),
    okResponse,
  ]);
  const record = await logInvoice(ENV, BODY, ['pending']);
  assert.equal(record.id, 'new-row');
  assert.equal(calls.length, 3);
  assert.ok('item_subject' in calls[0]);
  assert.ok(!('item_subject' in calls[1]));
  assert.ok('invoice_language' in calls[1]);
  assert.ok(!('invoice_language' in calls[2]));
  assert.ok(!('item_subject' in calls[2]));
});

test('walks the status candidates when the check constraint refuses', async () => {
  stubFetch([
    () => errResponse('violates check constraint "invoices_status_check"'),
    () => errResponse('violates check constraint "invoices_status_check"'),
    okResponse,
  ]);
  const record = await logInvoice(ENV, BODY, ['downloaded', 'pending', 'open']);
  assert.equal(record.id, 'new-row');
  assert.deepEqual(
    calls.map((c) => c.status),
    ['downloaded', 'pending', 'open']
  );
});

test('throws with the raw DB error attached when unrecoverable', async () => {
  stubFetch([() => errResponse('violates check constraint "invoices_status_check"')]);
  await assert.rejects(
    () => logInvoice(ENV, BODY, ['storno']),
    (err) => {
      assert.equal(err.userMessage, 'Invoice could not be recorded.');
      assert.equal(err.statusCode, 400);
      assert.ok(err.dbError.includes('invoices_status_check'));
      return true;
    }
  );
});
