// functions/api/mark-intake-seen.js
// POST /api/mark-intake-seen
// Body: { student_id }
//
// Clears the intake_completed_at flag on a student record after admin has reviewed it.
// Requires intake_completed_at column to exist on the students table (see DB migration notes).

import {
  supabaseHeaders,
  requireAdminAuth,
  jsonResponse,
  errorResponse,
  withErrorHandling,
  parseJsonBody,
} from './_utils.js';

export const onRequestPost = withErrorHandling(async ({ request, env }) => {
  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  const { body, error } = await parseJsonBody(request);
  if (error) return error;
  if (!body.student_id) return errorResponse('Missing student_id', 400);

  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/students?id=eq.${encodeURIComponent(body.student_id)}`,
    {
      method: 'PATCH',
      headers: supabaseHeaders(SUPABASE_SERVICE_KEY),
      body: JSON.stringify({ intake_completed_at: null }),
    }
  );

  if (!res.ok) {
    console.error('mark-intake-seen failed:', await res.text());
    return errorResponse('Could not mark intake as seen', 502);
  }

  return jsonResponse({ success: true });
}, 'mark-intake-seen');
