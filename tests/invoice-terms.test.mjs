// Run with: node --test tests/
// Covers public/admin/core/invoice-terms.js — which due date a new invoice
// gets and when it counts as overdue in the system. A course starting more
// than 30 days after the invoice date is due at course start, with one week
// of grace before the system flags it; anything closer (or already running)
// is due 30 days after the invoice date.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  paymentTerms,
  defaultDueDate,
  isPastDeadline,
  addDaysIso,
  daysBetween,
  localIsoToday,
  PAYMENT_WINDOW_DAYS,
  FAR_AHEAD_GRACE_DAYS,
} from '../public/admin/core/invoice-terms.js';

const ISSUED = '2026-11-04';

test('the constants encode the agreed rule', () => {
  assert.equal(PAYMENT_WINDOW_DAYS, 30);
  assert.equal(FAR_AHEAD_GRACE_DAYS, 7);
});

test('default due date: course start when more than 30 days out', () => {
  assert.equal(defaultDueDate({ issuedDate: ISSUED, courseStart: '2026-12-17' }), '2026-12-17');
  assert.equal(defaultDueDate({ issuedDate: ISSUED, courseStart: '2027-03-01' }), '2027-03-01');
});

test('default due date: invoice + 30 days when the course is closer or already running', () => {
  assert.equal(defaultDueDate({ issuedDate: ISSUED, courseStart: '2026-11-14' }), '2026-12-04');
  assert.equal(defaultDueDate({ issuedDate: ISSUED, courseStart: '2026-10-01' }), '2026-12-04');
  // Exactly 30 days out is not "more than 30 days": both rules coincide.
  assert.equal(defaultDueDate({ issuedDate: ISSUED, courseStart: '2026-12-04' }), '2026-12-04');
  // No sessions yet → no course start → the 30-day window.
  assert.equal(defaultDueDate({ issuedDate: ISSUED, courseStart: null }), '2026-12-04');
  assert.equal(defaultDueDate({ issuedDate: 'nope', courseStart: '2026-12-17' }), null);
});

test('a course more than 30 days out is overdue one week after it starts', () => {
  const start = addDaysIso(ISSUED, 31); // 2026-12-05
  const terms = paymentTerms({ issuedDate: ISSUED, dueDate: start });
  assert.equal(terms.farAhead, true);
  assert.equal(terms.overdueFrom, '2026-12-12');
});

test('a due date exactly 30 days out is the plain 30-day window', () => {
  const terms = paymentTerms({ issuedDate: ISSUED, dueDate: addDaysIso(ISSUED, 30) });
  assert.equal(terms.farAhead, false);
  assert.equal(terms.overdueFrom, '2026-12-04');
});

test('a due date inside the window is overdue at the end of the 30-day window', () => {
  // E.g. the admin shortened the due date by hand, or an older invoice still
  // carries a near course start as its due date.
  const terms = paymentTerms({ issuedDate: ISSUED, dueDate: addDaysIso(ISSUED, 10) });
  assert.equal(terms.farAhead, false);
  assert.equal(terms.overdueFrom, '2026-12-04');
});

test('a due date before the invoice date (late joiner, old row) gets the window too', () => {
  const terms = paymentTerms({ issuedDate: ISSUED, dueDate: '2026-10-01' });
  assert.equal(terms.farAhead, false);
  assert.equal(terms.overdueFrom, '2026-12-04');
});

test('no due date means no deadline (storno rows)', () => {
  assert.deepEqual(paymentTerms({ issuedDate: ISSUED, dueDate: null }), {
    farAhead: false,
    overdueFrom: null,
  });
  assert.deepEqual(paymentTerms({ issuedDate: ISSUED, dueDate: '' }), {
    farAhead: false,
    overdueFrom: null,
  });
  assert.deepEqual(paymentTerms({}), { farAhead: false, overdueFrom: null });
});

test('a missing invoice date is treated as issued on the due date', () => {
  const terms = paymentTerms({ issuedDate: null, dueDate: '2026-12-01' });
  assert.equal(terms.farAhead, false);
  assert.equal(terms.overdueFrom, '2026-12-31');
});

test('ISO timestamps are accepted and reduced to their calendar day', () => {
  const terms = paymentTerms({
    issuedDate: '2026-11-04T09:15:00Z',
    dueDate: '2027-01-10T18:00:00+01:00',
  });
  assert.equal(terms.farAhead, true);
  assert.equal(terms.overdueFrom, '2027-01-17');
});

test('garbage dates are ignored rather than thrown', () => {
  assert.equal(paymentTerms({ issuedDate: 'soon', dueDate: 'later' }).overdueFrom, null);
  assert.equal(
    paymentTerms({ issuedDate: 'soon', dueDate: '2026-12-01' }).overdueFrom,
    '2026-12-31'
  );
});

test('day arithmetic crosses month, year and DST boundaries without drift', () => {
  assert.equal(addDaysIso('2026-12-20', 30), '2027-01-19');
  assert.equal(addDaysIso('2028-02-28', 1), '2028-02-29'); // leap year
  // Swiss DST switch on 2027-03-28 lies inside this window.
  assert.equal(addDaysIso('2027-03-10', 30), '2027-04-09');
  assert.equal(daysBetween('2027-03-10', '2027-04-09'), 30);
  assert.equal(daysBetween('2027-04-09', '2027-03-10'), -30);
  assert.equal(daysBetween('nope', '2027-03-10'), null);
});

test('an invoice is overdue from the day after its deadline', () => {
  assert.equal(isPastDeadline('2026-12-04', '2026-12-03'), false);
  assert.equal(isPastDeadline('2026-12-04', '2026-12-04'), false);
  assert.equal(isPastDeadline('2026-12-04', '2026-12-05'), true);
  assert.equal(isPastDeadline(null, '2026-12-05'), false);
  assert.equal(isPastDeadline('', '2026-12-05'), false);
});

test('localIsoToday formats the local calendar date', () => {
  assert.equal(localIsoToday(new Date(2026, 0, 5, 23, 30)), '2026-01-05');
  assert.match(localIsoToday(), /^\d{4}-\d{2}-\d{2}$/);
});
