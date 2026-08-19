// Run with: node --test tests/
// Covers buildInvoiceCsv() in public/admin/features/invoice-export.js — the
// bookkeeping export handed to the accountant. The module is imported
// directly: it touches the DOM only inside functions, never at import time.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildInvoiceCsv } from '../public/admin/features/invoice-export.js';

const BOM = '\uFEFF';
const HEADER =
  'invoice_number;status;issued_date;due_date;sent_at;reminder_sent_at;cancelled_at;' +
  'cancels_invoice;billing_name;student_name;customer_reference;billing_email;' +
  'course_code;course_subject;course_level;item_subject;item_quantity;item_unit_price;' +
  'total_amount;currency;language';

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

// Splits the CSV into its rows, dropping the BOM and the trailing newline.
function rows(csv) {
  return csv
    .replace(/^\uFEFF/, '')
    .replace(/\r\n$/, '')
    .split('\r\n');
}

const cells = (row) => row.split(';');

test('output starts with a BOM and the documented header row', () => {
  const csv = buildInvoiceCsv([file()]);
  assert.ok(csv.startsWith(BOM), 'missing UTF-8 BOM');
  assert.equal(rows(csv)[0], HEADER);
});

test('an empty archive yields just the header and does not throw', () => {
  assert.deepEqual(rows(buildInvoiceCsv([])), [HEADER]);
  assert.deepEqual(rows(buildInvoiceCsv(undefined)), [HEADER]);
});

test('rows are separated by CRLF and the file ends with one', () => {
  const csv = buildInvoiceCsv([file()]);
  assert.ok(csv.endsWith('\r\n'));
  assert.equal(csv.split('\r\n').length, 3); // header, one row, trailing empty
});

test('dates render as DD.MM.YYYY and null dates stay empty', () => {
  const [, row] = rows(buildInvoiceCsv([file({ due_date: null, sent_at: null })]));
  const c = cells(row);
  assert.equal(c[2], '04.03.2026'); // issued_date
  assert.equal(c[3], ''); // due_date
  assert.equal(c[4], ''); // sent_at
});

test('a timestamp column is reduced to its date, not a date-time', () => {
  const [, row] = rows(buildInvoiceCsv([file({ sent_at: '2026-03-05T14:22:31.000Z' })]));
  assert.equal(cells(row)[4], '05.03.2026');
});

test('amounts get two decimals and null amounts stay empty', () => {
  const [, row] = rows(
    buildInvoiceCsv([file({ total_amount: 120, item_quantity: 8, item_unit_price: null })])
  );
  const c = cells(row);
  assert.equal(c[16], '8.00'); // item_quantity
  assert.equal(c[17], ''); // item_unit_price
  assert.equal(c[18], '120.00'); // total_amount
});

test('currency falls back to CHF', () => {
  const [, row] = rows(buildInvoiceCsv([file({ currency: null })]));
  assert.equal(cells(row)[19], 'CHF');
});

test('a field containing the separator or a quote is quoted and escaped', () => {
  const csv = buildInvoiceCsv([
    file({ student: { billing_name: 'Meier; Anna' }, item_subject: 'German "A1" course' }),
  ]);
  const row = rows(csv)[1];
  assert.ok(row.includes('"Meier; Anna"'), row);
  assert.ok(row.includes('"German ""A1"" course"'), row);
});

test('a storno row names the invoice it reverses', () => {
  const original = file({ name: 'LWG-2026-0001.pdf', invoice_id: 'id-1', status: 'cancelled' });
  const storno = file({
    name: 'LWG-2026-0002.pdf',
    invoice_id: 'id-2',
    status: 'storno',
    cancels_invoice_id: 'id-1',
    total_amount: -120,
  });
  const [, first, second] = rows(buildInvoiceCsv([storno, original]));
  assert.equal(cells(first)[7], ''); // the original reverses nothing
  assert.equal(cells(second)[7], 'LWG-2026-0001');
  assert.equal(cells(second)[18], '-120.00');
});

test('an unresolvable cancels_invoice_id leaves the column empty', () => {
  const [, row] = rows(buildInvoiceCsv([file({ cancels_invoice_id: 'gone' })]));
  assert.equal(cells(row)[7], '');
});

test('rows come out sorted by invoice number regardless of input order', () => {
  const csv = buildInvoiceCsv([
    file({ name: 'LWG-2026-0010.pdf', invoice_id: 'c' }),
    file({ name: 'LWG-2026-0002.pdf', invoice_id: 'a' }),
    file({ name: 'LWG-2026-0007.pdf', invoice_id: 'b' }),
  ]);
  assert.deepEqual(
    rows(csv)
      .slice(1)
      .map((r) => cells(r)[0]),
    ['LWG-2026-0002', 'LWG-2026-0007', 'LWG-2026-0010']
  );
});

test('billing name and email fall back to the student record', () => {
  const withBilling = file({
    student: { billing_name: 'Meier AG', billing_email: 'bills@meier.ch', email: 'anna@meier.ch' },
  });
  const withoutBilling = file({ student: { email: 'anna@meier.ch' } });
  assert.equal(cells(rows(buildInvoiceCsv([withBilling]))[1])[8], 'Meier AG');
  assert.equal(cells(rows(buildInvoiceCsv([withBilling]))[1])[11], 'bills@meier.ch');
  assert.equal(cells(rows(buildInvoiceCsv([withoutBilling]))[1])[8], 'Anna Meier');
  assert.equal(cells(rows(buildInvoiceCsv([withoutBilling]))[1])[11], 'anna@meier.ch');
});

test('a row with no student record at all still exports', () => {
  const [, row] = rows(buildInvoiceCsv([file({ student: null, student_name: null })]));
  const c = cells(row);
  assert.equal(c[0], 'LWG-2026-0001');
  assert.equal(c[8], '');
  assert.equal(c[9], '');
});
