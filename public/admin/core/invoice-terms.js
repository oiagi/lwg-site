/* ── Invoice payment terms ────────────────────────────────────────────────── */
// Pure helpers with no DOM and no dependencies, so they load in the admin
// browser bundle, in Pages Functions and in `node --test` alike.
//
// Which deadline an invoice gets depends on how far ahead the course start
// lies, measured from the invoice date:
//
// - course starts more than PAYMENT_WINDOW_DAYS after the invoice date
//   ("far"): the due date is the course start, the letter names it, and the
//   system flags the invoice overdue FAR_AHEAD_GRACE_DAYS after it.
// - otherwise ("near", including courses that already started): the due date
//   is invoice date + PAYMENT_WINDOW_DAYS, the letter says "innert 30 Tagen",
//   and the system flags it overdue the day after that.
//
// `paymentTerms` re-derives the bucket from the stored invoice and due dates,
// so letter, email and archive agree without an extra column.
//
// All arithmetic is done on YYYY-MM-DD strings via Date.UTC, so DST and the
// browser's timezone never shift a date by a day.

export const PAYMENT_WINDOW_DAYS = 30;
export const FAR_AHEAD_GRACE_DAYS = 7;

const ISO_DAY_RE = /^(\d{4})-(\d{2})-(\d{2})/;

// 'YYYY-MM-DD' or an ISO timestamp → UTC-midnight epoch ms, or null.
function dayMs(value) {
  const match = ISO_DAY_RE.exec(String(value || ''));
  if (!match) return null;
  const ms = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(ms) ? null : ms;
}

function msToIso(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDaysIso(value, days) {
  const ms = dayMs(value);
  return ms === null ? null : msToIso(ms + days * 86400000);
}

// Whole days from `fromValue` to `toValue` (negative when `to` is earlier).
export function daysBetween(fromValue, toValue) {
  const from = dayMs(fromValue);
  const to = dayMs(toValue);
  if (from === null || to === null) return null;
  return Math.round((to - from) / 86400000);
}

// Today's calendar date where the code runs, as 'YYYY-MM-DD'.
export function localIsoToday(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * The due date a new invoice should carry: the course start when it lies
 * more than PAYMENT_WINDOW_DAYS ahead, otherwise invoice date + 30 days.
 * @param {{ issuedDate: string, courseStart?: string|null }} input
 * @returns {string|null} 'YYYY-MM-DD', or null when `issuedDate` is unusable
 */
export function defaultDueDate({ issuedDate, courseStart } = {}) {
  const issued = dayMs(issuedDate);
  if (issued === null) return null;
  const start = dayMs(courseStart);
  const window = issued + PAYMENT_WINDOW_DAYS * 86400000;
  return msToIso(start !== null && start > window ? start : window);
}

/**
 * @param {{ issuedDate?: string|null, dueDate?: string|null }} input
 * @returns {{ farAhead: boolean, overdueFrom: string|null }}
 *   `overdueFrom` is the last day the invoice is still on time; it counts as
 *   overdue from the following day (see isPastDeadline).
 */
export function paymentTerms({ issuedDate, dueDate } = {}) {
  const due = dayMs(dueDate);
  if (due === null) return { farAhead: false, overdueFrom: null };
  const issued = dayMs(issuedDate) ?? due;
  const window = issued + PAYMENT_WINDOW_DAYS * 86400000;
  const farAhead = due > window;
  // Near: the 30-day window, even if the admin shortened the due date by hand.
  const overdueMs = farAhead ? due + FAR_AHEAD_GRACE_DAYS * 86400000 : Math.max(due, window);
  return { farAhead, overdueFrom: msToIso(overdueMs) };
}

// True once `today` is after the deadline day. ISO day strings compare
// lexically, so no Date parsing (and no UTC-vs-local surprise) is needed.
export function isPastDeadline(overdueFrom, today = localIsoToday()) {
  if (!overdueFrom) return false;
  return String(today).slice(0, 10) > String(overdueFrom).slice(0, 10);
}
