// functions/api/update-course.js
// PATCH /api/update-course
// Body: { course_id, service?, level?, group_type?, status?, sessions_total?,
//         session_length_minutes?, price_per_session?, currency?, location?,
//         location_street?, location_street_number?, location_postal_code?,
//         location_city? }
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

const ALLOWED_FIELDS = [
  'service',
  'level',
  'group_type',
  'status',
  'sessions_total',
  'session_length_minutes',
  'price_per_session',
  'currency',
  'location',
  'location_street',
  'location_street_number',
  'location_postal_code',
  'location_city',
];

export const onRequestPatch = withErrorHandling(async ({ request, env }) => {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;

  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  const { body, error } = await parseJsonBody(request);
  if (error) return error;

  const courseId = body.course_id;
  if (!courseId) return errorResponse('Missing course_id', 400);

  const patch = pickDefined(body, ALLOWED_FIELDS);
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
