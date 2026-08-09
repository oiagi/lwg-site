// functions/api/call-bookings.js
// Admin read of booked 15-minute calls.
//
// GET ?scope=upcoming|past — defaults to upcoming.
//
// There is no cancel endpoint yet: cancelling would also have to delete the
// Google Calendar event and notify the visitor. For now a call is cancelled
// by deleting the event in Google Calendar and replying to the visitor.

import {
  supabaseHeaders,
  requireAdminAuth,
  jsonResponse,
  errorResponse,
  withErrorHandling,
} from './_utils.js';

const SELECT =
  'id,starts_at,duration_minutes,first_name,last_name,email,phone,topic,' +
  'language,delivery,meet_link,calendar_event_id,created_at';

export const onRequestGet = withErrorHandling(async ({ request, env }) => {
  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  const scope = new URL(request.url).searchParams.get('scope') === 'past' ? 'past' : 'upcoming';
  const now = new Date().toISOString();
  const filter =
    scope === 'past'
      ? `&starts_at=lt.${now}&order=starts_at.desc&limit=50`
      : `&starts_at=gte.${now}&order=starts_at.asc`;

  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/call_bookings?select=${SELECT}&status=eq.booked${filter}`,
    { headers: supabaseHeaders(SUPABASE_SERVICE_KEY) }
  );
  if (!res.ok) {
    console.error('call-bookings load error:', await res.text());
    return errorResponse('Could not load booked calls');
  }
  return jsonResponse(await res.json());
}, 'call-bookings');
