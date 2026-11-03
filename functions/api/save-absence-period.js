// functions/api/save-absence-period.js
// POST /api/save-absence-period
// Body: { student_id, course_id, start_date, end_date?, note? }
//
// Adds one planned absence by hand, from the participant block in the
// course view: the student told the teacher they will be away. Dates are
// 'YYYY-MM-DD' (Europe/Zurich), inclusive; no end date means a single day.
// The same window and length rules apply as to the questionnaire calendar
// (functions/api/_absences.js). Rows from the questionnaire are untouched.
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
import { normaliseRanges } from './_absences.js';

const SCHEMA = {
  student_id: { required: true, type: 'string' },
  course_id: { required: true, type: 'string' },
  start_date: { required: true, type: 'string' },
  end_date: { type: 'string' },
  note: { type: 'string', maxLength: 200 },
};

export const onRequestPost = withErrorHandling(async ({ request, env }) => {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;

  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  const { body, error } = await parseJsonBody(request);
  if (error) return error;
  const err = validate(body, SCHEMA);
  if (err) return errorResponse(err, 400);

  const { error: rangeError, value } = normaliseRanges([
    { from: body.start_date, to: body.end_date || body.start_date },
  ]);
  if (rangeError) return errorResponse(rangeError, 400);
  const [range] = value;

  const res = await fetch(`${SUPABASE_URL}/rest/v1/absence_periods`, {
    method: 'POST',
    headers: { ...supabaseHeaders(SUPABASE_SERVICE_KEY), Prefer: 'return=representation' },
    body: JSON.stringify({
      student_id: body.student_id,
      course_id: body.course_id,
      start_date: range.from,
      end_date: range.to,
      source: 'admin',
      note: body.note?.trim() || null,
    }),
  });
  if (!res.ok) {
    console.error('save-absence-period error:', await res.text());
    return errorResponse('Database error');
  }
  const [period] = await res.json();
  return jsonResponse({ period });
}, 'save-absence-period');
