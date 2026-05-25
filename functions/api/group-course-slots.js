// functions/api/group-course-slots.js
// Admin CRUD for public "forming" group course slots.

import {
  supabaseHeaders,
  requireAdminAuth,
  jsonResponse,
  errorResponse,
  withErrorHandling,
  parseJsonBody,
  pickDefined,
} from './_utils.js';
import { PUBLIC_SLOT_BOOKING_STATUS, normalizeAccessCode } from './_public-course-booking.js';

const ALLOWED_FIELDS = [
  'status',
  'public_booking_enabled',
  'course_type',
  'subject',
  'level',
  'weekday',
  'start_time',
  'end_time',
  'timezone',
  'sessions_total',
  'session_length_minutes',
  'price_per_person_per_60min',
  'currency',
  'capacity',
  'minimum_students',
  'location',
  'location_company',
  'location_street',
  'location_street_number',
  'location_postal_code',
  'location_city',
  'allow_reduced_lessons',
  'access_code',
  'access_label',
  'notes',
];

function cleanString(value, max = 320) {
  if (value === null || value === undefined) return null;
  const cleaned = String(value).replace(/\s+/g, ' ').trim();
  return cleaned ? cleaned.slice(0, max) : null;
}

function intOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeTime(value) {
  const cleaned = cleanString(value, 20);
  if (!cleaned) return null;
  if (/^\d{2}:\d{2}$/.test(cleaned)) return `${cleaned}:00`;
  if (/^\d{2}:\d{2}:\d{2}$/.test(cleaned)) return cleaned;
  return null;
}

function normalizeSlot(input, { partial = false } = {}) {
  const raw = pickDefined(input || {}, ALLOWED_FIELDS);
  const slot = {};

  for (const [key, value] of Object.entries(raw)) {
    if (
      [
        'weekday',
        'sessions_total',
        'session_length_minutes',
        'capacity',
        'minimum_students',
      ].includes(key)
    ) {
      slot[key] = intOrNull(value);
    } else if (key === 'price_per_person_per_60min') {
      slot[key] = numberOrNull(value);
    } else if (key === 'allow_reduced_lessons' || key === 'public_booking_enabled') {
      slot[key] = value === true;
    } else if (key === 'start_time' || key === 'end_time') {
      slot[key] = normalizeTime(value);
    } else if (key === 'access_code') {
      slot[key] = normalizeAccessCode(value);
    } else {
      slot[key] = cleanString(value, key === 'notes' ? 1000 : 200);
    }
  }

  if (!partial) {
    slot.course_type ??= 'language course';
    slot.timezone ??= 'Europe/Zurich';
    slot.currency ??= 'CHF';
    slot.capacity ??= 5;
    slot.minimum_students ??= 3;
    slot.status ??= 'active';
    slot.public_booking_enabled ??= true;
    slot.allow_reduced_lessons ??= true;
  }

  return slot;
}

function validateSlot(slot, { partial = false } = {}) {
  const required = ['weekday', 'start_time', 'end_time', 'sessions_total'];
  if (!partial) {
    for (const field of required) {
      if (slot[field] === null || slot[field] === undefined) return `${field} is required`;
    }
  }
  if (slot.weekday !== undefined && (slot.weekday < 1 || slot.weekday > 7)) {
    return 'weekday must be between 1 and 7';
  }
  if (slot.sessions_total !== undefined && slot.sessions_total <= 0) {
    return 'sessions_total must be positive';
  }
  if (slot.session_length_minutes !== undefined && slot.session_length_minutes <= 0) {
    return 'session_length_minutes must be positive';
  }
  if (slot.capacity !== undefined && slot.capacity <= 0) return 'capacity must be positive';
  if (slot.minimum_students !== undefined && slot.minimum_students <= 0) {
    return 'minimum_students must be positive';
  }
  if (
    slot.capacity !== undefined &&
    slot.minimum_students !== undefined &&
    slot.minimum_students > slot.capacity
  ) {
    return 'minimum_students cannot exceed capacity';
  }
  if (slot.status !== undefined && !['active', 'paused', 'cancelled'].includes(slot.status)) {
    return 'invalid status';
  }
  return null;
}

async function loadPendingCounts(SUPABASE_URL, H, slots) {
  if (!slots.length) return { counts: {}, bookings: {} };
  const slotFilter = slots.map((slot) => `public_group_course_slot_id.eq.${slot.id}`).join(',');
  const pendingRes = await fetch(
    `${SUPABASE_URL}/rest/v1/enquiries?or=(${slotFilter})&status=eq.${PUBLIC_SLOT_BOOKING_STATUS}&order=created_at.asc&select=id,created_at,student_id,lead_first,lead_last,lead_email,lead_phone,public_group_course_slot_id,booking_data,contact_data`,
    { headers: H }
  );
  if (!pendingRes.ok) return { counts: {}, bookings: {} };
  const rows = await pendingRes.json();
  const counts = {};
  const bookings = {};
  for (const row of rows) {
    const id = row.public_group_course_slot_id;
    counts[id] = (counts[id] || 0) + 1;
    (bookings[id] ||= []).push(row);
  }
  return { counts, bookings };
}

export const onRequestGet = withErrorHandling(async ({ request, env }) => {
  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;
  const H = supabaseHeaders(SUPABASE_SERVICE_KEY);
  const status = new URL(request.url).searchParams.get('status') || 'all';
  const statusFilter = status === 'all' ? '' : `&status=eq.${encodeURIComponent(status)}`;

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/public_group_course_slots?order=weekday.asc,start_time.asc,created_at.desc${statusFilter}&select=*`,
    { headers: H }
  );
  if (!res.ok) {
    console.error('group-course-slots load error:', await res.text());
    return errorResponse('Could not load group course slots');
  }
  const slots = await res.json();
  const { counts: pendingCounts, bookings: pendingBookings } = await loadPendingCounts(
    SUPABASE_URL,
    H,
    slots
  );
  return jsonResponse(
    slots.map((slot) => ({
      ...slot,
      pending_booking_count: pendingCounts[slot.id] || 0,
      pending_bookings: pendingBookings[slot.id] || [],
    }))
  );
}, 'group-course-slots');

export const onRequestPost = withErrorHandling(async ({ request, env }) => {
  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  const { body, error } = await parseJsonBody(request);
  if (error) return error;

  const slot = normalizeSlot(body);
  const validationError = validateSlot(slot);
  if (validationError) return errorResponse(validationError, 400);

  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/public_group_course_slots`, {
    method: 'POST',
    headers: { ...supabaseHeaders(SUPABASE_SERVICE_KEY), Prefer: 'return=representation' },
    body: JSON.stringify(slot),
  });
  if (!res.ok) {
    console.error('group-course-slots create error:', await res.text());
    return errorResponse('Could not create group course slot');
  }
  const rows = await res.json();
  return jsonResponse(rows[0]);
}, 'group-course-slots');

export const onRequestPatch = withErrorHandling(async ({ request, env }) => {
  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  const { body, error } = await parseJsonBody(request);
  if (error) return error;

  const slotId = cleanString(body.id, 80);
  if (!slotId) return errorResponse('Missing id', 400);

  const patch = normalizeSlot(body, { partial: true });
  delete patch.id;
  const validationError = validateSlot(patch, { partial: true });
  if (validationError) return errorResponse(validationError, 400);
  if (!Object.keys(patch).length) return errorResponse('Nothing to update', 400);

  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/public_group_course_slots?id=eq.${encodeURIComponent(slotId)}`,
    {
      method: 'PATCH',
      headers: { ...supabaseHeaders(SUPABASE_SERVICE_KEY), Prefer: 'return=representation' },
      body: JSON.stringify(patch),
    }
  );
  if (!res.ok) {
    console.error('group-course-slots update error:', await res.text());
    return errorResponse('Could not update group course slot');
  }
  const rows = await res.json();
  if (!rows.length) return errorResponse('Slot not found', 404);
  return jsonResponse(rows[0]);
}, 'group-course-slots');
