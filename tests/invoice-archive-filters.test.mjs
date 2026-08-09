// Run with: node --test tests/
// Covers matchesInvoiceFilter() in public/admin/features/invoice-archive.js —
// the status/search rule behind the invoice overview. The module is imported
// directly: it touches the DOM only inside functions, never at import time.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchesInvoiceFilter } from '../public/admin/features/invoice-archive.js';

const PAST = '2020-01-01';
const FUTURE = '2999-01-01';

function file(overrides) {
  return {
    name: 'LWG-2026-0001.pdf',
    status: 'sent',
    due_date: FUTURE,
    student_name: 'Anna Meier',
    course_code: 'DE-A1-01',
    course_subject: 'German',
    course_level: 'A1',
    ...overrides,
  };
}

const shown = (f, filter, term = '') => matchesInvoiceFilter(f, filter, term);

test('the default filter hides cancelled originals and their stornos', () => {
  assert.equal(shown(file({ status: 'sent' }), 'active'), true);
  assert.equal(shown(file({ status: 'paid' }), 'active'), true);
  assert.equal(shown(file({ status: 'cancelled' }), 'active'), false);
  assert.equal(shown(file({ status: 'storno' }), 'active'), false);
});

test('an unknown filter key falls back to the default filter', () => {
  assert.equal(shown(file({ status: 'cancelled' }), 'nonsense'), false);
  assert.equal(shown(file({ status: 'sent' }), 'nonsense'), true);
});

test('the cancelled filter shows exactly the rows the default hides', () => {
  assert.equal(shown(file({ status: 'cancelled' }), 'cancelled'), true);
  assert.equal(shown(file({ status: 'storno' }), 'cancelled'), true);
  assert.equal(shown(file({ status: 'sent' }), 'cancelled'), false);
  assert.equal(shown(file({ status: 'paid' }), 'cancelled'), false);
});

test('awaiting payment excludes paid and cancelled invoices', () => {
  assert.equal(shown(file({ status: 'sent' }), 'open'), true);
  assert.equal(shown(file({ status: 'downloaded' }), 'open'), true);
  assert.equal(shown(file({ status: 'paid' }), 'open'), false);
  assert.equal(shown(file({ status: 'cancelled' }), 'open'), false);
});

test('overdue means past due and still owed', () => {
  assert.equal(shown(file({ status: 'sent', due_date: PAST }), 'overdue'), true);
  assert.equal(shown(file({ status: 'sent', due_date: FUTURE }), 'overdue'), false);
  assert.equal(shown(file({ status: 'paid', due_date: PAST }), 'overdue'), false);
  assert.equal(shown(file({ status: 'sent', due_date: null }), 'overdue'), false);
  // A cancelled invoice is never chased, however old its due date.
  assert.equal(shown(file({ status: 'cancelled', due_date: PAST }), 'overdue'), false);
  assert.equal(shown(file({ status: 'storno', due_date: PAST }), 'overdue'), false);
});

test('the all filter shows every row', () => {
  for (const status of ['sent', 'paid', 'cancelled', 'storno', null]) {
    assert.equal(shown(file({ status }), 'all'), true, `status ${status}`);
  }
});

test('search matches invoice number, student and course, case-insensitively', () => {
  const row = file({});
  assert.equal(shown(row, 'active', 'LWG-2026-0001'), true);
  assert.equal(shown(row, 'active', 'anna'), true);
  assert.equal(shown(row, 'active', 'de-a1'), true);
  assert.equal(shown(row, 'active', 'german'), true);
  assert.equal(shown(row, 'active', 'Zimmermann'), false);
  // Whitespace-only input is not a search.
  assert.equal(shown(row, 'active', '   '), true);
});

test('search never overrides the status filter', () => {
  const cancelled = file({ status: 'cancelled' });
  assert.equal(shown(cancelled, 'active', 'anna'), false);
  assert.equal(shown(cancelled, 'cancelled', 'anna'), true);
});

test('rows with missing student or course data still search safely', () => {
  const sparse = file({ student_name: null, course_code: null, course_subject: null });
  assert.equal(shown(sparse, 'active', 'LWG-2026-0001'), true);
  assert.equal(shown(sparse, 'active', 'anna'), false);
});
