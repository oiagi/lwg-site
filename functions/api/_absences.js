// functions/api/_absences.js
// Planned absences: the date ranges a student will be away from a course.
//
// Students mark them in a calendar on the pre-course questionnaire (stored
// twice: as answers.absences on the questionnaire row, and as rows in the
// absence_periods table); the admin can add more by hand. A lesson is a
// planned absence for a student when its Europe/Zurich date lies inside one
// of their periods for the course. That is computed here at read time, never
// written onto sessions or attendance, so lessons that are scheduled later
// are covered as well and a session only counts as logged once the teacher
// actually logs it.
//
// Keep this file free of I/O — it is unit tested (tests/absences.test.mjs).
// Dates are 'YYYY-MM-DD' strings throughout; ranges are inclusive at both ends.

import { addDays, zurichParts } from './_blocked-dates.js';

/** The most ranges one student can mark for one course. */
export const MAX_ABSENCE_RANGES = 30;
/** The longest single range. */
export const MAX_RANGE_DAYS = 366;
/** A range may start this many days in the past (the course may have started). */
export const PAST_GRACE_DAYS = 31;
/** And reach at most this far into the future. */
export const FUTURE_HORIZON_DAYS = 730;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** True for a real calendar date written as 'YYYY-MM-DD'. */
export function isIsoDate(value) {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** Today's date in Europe/Zurich. */
export function zurichToday(now = Date.now()) {
  return zurichParts(now).date;
}

/** Whole days from `from` to `to` inclusive (1 for a single day). */
export function rangeDays(from, to) {
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return Math.round(ms / 86400000) + 1;
}

/** The dates a student may mark, around `today`. */
export function absenceWindow(today = zurichToday()) {
  return { from: addDays(today, -PAST_GRACE_DAYS), to: addDays(today, FUTURE_HORIZON_DAYS) };
}

/**
 * Sort ranges by start and merge the ones that overlap or touch (a range
 * ending on the 10th and one starting on the 11th become one). Input and
 * output are [{ from, to }].
 */
export function mergeRanges(ranges) {
  const sorted = [...ranges].sort((a, b) => a.from.localeCompare(b.from));
  const out = [];
  for (const range of sorted) {
    const last = out[out.length - 1];
    if (last && range.from <= addDays(last.to, 1)) {
      if (range.to > last.to) last.to = range.to;
    } else {
      out.push({ from: range.from, to: range.to });
    }
  }
  return out;
}

/**
 * Validate what a form (or the admin) posted as absence ranges. Accepts an
 * array of { from, to? } with 'YYYY-MM-DD' strings; a missing `to` means a
 * single day, and a reversed pair is swapped rather than rejected. Returns
 * { value } with sorted, merged ranges — null when nothing was marked — or
 * { error } with a message for the client.
 */
export function normaliseRanges(raw, { today = zurichToday() } = {}) {
  if (raw === undefined || raw === null) return { value: null };
  if (!Array.isArray(raw)) return { error: 'must be a list of date ranges' };
  if (!raw.length) return { value: null };

  const window = absenceWindow(today);
  const ranges = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return { error: 'each range must be an object with from and to' };
    }
    const from = entry.from;
    const to = entry.to === undefined || entry.to === null || entry.to === '' ? from : entry.to;
    if (!isIsoDate(from) || !isIsoDate(to)) {
      return { error: 'dates must be written as YYYY-MM-DD' };
    }
    const [start, end] = from <= to ? [from, to] : [to, from];
    if (start < window.from || end > window.to) {
      return { error: `dates must lie between ${window.from} and ${window.to}` };
    }
    if (rangeDays(start, end) > MAX_RANGE_DAYS) {
      return { error: `a range may cover at most ${MAX_RANGE_DAYS} days` };
    }
    ranges.push({ from: start, to: end });
  }

  const merged = mergeRanges(ranges);
  if (merged.length > MAX_ABSENCE_RANGES) {
    return { error: `at most ${MAX_ABSENCE_RANGES} ranges can be marked` };
  }
  return { value: merged };
}

/** The Zurich date of a session, or null when it has no start time. */
export function sessionDate(session) {
  if (!session?.scheduled_at) return null;
  const time = new Date(session.scheduled_at).getTime();
  return Number.isFinite(time) ? zurichParts(time).date : null;
}

/** True when the 'YYYY-MM-DD' date lies inside the period (inclusive). */
export function periodCovers(period, date) {
  return Boolean(date) && date >= period.start_date && date <= period.end_date;
}

/**
 * The students with a planned absence on this session: sorted unique ids
 * of everyone whose period (rows of absence_periods, any source) covers the
 * session's Zurich date.
 */
export function plannedAbsentees(session, periods) {
  const date = sessionDate(session);
  if (!date) return [];
  const ids = new Set();
  for (const period of periods || []) {
    if (periodCovers(period, date)) ids.add(period.student_id);
  }
  return [...ids].sort();
}

/** '2026-11-03' → '03.11.2026' */
export function formatIsoDate(value) {
  if (!isIsoDate(value)) return String(value ?? '');
  const [y, m, d] = value.split('-');
  return `${d}.${m}.${y}`;
}

/** One range as text: '03.11.2026 – 10.11.2026', or just the day. */
export function formatRange(range) {
  const from = range.from ?? range.start_date;
  const to = range.to ?? range.end_date ?? from;
  return from === to ? formatIsoDate(from) : `${formatIsoDate(from)} – ${formatIsoDate(to)}`;
}

/**
 * A list of ranges as one line of text, for the admin and the notification
 * email. Takes either the stored { from, to } shape or absence_periods rows
 * ({ start_date, end_date }).
 */
export function formatRanges(ranges) {
  return (ranges || []).map(formatRange).join(', ');
}
