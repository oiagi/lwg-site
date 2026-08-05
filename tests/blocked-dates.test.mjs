// Run with: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isDateBlocked,
  zurichParts,
  addDays,
  exdateLine,
  planWeeklySchedule,
  extendSeries,
} from '../functions/api/_blocked-dates.js';

const periods = [
  { start_date: '2026-04-06', end_date: '2026-04-19' }, // two-week break
  { start_date: '2026-08-01', end_date: '2026-08-01' }, // single day
];

test('isDateBlocked matches inclusive range boundaries', () => {
  assert.equal(isDateBlocked('2026-04-06', periods), true);
  assert.equal(isDateBlocked('2026-04-19', periods), true);
  assert.equal(isDateBlocked('2026-04-05', periods), false);
  assert.equal(isDateBlocked('2026-04-20', periods), false);
  assert.equal(isDateBlocked('2026-08-01', periods), true);
  assert.equal(isDateBlocked('2026-08-01', []), false);
});

test('addDays handles month and year rollover', () => {
  assert.equal(addDays('2026-01-31', 1), '2026-02-01');
  assert.equal(addDays('2026-12-29', 7), '2027-01-05');
  assert.equal(addDays('2024-02-28', 1), '2024-02-29'); // leap year
  assert.equal(addDays('2026-03-10', 0), '2026-03-10');
});

test('zurichParts converts UTC instants to Zurich wall-clock', () => {
  // 2026-01-15T10:00Z is 11:00 in Zurich (CET, +1)
  assert.deepEqual(zurichParts('2026-01-15T10:00:00Z'), {
    date: '2026-01-15',
    time: '11:00:00',
  });
  // 2026-07-15T10:00Z is 12:00 in Zurich (CEST, +2)
  assert.deepEqual(zurichParts('2026-07-15T10:00:00Z'), {
    date: '2026-07-15',
    time: '12:00:00',
  });
  // Midnight rollover: 23:30Z in winter is 00:30 next day in Zurich
  assert.deepEqual(zurichParts('2026-01-15T23:30:00Z'), {
    date: '2026-01-16',
    time: '00:30:00',
  });
});

test('exdateLine formats TZID wall-clock exclusions', () => {
  const line = exdateLine([
    { date: '2026-04-06', time: '18:30:00' },
    { date: '2026-04-13', time: '18:30:00' },
  ]);
  assert.equal(line, 'EXDATE;TZID=Europe/Zurich:20260406T183000,20260413T183000');
});

test('planWeeklySchedule extends COUNT to cover blocked occurrences', () => {
  // Weekly Mondays 18:30 Zurich starting 2026-03-30 (CEST → 16:30Z).
  // Occurrences: Mar30, Apr06(blocked), Apr13(blocked), Apr20, Apr27, May04...
  const { count, excluded } = planWeeklySchedule({
    firstSessionAt: '2026-03-30T16:30:00Z',
    sessionsTotal: 4,
    blockedPeriods: periods,
  });
  assert.equal(count, 6); // 4 kept + 2 excluded
  assert.deepEqual(excluded, [
    { date: '2026-04-06', time: '18:30:00' },
    { date: '2026-04-13', time: '18:30:00' },
  ]);
});

test('planWeeklySchedule with no blocked hits keeps plain count', () => {
  const { count, excluded } = planWeeklySchedule({
    firstSessionAt: '2026-09-07T16:30:00Z',
    sessionsTotal: 5,
    blockedPeriods: periods,
  });
  assert.equal(count, 5);
  assert.deepEqual(excluded, []);
});

test('planWeeklySchedule open-ended excludes only up to blocked horizon', () => {
  const { count, excluded } = planWeeklySchedule({
    firstSessionAt: '2026-03-30T16:30:00Z',
    sessionsTotal: null,
    blockedPeriods: periods,
  });
  assert.equal(count, null);
  // Walks Mondays until 2026-08-01 horizon; only the two April Mondays hit.
  assert.deepEqual(
    excluded.map((e) => e.date),
    ['2026-04-06', '2026-04-13']
  );
});

test('extendSeries finds replacement slots past new exclusions', () => {
  // Series of 4 Mondays from 2026-03-23; needs 2 replacements starting at
  // slot index 4 → 2026-04-20 and 2026-04-27, neither blocked.
  const { count, excluded } = extendSeries({
    startDate: '2026-03-23',
    startTime: '18:30:00',
    count: 4,
    needed: 2,
    blockedPeriods: periods,
  });
  assert.equal(count, 6);
  assert.deepEqual(excluded, []);
});

test('extendSeries skips blocked replacement slots and records them', () => {
  // Start 2026-03-16, count 3 → replacements begin 2026-04-06 (blocked),
  // then 2026-04-13 (blocked), then 2026-04-20 (kept).
  const { count, excluded } = extendSeries({
    startDate: '2026-03-16',
    startTime: '10:00:00',
    count: 3,
    needed: 1,
    blockedPeriods: periods,
  });
  assert.equal(count, 6);
  assert.deepEqual(
    excluded.map((e) => e.date),
    ['2026-04-06', '2026-04-13']
  );
});
