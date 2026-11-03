// Run with: node --test tests/
// Covers the planned-absence helpers in functions/api/_absences.js: how the
// calendar's date ranges are validated and merged, and how a session is
// matched against them in Europe/Zurich.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_ABSENCE_RANGES,
  absenceWindow,
  formatRanges,
  isIsoDate,
  mergeRanges,
  normaliseRanges,
  plannedAbsentees,
  rangeDays,
  sessionDate,
} from '../functions/api/_absences.js';

const TODAY = '2026-10-23';
const opts = { today: TODAY };

test('isIsoDate accepts real dates only', () => {
  assert.ok(isIsoDate('2026-02-28'));
  assert.ok(!isIsoDate('2026-02-30'));
  assert.ok(!isIsoDate('2026-2-3'));
  assert.ok(!isIsoDate('03.11.2026'));
  assert.ok(!isIsoDate(20261103));
});

test('the window reaches a month back and two years ahead', () => {
  assert.deepEqual(absenceWindow(TODAY), { from: '2026-09-22', to: '2028-10-22' });
  assert.equal(rangeDays('2026-11-03', '2026-11-03'), 1);
  assert.equal(rangeDays('2026-11-03', '2026-11-10'), 8);
});

test('ranges are sorted and merged when they overlap or touch', () => {
  assert.deepEqual(
    mergeRanges([
      { from: '2026-12-24', to: '2026-12-26' },
      { from: '2026-11-03', to: '2026-11-10' },
      { from: '2026-11-11', to: '2026-11-12' }, // touches the one before
      { from: '2026-11-05', to: '2026-11-06' }, // inside it
      { from: '2026-12-27', to: '2026-12-27' },
    ]),
    [
      { from: '2026-11-03', to: '2026-11-12' },
      { from: '2026-12-24', to: '2026-12-27' },
    ]
  );
});

test('normaliseRanges: nothing marked is null, single days and reversed pairs are fine', () => {
  assert.deepEqual(normaliseRanges(undefined, opts), { value: null });
  assert.deepEqual(normaliseRanges(null, opts), { value: null });
  assert.deepEqual(normaliseRanges([], opts), { value: null });
  assert.deepEqual(normaliseRanges([{ from: '2026-11-03' }], opts), {
    value: [{ from: '2026-11-03', to: '2026-11-03' }],
  });
  assert.deepEqual(normaliseRanges([{ from: '2026-11-10', to: '2026-11-03' }], opts), {
    value: [{ from: '2026-11-03', to: '2026-11-10' }],
  });
});

test('normaliseRanges rejects what the calendar never sends', () => {
  assert.match(normaliseRanges('3 and 10 March', opts).error, /list of date ranges/);
  assert.match(normaliseRanges(['2026-11-03'], opts).error, /object with from and to/);
  assert.match(normaliseRanges([{ from: '03.11.2026' }], opts).error, /YYYY-MM-DD/);
  assert.match(normaliseRanges([{ from: '2026-02-30' }], opts).error, /YYYY-MM-DD/);
  assert.match(normaliseRanges([{ from: '2026-08-01' }], opts).error, /between/);
  assert.match(normaliseRanges([{ from: '2029-01-01' }], opts).error, /between/);
  assert.match(
    normaliseRanges([{ from: '2026-11-01', to: '2027-11-02' }], opts).error,
    /at most 366 days/
  );
  const many = Array.from({ length: MAX_ABSENCE_RANGES + 1 }, (_, i) => ({
    from: `2027-01-${String(1 + i * 2).padStart(2, '0')}`.slice(0, 10),
  }));
  // 31 single days two days apart never touch, so none merge.
  const spread = many.map((_, i) => {
    const d = new Date(Date.UTC(2027, 0, 1 + i * 2));
    return { from: d.toISOString().slice(0, 10) };
  });
  assert.match(normaliseRanges(spread, opts).error, /at most 30 ranges/);
});

test('sessionDate is the Zurich calendar day, not the UTC one', () => {
  // 23:30 UTC in summer is 01:30 the next day in Zurich (UTC+2)…
  assert.equal(sessionDate({ scheduled_at: '2026-07-01T23:30:00Z' }), '2026-07-02');
  // …and in winter too (UTC+1).
  assert.equal(sessionDate({ scheduled_at: '2026-12-01T23:30:00Z' }), '2026-12-02');
  assert.equal(sessionDate({ scheduled_at: '2026-12-01T17:00:00Z' }), '2026-12-01');
  assert.equal(sessionDate({ scheduled_at: null }), null);
  assert.equal(sessionDate({ scheduled_at: 'nonsense' }), null);
});

test('plannedAbsentees matches periods inclusively and dedupes students', () => {
  const periods = [
    { student_id: 'b', start_date: '2026-11-03', end_date: '2026-11-10' },
    { student_id: 'a', start_date: '2026-11-10', end_date: '2026-11-10' },
    { student_id: 'a', start_date: '2026-11-09', end_date: '2026-11-12' },
    { student_id: 'c', start_date: '2026-11-11', end_date: '2026-11-11' },
  ];
  // 18:00 Zurich on 10 November.
  assert.deepEqual(plannedAbsentees({ scheduled_at: '2026-11-10T17:00:00Z' }, periods), ['a', 'b']);
  assert.deepEqual(plannedAbsentees({ scheduled_at: '2026-11-11T17:00:00Z' }, periods), ['a', 'c']);
  assert.deepEqual(plannedAbsentees({ scheduled_at: '2026-11-02T17:00:00Z' }, periods), []);
  assert.deepEqual(plannedAbsentees({ scheduled_at: null }, periods), []);
  assert.deepEqual(plannedAbsentees({ scheduled_at: '2026-11-10T17:00:00Z' }, undefined), []);
});

test('formatRanges reads both the stored shape and table rows', () => {
  assert.equal(
    formatRanges([
      { from: '2026-11-03', to: '2026-11-10' },
      { from: '2026-12-24', to: '2026-12-24' },
    ]),
    '03.11.2026 – 10.11.2026, 24.12.2026'
  );
  assert.equal(
    formatRanges([{ start_date: '2027-01-05', end_date: '2027-01-06' }]),
    '05.01.2027 – 06.01.2027'
  );
  assert.equal(formatRanges([]), '');
  assert.equal(formatRanges(null), '');
});
