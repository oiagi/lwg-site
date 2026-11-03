// functions/api/delete-absence-period.js
// POST /api/delete-absence-period
// Body: { id }   (an absence_periods row id)
//
// Removes one planned absence from the course view, whichever source it
// came from (questionnaire or admin). Attendance that was already logged
// for the lessons in that period is not touched.
//
// Environment variables:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY, SUPABASE_ANON_KEY

import {
  supabaseHeaders,
  requireAdminAuth,
  jsonResponse,
  errorResponse,
  withErrorHandling,
  parseJsonBody,
} from './_utils.js';
import { validate } from './_validate.js';

const SCHEMA = { id: { required: true, type: 'string' } };

export const onRequestPost = withErrorHandling(async ({ request, env }) => {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;

  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  const { body, error } = await parseJsonBody(request);
  if (error) return error;
  const err = validate(body, SCHEMA);
  if (err) return errorResponse(err, 400);

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/absence_periods?id=eq.${encodeURIComponent(body.id)}`,
    {
      method: 'DELETE',
      headers: { ...supabaseHeaders(SUPABASE_SERVICE_KEY), Prefer: 'return=representation' },
    }
  );
  if (!res.ok) {
    console.error('delete-absence-period error:', await res.text());
    return errorResponse('Database error');
  }
  const rows = await res.json();
  if (!rows.length) return errorResponse('Absence not found', 404);
  return jsonResponse({ success: true });
}, 'delete-absence-period');
