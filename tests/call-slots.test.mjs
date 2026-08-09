import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  zurichPartsMs,
  zurichOffsetMinutes,
  resolveZurichWallClock,
  zurichWallClockToMs,
  isoWeekday,
  enumerateDates,
  toIntervals,
  overlapsAny,
  generateCallSlots,
  slotIsAvailable,
} from '../functions/api/_call-slots.js';

// Monday 2026-08-17, 06:00 UTC (08:00 Zurich, CEST).
const MONDAY = Date.parse('2026-08-17T06:00:00Z');
const win = (weekday, start_time, end_time, extra = {}) => ({
  weekday,
  start_time,
  end_time,
  ...extra,
});

// ── Zurich wall clock ↔ instant ──────────────────────────────────────────

test('zurichOffsetMinutes: CET in winter, CEST in summer', () => {
  assert.equal(zurichOffsetMinutes(Date.parse('2026-01-15T10:00:00Z')), 60);
  assert.equal(zurichOffsetMinutes(Date.parse('2026-07-15T10:00:00Z')), 120);
});

test('zurichWallClockToMs: winter and summer conversions', () => {
  assert.equal(zurichWallClockToMs('2026-01-15', '10:00'), Date.parse('2026-01-15T09:00:00Z'));
  assert.equal(zurichWallClockToMs('2026-07-15', '10:00'), Date.parse('2026-07-15T08:00:00Z'));
});

test('zurichWallClockToMs round-trips through zurichPartsMs', () => {
  for (const [date, time] of [
    ['2026-01-15', '10:00'],
    ['2026-07-15', '10:00'],
    ['2026-12-31', '23:45'],
  ]) {
    const parts = zurichPartsMs(zurichWallClockToMs(date, time));
    assert.equal(parts.date, date);
    assert.equal(parts.time, `${time}:00`);
  }
});

test('accepts both HH:MM and HH:MM:SS (PostgREST returns HH:MM:SS)', () => {
  assert.equal(
    zurichWallClockToMs('2026-08-17', '09:00'),
    zurichWallClockToMs('2026-08-17', '09:00:00')
  );
});

test('spring-forward gap: 02:15 does not exist, clamps forward', () => {
  const r = resolveZurichWallClock('2026-03-29', '02:15');
  assert.equal(r.exact, false);
  assert.equal(r.ms, Date.parse('2026-03-29T01:15:00Z'));
  // 01:15Z is 03:15 Zurich — the first real instant carrying those minutes.
  assert.equal(zurichPartsMs(r.ms).time, '03:15:00');
});

test('fall-back: 01:00 is unambiguous CEST', () => {
  const r = resolveZurichWallClock('2026-10-25', '01:00');
  assert.equal(r.exact, true);
  assert.equal(r.ms, Date.parse('2026-10-24T23:00:00Z'));
});

test('fall-back: ambiguous 02:15 resolves deterministically to the CET occurrence', () => {
  // 02:15 happens twice on this day: 00:15Z (CEST) and 01:15Z (CET).
  // The two-probe resolution always lands on the second one.
  const r = resolveZurichWallClock('2026-10-25', '02:15');
  assert.equal(r.exact, true);
  assert.equal(r.ms, Date.parse('2026-10-25T01:15:00Z'));
  assert.equal(zurichPartsMs(r.ms).time, '02:15:00');
});

test('resolveZurichWallClock returns null on garbage', () => {
  assert.equal(resolveZurichWallClock('not-a-date', '09:00'), null);
  assert.equal(resolveZurichWallClock('2026-08-17', 'nope'), null);
  assert.equal(resolveZurichWallClock(null, '09:00'), null);
});

// ── Date helpers ─────────────────────────────────────────────────────────

test('isoWeekday: 1 = Monday … 7 = Sunday', () => {
  assert.equal(isoWeekday('2026-08-17'), 1);
  assert.equal(isoWeekday('2026-08-22'), 6);
  assert.equal(isoWeekday('2026-08-23'), 7);
});

test('enumerateDates walks calendar days including month rollover', () => {
  assert.deepEqual(enumerateDates('2026-08-30', 3), ['2026-08-30', '2026-08-31', '2026-09-01']);
});

// ── Interval helpers ─────────────────────────────────────────────────────

test('toIntervals normalises, sorts and drops invalid periods', () => {
  const out = toIntervals([
    { start: '2026-08-17T10:00:00Z', end: '2026-08-17T11:00:00Z' },
    { start: '2026-08-17T08:00:00Z', durationMinutes: 30 },
    { start: '2026-08-17T12:00:00Z', end: '2026-08-17T12:00:00Z' }, // zero length
    { start: 'garbage', end: '2026-08-17T13:00:00Z' },
    null,
  ]);
  assert.equal(out.length, 2);
  assert.equal(out[0].startMs, Date.parse('2026-08-17T08:00:00Z'));
  assert.equal(out[0].endMs, Date.parse('2026-08-17T08:30:00Z'));
  assert.equal(out[1].startMs, Date.parse('2026-08-17T10:00:00Z'));
});

test('toIntervals pads by bufferMinutes on both sides', () => {
  const [i] = toIntervals([{ start: '2026-08-17T10:00:00Z', end: '2026-08-17T11:00:00Z' }], 15);
  assert.equal(i.startMs, Date.parse('2026-08-17T09:45:00Z'));
  assert.equal(i.endMs, Date.parse('2026-08-17T11:15:00Z'));
});

test('overlapsAny treats intervals as half-open', () => {
  const intervals = toIntervals([{ start: '2026-08-17T10:00:00Z', end: '2026-08-17T11:00:00Z' }]);
  const at = (h, m) => Date.parse(`2026-08-17T${h}:${m}:00Z`);
  // Touching the end is not an overlap.
  assert.equal(overlapsAny(at('11', '00'), at('11', '15'), intervals), false);
  // Touching the start is not an overlap either.
  assert.equal(overlapsAny(at('09', '45'), at('10', '00'), intervals), false);
  assert.equal(overlapsAny(at('10', '45'), at('11', '00'), intervals), true);
});

// ── Slot generation ──────────────────────────────────────────────────────

test('a 09:00–10:00 window yields exactly four labelled slots', () => {
  const days = generateCallSlots({
    now: MONDAY,
    windows: [win(1, '09:00:00', '10:00:00')],
    leadMinutes: 0,
    horizonDays: 1,
  });
  assert.equal(days.length, 1);
  assert.equal(days[0].date, '2026-08-17');
  assert.deepEqual(
    days[0].slots.map((s) => s.time),
    ['09:00', '09:15', '09:30', '09:45']
  );
  assert.equal(days[0].slots[0].start, '2026-08-17T07:00:00.000Z');
});

test('window end is exclusive — a slot may not run past it', () => {
  const days = generateCallSlots({
    now: MONDAY,
    windows: [win(1, '09:00:00', '09:10:00')],
    leadMinutes: 0,
    horizonDays: 1,
  });
  assert.deepEqual(days, []);
});

test('non-matching weekday produces nothing', () => {
  const days = generateCallSlots({
    now: MONDAY,
    windows: [win(3, '09:00:00', '10:00:00')],
    leadMinutes: 0,
    horizonDays: 1,
  });
  assert.deepEqual(days, []);
});

test('inactive windows are ignored', () => {
  const days = generateCallSlots({
    now: MONDAY,
    windows: [win(1, '09:00:00', '10:00:00', { active: false })],
    leadMinutes: 0,
    horizonDays: 1,
  });
  assert.deepEqual(days, []);
});

test('end_time <= start_time is skipped without throwing', () => {
  const days = generateCallSlots({
    now: MONDAY,
    windows: [win(1, '10:00:00', '09:00:00'), win(1, '11:00:00', '11:00:00')],
    leadMinutes: 0,
    horizonDays: 1,
  });
  assert.deepEqual(days, []);
});

test('lead time removes slots that are too soon', () => {
  const days = generateCallSlots({
    now: MONDAY, // 08:00 Zurich
    windows: [win(1, '09:00:00', '12:00:00')],
    leadMinutes: 120, // nothing before 10:00 Zurich
    horizonDays: 1,
  });
  assert.equal(days[0].slots[0].time, '10:00');
  const earliest = MONDAY + 120 * 60000;
  for (const s of days[0].slots) assert.ok(Date.parse(s.start) >= earliest);
});

test('a blocked date removes the whole day, key included', () => {
  const opts = {
    now: MONDAY,
    windows: [win(1, '09:00:00', '10:00:00')],
    leadMinutes: 0,
    horizonDays: 8,
  };
  const before = generateCallSlots(opts);
  assert.deepEqual(
    before.map((d) => d.date),
    ['2026-08-17', '2026-08-24']
  );

  const after = generateCallSlots({
    ...opts,
    blockedPeriods: [{ start_date: '2026-08-17', end_date: '2026-08-17' }],
  });
  assert.deepEqual(
    after.map((d) => d.date),
    ['2026-08-24']
  );
});

test('a busy interval removes exactly the overlapping slots', () => {
  const days = generateCallSlots({
    now: MONDAY,
    windows: [win(1, '09:00:00', '10:00:00')],
    busyIntervals: [{ start: '2026-08-17T07:15:00Z', end: '2026-08-17T07:30:00Z' }],
    leadMinutes: 0,
    horizonDays: 1,
  });
  assert.deepEqual(
    days[0].slots.map((s) => s.time),
    ['09:00', '09:30', '09:45']
  );
});

test('bufferMinutes extends removal to the neighbouring slots', () => {
  const days = generateCallSlots({
    now: MONDAY,
    windows: [win(1, '09:00:00', '10:00:00')],
    busyIntervals: [{ start: '2026-08-17T07:15:00Z', end: '2026-08-17T07:30:00Z' }],
    bufferMinutes: 15,
    leadMinutes: 0,
    horizonDays: 1,
  });
  assert.deepEqual(
    days[0].slots.map((s) => s.time),
    ['09:45']
  );
});

test('an existing booking removes exactly its own slot', () => {
  const days = generateCallSlots({
    now: MONDAY,
    windows: [win(1, '09:00:00', '10:00:00')],
    bookedCalls: [{ starts_at: '2026-08-17T07:30:00Z', duration_minutes: 15 }],
    leadMinutes: 0,
    horizonDays: 1,
  });
  assert.deepEqual(
    days[0].slots.map((s) => s.time),
    ['09:00', '09:15', '09:45']
  );
});

test('DST-crossing week: same label, instants differ by an hour', () => {
  // 2026-03-23 is CET, 2026-03-30 is CEST — both Mondays.
  const days = generateCallSlots({
    now: Date.parse('2026-03-23T00:00:00Z'),
    windows: [win(1, '09:00:00', '09:15:00')],
    leadMinutes: 0,
    horizonDays: 8,
  });
  assert.deepEqual(
    days.map((d) => d.date),
    ['2026-03-23', '2026-03-30']
  );
  assert.equal(days[0].slots[0].time, '09:00');
  assert.equal(days[1].slots[0].time, '09:00');
  assert.equal(days[0].slots[0].start, '2026-03-23T08:00:00.000Z');
  assert.equal(days[1].slots[0].start, '2026-03-30T07:00:00.000Z');
});

test('autumn fall-back: the repeated hour is not offered twice', () => {
  // 2026-10-25 is a Sunday with a 25-hour day; 01:00–04:00 wall clock spans
  // four real hours, but only unique labels may be shown.
  const days = generateCallSlots({
    now: Date.parse('2026-10-24T00:00:00Z'),
    windows: [win(7, '01:00:00', '04:00:00')],
    leadMinutes: 0,
    horizonDays: 2,
  });
  const times = days[0].slots.map((s) => s.time);
  assert.equal(new Set(times).size, times.length);
  assert.equal(times.filter((t) => t === '02:00').length, 1);
});

test('grouping invariants: dates and slots ascending, no empty days', () => {
  const days = generateCallSlots({
    now: MONDAY,
    windows: [
      win(1, '14:00:00', '15:00:00'),
      win(1, '09:00:00', '10:00:00'),
      win(3, '09:00', '09:15'),
    ],
    leadMinutes: 0,
    horizonDays: 14,
  });
  for (const d of days) {
    assert.ok(d.slots.length > 0);
    const starts = d.slots.map((s) => s.start);
    assert.deepEqual(starts, [...starts].sort());
  }
  const dates = days.map((d) => d.date);
  assert.deepEqual(dates, [...dates].sort());
  // The two Monday windows are merged into one day entry, in time order.
  assert.equal(days[0].slots[0].time, '09:00');
  assert.equal(days[0].slots.at(-1).time, '14:45');
});

test('maxSlots caps the total number of slots returned', () => {
  const days = generateCallSlots({
    now: MONDAY,
    windows: [win(1, '09:00:00', '17:00:00')],
    leadMinutes: 0,
    horizonDays: 21,
    maxSlots: 5,
  });
  assert.equal(
    days.reduce((n, d) => n + d.slots.length, 0),
    5
  );
});

test('no windows produces no days', () => {
  assert.deepEqual(generateCallSlots({ now: MONDAY, windows: [] }), []);
});

// ── slotIsAvailable ──────────────────────────────────────────────────────

test('slotIsAvailable matches by instant, not by string form', () => {
  const days = generateCallSlots({
    now: MONDAY,
    windows: [win(1, '09:00:00', '10:00:00')],
    leadMinutes: 0,
    horizonDays: 1,
  });
  assert.equal(slotIsAvailable('2026-08-17T07:00:00.000Z', days), true);
  assert.equal(slotIsAvailable('2026-08-17T07:00:00Z', days), true); // same instant
  assert.equal(slotIsAvailable('2026-08-17T09:00:00.000Z', days), false);
  assert.equal(slotIsAvailable('nonsense', days), false);
});
