// functions/api/update-course.js
// PATCH /api/update-course
// Body: { course_id, service?, level?, group_type?, status?, sessions_total?,
//         session_length_minutes?, price_per_session?,
//         price_per_person_per_60min?, currency?, location?,
//         location_company?, location_street?, location_street_number?,
//         location_postal_code?, location_city?, public_booking_enabled?,
//         company_code_booking_enabled?, access_code?, access_label? }
//
// Updates mutable fields on an existing course.

import {
  supabaseHeaders,
  requireAdminAuth,
  jsonResponse,
  errorResponse,
  withErrorHandling,
  parseJsonBody,
  pickDefined,
  hasFields,
} from './_utils.js';
import { normalizeAccessCode } from './_public-course-booking.js';

const ALLOWED_FIELDS = [
  'course_type',
  'subject',
  'level',
  'group_type',
  'status',
  'sessions_total',
  'session_length_minutes',
  'price_per_session',
  'price_per_person_per_60min',
  'currency',
  'location',
  'location_company',
  'location_street',
  'location_street_number',
  'location_postal_code',
  'location_city',
  'public_booking_enabled',
  'company_code_booking_enabled',
  'access_code',
  'access_label',
];

function cleanString(value, max = 200) {
  if (value === null || value === undefined) return null;
  const cleaned = String(value).replace(/\s+/g, ' ').trim();
  return cleaned ? cleaned.slice(0, max) : null;
}

export const onRequestPatch = withErrorHandling(async ({ request, env }) => {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;

  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  const { body, error } = await parseJsonBody(request);
  if (error) return error;

  const courseId = body.course_id;
  if (!courseId) return errorResponse('Missing course_id', 400);

  const patch = pickDefined(body, ALLOWED_FIELDS);
  if ('access_code' in patch) patch.access_code = normalizeAccessCode(patch.access_code);
  if ('access_label' in patch) patch.access_label = cleanString(patch.access_label, 200);
  if (!hasFields(patch)) return errorResponse('Nothing to update', 400);

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/courses?id=eq.${encodeURIComponent(courseId)}`,
      {
        method: 'PATCH',
        headers: { ...supabaseHeaders(SUPABASE_SERVICE_KEY), Prefer: 'return=representation' },
        body: JSON.stringify(patch),
      }
    );
    if (!res.ok) {
      const text = await res.text();
      console.error('update-course error:', text);
      return errorResponse('Database error');
    }
    const rows = await res.json();
    if (!rows.length) return errorResponse('Course not found', 404);
    return jsonResponse(rows[0]);
  } catch (err) {
    console.error('Error:', err);
    return errorResponse('Connection error');
  }
}, 'update-course');
