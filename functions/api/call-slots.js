// functions/api/call-slots.js
// GET /api/call-slots — public list of bookable 15-minute call slots.
//
// Read-only and idempotent, so it follows the other public GETs (public-courses,
// reviews) in being rate limited but not origin checked.
//
// The response deliberately carries nothing but times: no teacher, no calendar
// id, no busy intervals, no existing bookers. A missing slot is never
// explained — the reason would let anyone reconstruct a private calendar.

import { jsonResponse, errorResponse, withErrorHandling, checkRateLimit } from './_utils.js';
import { loadCallContext, CALL_TIME_ZONE } from './_call-availability.js';
import { SLOT_MINUTES } from './_call-slots.js';

export const onRequestGet = withErrorHandling(async ({ request, env }) => {
  const limited = await checkRateLimit(request, { maxRequests: 30, windowSeconds: 60 });
  if (limited) return limited;

  let context;
  try {
    context = await loadCallContext(env);
  } catch (err) {
    // Fail closed. Slots that have not been checked against the live calendar
    // are worse than no slots at all — the visitor gets the enquiry form.
    console.error('call-slots availability error:', err?.message || err);
    return errorResponse('Live availability is unavailable right now.', 503);
  }

  return jsonResponse({
    timezone: CALL_TIME_ZONE,
    slot_minutes: SLOT_MINUTES,
    lead_minutes: context.leadMinutes,
    horizon_days: context.horizonDays,
    calendar_synced: context.calendarSynced,
    days: context.days,
  });
}, 'call-slots');
