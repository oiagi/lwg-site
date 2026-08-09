// Run with: node --test tests/
// Covers groupCourseInvoices() in functions/api/_invoices.js — the bucketing
// behind the course overview's open / paid / cancelled invoice lists.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupCourseInvoices } from '../functions/api/_invoices.js';

const COURSE = 'crs-1';
const STUDENT = 'stu-1';

function invoice(overrides) {
  return {
    id: 'inv-1',
    invoice_number: 'LWG-2026-0001',
    total_amount: 500,
    currency: 'CHF',
    status: 'sent',
    issued_date: '2026-08-01',
    sent_at: '2026-08-01T10:00:00Z',
    student_id: STUDENT,
    course_id: COURSE,
    ...overrides,
  };
}

const at = (result, bucket) => result[bucket][COURSE]?.[STUDENT];

test('open invoices land in the open bucket', () => {
  const result = groupCourseInvoices([invoice({ status: 'downloaded', sent_at: null })]);
  assert.equal(at(result, 'open').length, 1);
  assert.equal(at(result, 'paid'), undefined);
  assert.equal(at(result, 'cancelled'), undefined);
});

test('sent and paid invoices stamp the latest sent date', () => {
  const result = groupCourseInvoices([
    invoice({ id: 'a', invoice_number: 'LWG-2026-0001', sent_at: '2026-08-01T10:00:00Z' }),
    invoice({
      id: 'b',
      invoice_number: 'LWG-2026-0002',
      status: 'paid',
      sent_at: '2026-08-05T10:00:00Z',
    }),
  ]);
  assert.equal(at(result, 'sentAt'), '2026-08-05T10:00:00Z');
  assert.equal(at(result, 'paid').length, 1);
});

test('a storno is folded into the original it cancels', () => {
  const original = invoice({
    id: 'orig',
    status: 'cancelled',
    cancelled_at: '2026-08-06T09:00:00Z',
  });
  const storno = invoice({
    id: 'strn',
    invoice_number: 'LWG-2026-0002',
    status: 'storno',
    total_amount: -500,
    issued_date: '2026-08-06',
    cancels_invoice_id: 'orig',
  });

  const result = groupCourseInvoices([original, storno]);

  // One cancelled line, not two rows with opposite amounts.
  const cancelled = at(result, 'cancelled');
  assert.equal(cancelled.length, 1);
  assert.equal(cancelled[0].invoice_number, 'LWG-2026-0001');
  assert.equal(cancelled[0].storno_invoice_number, 'LWG-2026-0002');
  assert.equal(cancelled[0].storno_total_amount, -500);
  assert.equal(cancelled[0].storno_issued_date, '2026-08-06');

  assert.equal(at(result, 'open'), undefined);
  assert.equal(at(result, 'cancelledAt'), '2026-08-06T09:00:00Z');
  // A cancelled invoice no longer counts as sent.
  assert.equal(at(result, 'sentAt'), undefined);
});

test('a cancelled paid invoice leaves the paid bucket', () => {
  const result = groupCourseInvoices([
    invoice({ id: 'orig', status: 'cancelled' }),
    invoice({
      id: 'strn',
      invoice_number: 'LWG-2026-0002',
      status: 'storno',
      total_amount: -500,
      cancels_invoice_id: 'orig',
    }),
  ]);
  assert.equal(at(result, 'paid'), undefined);
  assert.equal(at(result, 'cancelled').length, 1);
});

test('an original whose status update failed still counts as cancelled', () => {
  // cancel-invoice.js reports that partial failure, but the overview must not
  // keep offering a voided invoice as open.
  const result = groupCourseInvoices([
    invoice({ id: 'orig', status: 'sent' }),
    invoice({
      id: 'strn',
      invoice_number: 'LWG-2026-0002',
      status: 'storno',
      total_amount: -500,
      issued_date: '2026-08-06',
      cancels_invoice_id: 'orig',
    }),
  ]);
  assert.equal(at(result, 'open'), undefined);
  assert.equal(at(result, 'cancelled').length, 1);
  // No cancelled_at column value to use, so the storno's issue date stands in.
  assert.equal(at(result, 'cancelledAt'), '2026-08-06');
});

test('stornos stay hidden when cancels_invoice_id is not available yet', () => {
  // Databases without add_invoice_cancellation.sql return no link column; the
  // original still shows as cancelled, just without a storno reference.
  const result = groupCourseInvoices([
    invoice({ id: 'orig', status: 'cancelled' }),
    invoice({ id: 'strn', invoice_number: 'LWG-2026-0002', status: 'storno', total_amount: -500 }),
  ]);
  const cancelled = at(result, 'cancelled');
  assert.equal(cancelled.length, 1);
  assert.equal(cancelled[0].storno_invoice_number, null);
});

test('pre-archive sent invoices are skipped', () => {
  const result = groupCourseInvoices([invoice({ status: 'sent', sent_at: null })]);
  assert.equal(at(result, 'open'), undefined);
  // They still count towards the communications summary.
  assert.equal(at(result, 'sentAt'), '2026-08-01');
});

test('invoices are bucketed per course and per student', () => {
  const result = groupCourseInvoices([
    invoice({ id: 'a', status: 'paid' }),
    invoice({ id: 'b', invoice_number: 'LWG-2026-0002', student_id: 'stu-2' }),
    invoice({ id: 'c', invoice_number: 'LWG-2026-0003', course_id: 'crs-2' }),
  ]);
  assert.equal(result.paid[COURSE][STUDENT].length, 1);
  assert.equal(result.open[COURSE]['stu-2'].length, 1);
  assert.equal(result.open['crs-2'][STUDENT].length, 1);
});
