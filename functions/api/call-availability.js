// functions/api/call-availability.js
// Admin CRUD for the recurring weekly windows offered as 15-minute calls.
//
// GET    — list windows, optionally ?teacher_id=<uuid>
// POST   — create one: { teacher_id, weekday, start_time, end_time }
// PATCH  — toggle one:  { id, active }
// DELETE — remove one:  { id }
//
// Windows are Europe/Zurich wall clock. functions/api/_call-slots.js slices
// them into bookable slots; blocked_dates, Google Calendar busy times and
// existing bookings are subtracted at read time, not stored here.

import {
  supabaseHeaders,
  requireAdminAuth,
  jsonResponse,
  errorResponse,
  withErrorHandling,
  parseJsonBody,
} from './_utils.js';
import { validate } from './_validate.js';

const SELECT = 'id,teacher_id,weekday,start_time,end_time,timezone,active';

/** 'HH:MM' or 'HH:MM:SS' → 'HH:MM:SS'. Mirrors group-course-slots.js. */
function normalizeTime(value) {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim();
  if (/^\d{2}:\d{2}$/.test(cleaned)) return `${cleaned}:00`;
  if (/^\d{2}:\d{2}:\d{2}$/.test(cleaned)) return cleaned;
  return null;
}

/** Minutes since midnight, or null when out of range. */
function timeToMinutes(hms) {
  const [h, m, s] = hms.split(':').map(Number);
  if (h > 23 || m > 59 || s > 59) return null;
  return h * 60 + m + s / 60;
}

export const onRequestGet = withErrorHandling(async ({ request, env }) => {
  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;
  const teacherId = new URL(request.url).searchParams.get('teacher_id');
  const filter = teacherId ? `&teacher_id=eq.${encodeURIComponent(teacherId)}` : '';

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/call_availability?select=${SELECT}${filter}` +
      `&order=weekday.asc,start_time.asc`,
    { headers: supabaseHeaders(SUPABASE_SERVICE_KEY) }
  );
  if (!res.ok) {
    console.error('call-availability load error:', await res.text());
    return errorResponse('Could not load call windows');
  }
  return jsonResponse(await res.json());
}, 'call-availability');

export const onRequestPost = withErrorHandling(async ({ request, env }) => {
  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  const { body, error } = await parseJsonBody(request);
  if (error) return error;

  const validationErr = validate(body, {
    teacher_id: { required: true, type: 'string', maxLength: 64 },
    start_time: { required: true, type: 'string', maxLength: 20 },
    end_time: { required: true, type: 'string', maxLength: 20 },
  });
  if (validationErr) return errorResponse(validationErr, 400);

  const weekday = Number(body.weekday);
  if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) {
    return errorResponse('weekday must be a whole number from 1 (Monday) to 7 (Sunday)', 400);
  }

  const startTime = normalizeTime(body.start_time);
  const endTime = normalizeTime(body.end_time);
  if (!startTime || !endTime) return errorResponse('Times must be in HH:MM format', 400);

  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  if (startMinutes === null || endMinutes === null) {
    return errorResponse('Times must be in HH:MM format', 400);
  }
  if (endMinutes <= startMinutes)
    return errorResponse('The end time must be after the start time', 400);
  // Mirrors call_availability_quarter_hour so the admin gets a sentence
  // rather than a Postgres constraint name.
  if (startMinutes % 15 !== 0 || endMinutes % 15 !== 0) {
    return errorResponse('Times must fall on a quarter hour (:00, :15, :30, :45)', 400);
  }

  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/call_availability`, {
    method: 'POST',
    headers: { ...supabaseHeaders(SUPABASE_SERVICE_KEY), Prefer: 'return=representation' },
    body: JSON.stringify({
      teacher_id: body.teacher_id,
      weekday,
      start_time: startTime,
      end_time: endTime,
    }),
  });
  if (res.status === 409) return errorResponse('That window already exists', 409);
  if (!res.ok) {
    console.error('call-availability create error:', await res.text());
    return errorResponse('Could not create call window');
  }
  const rows = await res.json();
  return jsonResponse(rows[0]);
}, 'call-availability');

export const onRequestPatch = withErrorHandling(async ({ request, env }) => {
  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  const { body, error } = await parseJsonBody(request);
  if (error) return error;

  const validationErr = validate(body, {
    id: { required: true, type: 'string', maxLength: 64 },
    active: { required: true, type: 'boolean' },
  });
  if (validationErr) return errorResponse(validationErr, 400);

  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/call_availability?id=eq.${encodeURIComponent(body.id)}&select=${SELECT}`,
    {
      method: 'PATCH',
      headers: { ...supabaseHeaders(SUPABASE_SERVICE_KEY), Prefer: 'return=representation' },
      body: JSON.stringify({ active: body.active }),
    }
  );
  if (!res.ok) {
    console.error('call-availability update error:', await res.text());
    return errorResponse('Could not update call window');
  }
  const rows = await res.json();
  if (!rows.length) return errorResponse('Call window not found', 404);
  return jsonResponse(rows[0]);
}, 'call-availability');

export const onRequestDelete = withErrorHandling(async ({ request, env }) => {
  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  const { body, error } = await parseJsonBody(request);
  if (error) return error;

  const id = typeof body.id === 'string' ? body.id.trim() : '';
  if (!id) return errorResponse('Missing id', 400);

  // Deliberately does not touch call_bookings: calls already booked inside
  // this window stay booked, and the admin is told so in the UI.
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/call_availability?id=eq.${encodeURIComponent(id)}`,
    { method: 'DELETE', headers: supabaseHeaders(SUPABASE_SERVICE_KEY) }
  );
  if (!res.ok) {
    console.error('call-availability delete error:', await res.text());
    return errorResponse('Could not delete call window');
  }
  return jsonResponse({ deleted: true });
}, 'call-availability');
