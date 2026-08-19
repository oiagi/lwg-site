// Run with: node --test tests/
// Covers buildInvoiceRows() in public/admin/features/invoice-export.js — the
// bookkeeping spreadsheet handed to the accountant. The module is imported
// directly: it touches the DOM only inside functions, never at import time.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
// Imported rather than used as a global: the ESLint config does not declare
// Node globals for this directory.
import process from 'node:process';
import { buildInvoiceRows } from '../public/admin/features/invoice-export.js';

const MODULE_URL = new URL('../public/admin/features/invoice-export.js', import.meta.url).href;

const COL = {
  number: 0,
  status: 1,
  issued: 2,
  due: 3,
  sent: 4,
  reminded: 5,
  cancelled: 6,
  cancels: 7,
  billingName: 8,
  student: 9,
  reference: 10,
  billingEmail: 11,
  courseCode: 12,
  subject: 13,
  level: 14,
  item: 15,
  quantity: 16,
  unitPrice: 17,
  total: 18,
  currency: 19,
  language: 20,
};

function file(overrides) {
  return {
    name: 'LWG-2026-0001.pdf',
    invoice_id: 'id-1',
    status: 'sent',
    issued_date: '2026-03-04',
    due_date: '2026-04-03',
    total_amount: 120,
    currency: 'CHF',
    student_name: 'Anna Meier',
    student: {},
    ...overrides,
  };
}

// The single data row produced for one invoice.
const rowFor = (overrides) => buildInvoiceRows([file(overrides)]).rows[0];

// A Date is only correct if it names the right calendar day locally — that is
// what Excel will show.
function assertDay(cell, y, m, d, label) {
  assert.ok(cell instanceof Date, `${label}: expected a Date, got ${typeof cell}`);
  assert.deepEqual(
    [cell.getFullYear(), cell.getMonth() + 1, cell.getDate()],
    [y, m, d],
    `${label}: wrong calendar day (${cell.toString()})`
  );
}

test('the header names every column in order', () => {
  const { header } = buildInvoiceRows([]);
  assert.equal(header.length, 21);
  assert.equal(header[COL.number], 'invoice number');
  assert.equal(header[COL.cancels], 'cancels invoice');
  assert.equal(header[COL.total], 'total');
  assert.equal(header[COL.language], 'language');
});

test('an empty archive yields a header and no rows, and does not throw', () => {
  assert.deepEqual(buildInvoiceRows([]).rows, []);
  assert.deepEqual(buildInvoiceRows(undefined).rows, []);
  assert.equal(buildInvoiceRows(undefined).header.length, 21);
});

test('every row has one cell per column', () => {
  const { header, rows } = buildInvoiceRows([file(), file({ name: 'LWG-2026-0002.pdf' })]);
  assert.equal(rows.length, 2);
  for (const r of rows) assert.equal(r.length, header.length);
});

test('dates are real Date cells on the right calendar day', () => {
  const row = rowFor({});
  assertDay(row[COL.issued], 2026, 3, 4, 'issued');
  assertDay(row[COL.due], 2026, 4, 3, 'due');
});

test('a timestamp is reduced to the calendar day, not an instant', () => {
  const row = rowFor({ sent_at: '2026-03-05T14:22:31.000Z' });
  assertDay(row[COL.sent], 2026, 3, 5, 'sent');
  assert.equal(row[COL.sent].getHours(), 0);
  assert.equal(row[COL.sent].getMinutes(), 0);
});

test('missing dates are blank cells rather than epoch dates', () => {
  const row = rowFor({ due_date: null, sent_at: null, reminder_sent_at: null });
  assert.equal(row[COL.due], null);
  assert.equal(row[COL.sent], null);
  assert.equal(row[COL.reminded], null);
});

test('an unparseable date does not become an Invalid Date cell', () => {
  const row = rowFor({ issued_date: 'not a date' });
  assert.equal(row[COL.issued], null);
});

test('amounts are numbers, so Excel can sum them', () => {
  const row = rowFor({ total_amount: 960, item_quantity: 8, item_unit_price: 120 });
  assert.equal(row[COL.total], 960);
  assert.equal(row[COL.quantity], 8);
  assert.equal(row[COL.unitPrice], 120);
  assert.equal(typeof row[COL.total], 'number');
});

test('a numeric string from the API still lands as a number', () => {
  // PostgREST serialises numeric columns as strings.
  const row = rowFor({ total_amount: '960.50' });
  assert.equal(row[COL.total], 960.5);
  assert.equal(typeof row[COL.total], 'number');
});

test('missing amounts are blank rather than zero', () => {
  const row = rowFor({ item_quantity: null, item_unit_price: undefined, total_amount: '' });
  assert.equal(row[COL.quantity], null);
  assert.equal(row[COL.unitPrice], null);
  assert.equal(row[COL.total], null);
});

test('a storno keeps its negative total and names the invoice it reverses', () => {
  const original = file({ name: 'LWG-2026-0001.pdf', invoice_id: 'id-1', status: 'cancelled' });
  const storno = file({
    name: 'LWG-2026-0002.pdf',
    invoice_id: 'id-2',
    status: 'storno',
    cancels_invoice_id: 'id-1',
    total_amount: -120,
  });
  const { rows } = buildInvoiceRows([storno, original]);
  assert.equal(rows[0][COL.cancels], ''); // the original reverses nothing
  assert.equal(rows[1][COL.cancels], 'LWG-2026-0001');
  assert.equal(rows[1][COL.total], -120);
});

test('an unresolvable cancels_invoice_id leaves the cell blank', () => {
  assert.equal(rowFor({ cancels_invoice_id: 'gone' })[COL.cancels], '');
});

test('rows come out sorted by invoice number regardless of input order', () => {
  const { rows } = buildInvoiceRows([
    file({ name: 'LWG-2026-0010.pdf', invoice_id: 'c' }),
    file({ name: 'LWG-2026-0002.pdf', invoice_id: 'a' }),
    file({ name: 'LWG-2026-0007.pdf', invoice_id: 'b' }),
  ]);
  assert.deepEqual(
    rows.map((r) => r[COL.number]),
    ['LWG-2026-0002', 'LWG-2026-0007', 'LWG-2026-0010']
  );
});

test('billing name and email fall back to the student record', () => {
  const withBilling = rowFor({
    student: { billing_name: 'Meier AG', billing_email: 'bills@meier.ch', email: 'anna@meier.ch' },
  });
  assert.equal(withBilling[COL.billingName], 'Meier AG');
  assert.equal(withBilling[COL.billingEmail], 'bills@meier.ch');

  const withoutBilling = rowFor({ student: { email: 'anna@meier.ch' } });
  assert.equal(withoutBilling[COL.billingName], 'Anna Meier');
  assert.equal(withoutBilling[COL.billingEmail], 'anna@meier.ch');
});

test('currency falls back to CHF', () => {
  assert.equal(rowFor({ currency: null })[COL.currency], 'CHF');
});

test('a row with no student record at all still exports', () => {
  const row = rowFor({ student: null, student_name: null });
  assert.equal(row[COL.number], 'LWG-2026-0001');
  assert.equal(row[COL.billingName], '');
  assert.equal(row[COL.student], '');
  assert.equal(row[COL.reference], '');
});

// Guards the plain-date parsing: `new Date('2026-03-04')` is UTC midnight, so
// west of Greenwich a naive implementation reports 3 March. Run in a child
// process because the timezone has to be set before the module is loaded.
test('a plain date is not shifted a day by the local timezone', () => {
  const script = `
    import { buildInvoiceRows } from ${JSON.stringify(MODULE_URL)};
    const [row] = buildInvoiceRows([{ name: 'X.pdf', issued_date: '2026-03-04' }]).rows;
    const d = row[2];
    console.log([d.getFullYear(), d.getMonth() + 1, d.getDate()].join('-'));
  `;
  for (const tz of ['Pacific/Honolulu', 'UTC', 'Europe/Zurich', 'Pacific/Kiritimati']) {
    const out = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
      env: { ...process.env, TZ: tz },
      encoding: 'utf8',
    }).trim();
    assert.equal(out, '2026-3-4', `issued date shifted in ${tz}`);
  }
});

// Referenced so the fileURLToPath import stays honest if MODULE_URL is reworked.
test('the module under test resolves to a real file path', () => {
  assert.ok(fileURLToPath(MODULE_URL).endsWith('invoice-export.js'));
});
