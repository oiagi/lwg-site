// functions/api/_blocked-dates.js
// Shared helpers for globally blocked scheduling dates.
//
// Blocked periods live in the blocked_dates table as inclusive date ranges
// (Europe/Zurich). Weekly course occurrences falling on a blocked date are
// excluded from the recurring Google Calendar event via EXDATE entries while
// the RRULE COUNT is extended by the number of exclusions, so the skipped
// sessions are appended after the last scheduled occurrence instead of
// silently disappearing. EXDATEs use TZID + wall-clock time because the
// series keeps local time across DST changes (UTC-based EXDATEs would miss
// instances on the other side of a DST switch).

const TIME_ZONE = 'Europe/Zurich';

// Safety valve for the "extend until enough non-blocked slots" loops so a
// pathological blocked period can never spin forever (~2 years of weeks).
const MAX_EXTRA_SLOTS = 105;

export async function loadBlockedPeriods(SUPABASE_URL, headers) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/blocked_dates?select=start_date,end_date&order=start_date.asc`,
    { headers }
  );
  if (!res.ok) {
    console.error('Blocked dates load error:', res.status, await res.text());
    const err = new Error('Could not load blocked dates');
    err.statusCode = 502;
    throw err;
  }
  return res.json();
}

export function isDateBlocked(dateStr, blockedPeriods) {
  return blockedPeriods.some((p) => dateStr >= p.start_date && dateStr <= p.end_date);
}

/** Zurich wall-clock parts of a Date: { date: 'YYYY-MM-DD', time: 'HH:MM:SS' }. */
export function zurichParts(value) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(value));
  const get = (type) => parts.find((p) => p.type === type)?.value || '00';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${get('hour')}:${get('minute')}:${get('second')}`,
  };
}

/** Add days to a 'YYYY-MM-DD' string in pure calendar-date arithmetic. */
export function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Build an EXDATE line from [{ date: 'YYYY-MM-DD', time: 'HH:MM:SS' }]. */
export function exdateLine(slots) {
  const values = slots.map((s) => `${s.date.replace(/-/g, '')}T${s.time.replace(/:/g, '')}`);
  return `EXDATE;TZID=${TIME_ZONE}:${values.join(',')}`;
}

/**
 * Plan a weekly series starting at firstSessionAt that yields sessionsTotal
 * actual sessions while skipping blocked dates. Skipped occurrences remain
 * inside the RRULE window (COUNT covers them) and are excluded via EXDATE,
 * which is what pushes the missing sessions past the last scheduled one.
 *
 * For open-ended courses (sessionsTotal null) there is no COUNT to extend;
 * occurrences are excluded up to the end of the last blocked period only.
 *
 * @returns {{ count: number|null, excluded: {date: string, time: string}[] }}
 */
export function planWeeklySchedule({ firstSessionAt, sessionsTotal, blockedPeriods }) {
  const start = zurichParts(firstSessionAt);
  const excluded = [];

  if (sessionsTotal) {
    let kept = 0;
    let slots = 0;
    let date = start.date;
    const maxSlots = sessionsTotal + MAX_EXTRA_SLOTS;
    while (kept < sessionsTotal && slots < maxSlots) {
      if (isDateBlocked(date, blockedPeriods)) {
        excluded.push({ date, time: start.time });
      } else {
        kept++;
      }
      slots++;
      date = addDays(date, 7);
    }
    return { count: slots, excluded };
  }

  const horizon = blockedPeriods.reduce((max, p) => (p.end_date > max ? p.end_date : max), '');
  for (let date = start.date; date <= horizon; date = addDays(date, 7)) {
    if (isDateBlocked(date, blockedPeriods)) {
      excluded.push({ date, time: start.time });
    }
  }
  return { count: null, excluded };
}

/**
 * Extend an existing series after new exclusions: starting at slot index
 * `count`, walk forward until `needed` non-blocked replacement slots are
 * found, collecting any blocked replacement slots as further exclusions.
 *
 * @returns {{ count: number, excluded: {date: string, time: string}[] }}
 */
export function extendSeries({ startDate, startTime, count, needed, blockedPeriods }) {
  const excluded = [];
  let slotIndex = count;
  let remaining = needed;
  const maxSlots = count + needed + MAX_EXTRA_SLOTS;
  while (remaining > 0 && slotIndex < maxSlots) {
    const date = addDays(startDate, 7 * slotIndex);
    if (isDateBlocked(date, blockedPeriods)) {
      excluded.push({ date, time: startTime });
    } else {
      remaining--;
    }
    slotIndex++;
  }
  return { count: slotIndex, excluded };
}
