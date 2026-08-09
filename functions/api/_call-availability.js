// functions/api/_call-availability.js
// Shared I/O for the 15-minute call endpoints: loads everything the pure
// generator in _call-slots.js needs and returns the bookable slots.
//
// Both call-slots.js (listing) and book-call.js (re-deriving availability
// before it trusts a submitted slot) go through loadCallContext(), so the two
// can never drift apart.

import { supabaseHeaders, getValidAccessToken } from './_utils.js';
import { loadBlockedPeriods } from './_blocked-dates.js';
import { fetchFreeBusy } from './_calendar.js';
import {
  generateCallSlots,
  DEFAULT_HORIZON_DAYS,
  DEFAULT_LEAD_MINUTES,
  SLOT_MINUTES,
} from './_call-slots.js';

export const CALL_TIME_ZONE = 'Europe/Zurich';

const TEACHER_SELECT = 'id,name,email,calendar_id,access_token,refresh_token,token_expires_at';

/**
 * Load windows, blocked dates, bookings and calendar busy times, then
 * generate the bookable slots.
 *
 * FreeBusy has two distinct failure modes and they are handled differently:
 *   • teacher never authorised Google — degrade gracefully, still offer
 *     slots, flag calendar_synced:false, and let booking fall back to .ics;
 *   • authorised but the query failed — throw, so the caller fails closed.
 *     Offering unverified slots is how a visitor books over a real lesson.
 *
 * @param {object} env
 * @param {object} [opts]
 * @param {Date} [opts.now]
 * @returns {Promise<{teacher: object|null, days: object[], calendarSynced: boolean,
 *   horizonDays: number, leadMinutes: number}>}
 */
export async function loadCallContext(env, { now = new Date() } = {}) {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;
  const headers = supabaseHeaders(SUPABASE_SERVICE_KEY);

  const horizonDays = DEFAULT_HORIZON_DAYS;
  const leadMinutes = DEFAULT_LEAD_MINUTES;
  const empty = { teacher: null, days: [], calendarSynced: false, horizonDays, leadMinutes };

  const windowRes = await fetch(
    `${SUPABASE_URL}/rest/v1/call_availability` +
      `?select=teacher_id,weekday,start_time,end_time&active=is.true` +
      `&order=teacher_id.asc,weekday.asc,start_time.asc`,
    { headers }
  );
  if (!windowRes.ok) {
    console.error('call windows load error:', await windowRes.text());
    const err = new Error('Could not load call availability');
    err.statusCode = 502;
    throw err;
  }
  const allWindows = await windowRes.json();
  if (!allWindows.length) return empty;

  // v1 serves a single call teacher: the first one in a deterministic order.
  const teacherId = allWindows[0].teacher_id;
  const windows = allWindows.filter((w) => w.teacher_id === teacherId);

  const timeMin = now.toISOString();
  const timeMax = new Date(now.getTime() + horizonDays * 24 * 60 * 60 * 1000).toISOString();

  const [teacherRes, blockedPeriods, bookedRes] = await Promise.all([
    fetch(
      `${SUPABASE_URL}/rest/v1/teachers?id=eq.${encodeURIComponent(teacherId)}` +
        `&select=${TEACHER_SELECT}&limit=1`,
      { headers }
    ),
    loadBlockedPeriods(SUPABASE_URL, headers),
    fetch(
      `${SUPABASE_URL}/rest/v1/call_bookings?select=starts_at,duration_minutes` +
        `&status=eq.booked&teacher_id=eq.${encodeURIComponent(teacherId)}` +
        `&starts_at=gte.${timeMin}&starts_at=lt.${timeMax}`,
      { headers }
    ),
  ]);

  if (!teacherRes.ok) {
    console.error('call teacher load error:', await teacherRes.text());
    const err = new Error('Could not load call availability');
    err.statusCode = 502;
    throw err;
  }
  const teacher = (await teacherRes.json())[0] || null;
  if (!teacher) return empty;

  if (!bookedRes.ok) {
    console.error('call bookings load error:', await bookedRes.text());
    const err = new Error('Could not load call availability');
    err.statusCode = 502;
    throw err;
  }
  const bookedCalls = await bookedRes.json();

  let busyIntervals = [];
  let calendarSynced = false;
  if (teacher.refresh_token && teacher.calendar_id) {
    const accessToken = await getValidAccessToken(teacher, env);
    busyIntervals = await fetchFreeBusy({
      accessToken,
      calendarId: teacher.calendar_id,
      timeMin,
      timeMax,
    });
    calendarSynced = true;
  } else {
    console.warn('call availability: teacher has no Google Calendar authorisation');
  }

  const days = generateCallSlots({
    now,
    windows,
    blockedPeriods,
    busyIntervals,
    bookedCalls,
    horizonDays,
    leadMinutes,
  });

  return { teacher, days, calendarSynced, horizonDays, leadMinutes, slotMinutes: SLOT_MINUTES };
}
