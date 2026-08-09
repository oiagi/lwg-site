// functions/api/_call-slots.js
// Pure slot generation for 15-minute intro calls.
//
// Availability lives in call_availability as recurring weekly windows in
// Europe/Zurich wall-clock time. This module slices those windows into
// fixed-length slots over a rolling horizon and removes anything unbookable:
// blocked_dates, Google Calendar busy intervals, already-booked calls and
// everything inside the minimum lead time.
//
// Deliberately free of fetch/env/Date.now() — `now` is always injected — so
// the whole thing is unit-testable without stubs.

import { isDateBlocked, addDays } from './_blocked-dates.js';

const TIME_ZONE = 'Europe/Zurich';

export const SLOT_MINUTES = 15;
export const DEFAULT_HORIZON_DAYS = 21;
export const DEFAULT_LEAD_MINUTES = 12 * 60;

// zurichParts() in _blocked-dates.js builds a formatter per call, which is
// fine for a handful of sessions but not for the few hundred conversions a
// slot listing does. Same output shape, cached formatter.
const ZURICH_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

/** Zurich wall-clock parts of an epoch-ms value: { date, time }. */
export function zurichPartsMs(ms) {
  const parts = ZURICH_FORMAT.formatToParts(new Date(ms));
  const get = (type) => parts.find((p) => p.type === type)?.value || '00';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${get('hour')}:${get('minute')}:${get('second')}`,
  };
}

/** Zurich's UTC offset in minutes at the given instant (+60 CET, +120 CEST). */
export function zurichOffsetMinutes(ms) {
  const { date, time } = zurichPartsMs(ms);
  return (Date.parse(`${date}T${time}Z`) - ms) / 60000;
}

/**
 * Invert zurichParts: a Zurich wall-clock date + time back to an instant.
 *
 * Two probes. The first reads the offset at the "naive" instant (the wall
 * clock reinterpreted as UTC), which is wrong by at most the offset itself
 * (≤ 2h). The second reads the offset at that corrected candidate, which
 * always lands on the correct side of a ≤ 1h DST transition, so the second
 * correction is exact for every wall-clock time that actually exists.
 *
 * `exact: false` means the time does not exist — the spring-forward gap,
 * where 02:00–03:00 is skipped. The returned ms is then clamped forward to
 * the first instant after the gap. Ambiguous autumn times (02:00–03:00 occurs
 * twice) resolve deterministically to the second, already-CET occurrence.
 * Note that the slot loop in generateCallSlots() keeps the *first* occurrence
 * when it dedupes repeated labels; the two only disagree for a window bound
 * that is itself inside the repeated hour, where either choice is sane.
 *
 * @returns {{ ms: number, exact: boolean }|null} null when unparseable.
 */
export function resolveZurichWallClock(dateStr, timeStr) {
  if (typeof dateStr !== 'string' || typeof timeStr !== 'string') return null;
  // PostgREST returns TIME as 'HH:MM:SS'; the admin form sends 'HH:MM'.
  const hms = timeStr.length === 5 ? `${timeStr}:00` : timeStr;
  const naive = Date.parse(`${dateStr}T${hms}Z`);
  if (Number.isNaN(naive)) return null;

  const guess = naive - zurichOffsetMinutes(naive) * 60000;
  const ms = naive - zurichOffsetMinutes(guess) * 60000;
  const back = zurichPartsMs(ms);
  return { ms, exact: back.date === dateStr && back.time === hms };
}

/** resolveZurichWallClock() when only the instant matters. */
export function zurichWallClockToMs(dateStr, timeStr) {
  return resolveZurichWallClock(dateStr, timeStr)?.ms ?? null;
}

/** ISO weekday of a 'YYYY-MM-DD' string: 1 = Monday … 7 = Sunday. */
export function isoWeekday(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  return day === 0 ? 7 : day;
}

/** ['YYYY-MM-DD', …] of `days` consecutive dates starting at startDateStr. */
export function enumerateDates(startDateStr, days) {
  const out = [];
  for (let i = 0; i < days; i++) out.push(addDays(startDateStr, i));
  return out;
}

/**
 * Normalise busy periods to sorted { startMs, endMs } pairs, padded by
 * bufferMinutes on both sides. Accepts ISO strings or epoch ms, and either
 * { start, end } or { start, durationMinutes }.
 */
export function toIntervals(periods, bufferMinutes = 0) {
  const pad = bufferMinutes * 60000;
  const out = [];
  for (const p of periods || []) {
    if (!p) continue;
    const startMs = typeof p.start === 'number' ? p.start : Date.parse(p.start);
    if (Number.isNaN(startMs)) continue;
    let endMs;
    if (p.end !== undefined && p.end !== null) {
      endMs = typeof p.end === 'number' ? p.end : Date.parse(p.end);
    } else if (p.durationMinutes) {
      endMs = startMs + p.durationMinutes * 60000;
    }
    if (endMs === undefined || Number.isNaN(endMs) || endMs <= startMs) continue;
    out.push({ startMs: startMs - pad, endMs: endMs + pad });
  }
  return out.sort((a, b) => a.startMs - b.startMs);
}

/** True when [startMs, endMs) overlaps any interval. Both ends half-open. */
export function overlapsAny(startMs, endMs, intervals) {
  return intervals.some((i) => startMs < i.endMs && endMs > i.startMs);
}

/**
 * Generate bookable slots grouped by Zurich calendar date.
 *
 * Window bounds are converted to instants once per (date, window) and the
 * loop then steps in UTC, which always yields real instants — stepping in
 * wall-clock time would produce non-existent times across the spring gap.
 * On the autumn fall-back day the same wall-clock label occurs twice; the
 * duplicate is dropped so the picker never shows "02:15" twice.
 *
 * @param {object} opts
 * @param {Date|number} opts.now            — reference instant
 * @param {object[]} opts.windows           — call_availability rows
 * @param {object[]} [opts.blockedPeriods]  — blocked_dates rows
 * @param {object[]} [opts.busyIntervals]   — [{ start, end }] from FreeBusy
 * @param {object[]} [opts.bookedCalls]     — [{ starts_at, duration_minutes }]
 * @returns {{date: string, slots: {start: string, time: string}[]}[]}
 */
export function generateCallSlots({
  now,
  windows = [],
  blockedPeriods = [],
  busyIntervals = [],
  bookedCalls = [],
  horizonDays = DEFAULT_HORIZON_DAYS,
  leadMinutes = DEFAULT_LEAD_MINUTES,
  slotMinutes = SLOT_MINUTES,
  bufferMinutes = 0,
  maxSlots = 500,
}) {
  const nowMs = now instanceof Date ? now.getTime() : Number(now);
  if (!Number.isFinite(nowMs)) return [];

  const slotMs = slotMinutes * 60000;
  const earliestMs = nowMs + leadMinutes * 60000;

  const intervals = toIntervals(
    [
      ...busyIntervals,
      ...bookedCalls.map((b) => ({
        start: b.starts_at ?? b.start,
        durationMinutes: b.duration_minutes ?? b.durationMinutes ?? slotMinutes,
      })),
    ],
    bufferMinutes
  );

  const byWeekday = new Map();
  for (const w of windows) {
    if (!w || w.active === false) continue;
    const list = byWeekday.get(w.weekday) || [];
    list.push(w);
    byWeekday.set(w.weekday, list);
  }
  if (!byWeekday.size) return [];

  const days = [];
  let total = 0;

  for (const date of enumerateDates(zurichPartsMs(nowMs).date, horizonDays)) {
    if (isDateBlocked(date, blockedPeriods)) continue;

    const slots = [];
    const seenLabels = new Set();

    for (const w of byWeekday.get(isoWeekday(date)) || []) {
      const winStart = zurichWallClockToMs(date, w.start_time);
      const winEnd = zurichWallClockToMs(date, w.end_time);
      if (winStart === null || winEnd === null || winEnd <= winStart) continue;

      for (let t = winStart; t + slotMs <= winEnd; t += slotMs) {
        if (t < earliestMs) continue;
        if (overlapsAny(t, t + slotMs, intervals)) continue;

        const label = zurichPartsMs(t).time.slice(0, 5);
        if (seenLabels.has(label)) continue;
        seenLabels.add(label);

        slots.push({ start: new Date(t).toISOString(), time: label });
        if (++total >= maxSlots) break;
      }
      if (total >= maxSlots) break;
    }

    if (slots.length) {
      slots.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
      days.push({ date, slots });
    }
    if (total >= maxSlots) break;
  }

  return days;
}

/** True when `startIso` is one of the generated slots. */
export function slotIsAvailable(startIso, days) {
  const startMs = Date.parse(startIso);
  if (Number.isNaN(startMs)) return false;
  return days.some((d) => d.slots.some((s) => Date.parse(s.start) === startMs));
}
