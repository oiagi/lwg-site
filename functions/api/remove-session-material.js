// functions/api/remove-session-material.js
// POST /api/remove-session-material
// Body: { id }   (a session_materials row id)
//
// Removes one material reference from a logged session, straight from the
// course view. Only the link goes: the PDF stays in the library, and the
// session's attendance, topics and status are untouched. Editing the whole
// list still goes through save-attendance.js.
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
    `${SUPABASE_URL}/rest/v1/session_materials?id=eq.${encodeURIComponent(body.id)}`,
    {
      method: 'DELETE',
      headers: { ...supabaseHeaders(SUPABASE_SERVICE_KEY), Prefer: 'return=representation' },
    }
  );
  if (!res.ok) {
    console.error('remove-session-material error:', await res.text());
    return errorResponse('Database error');
  }
  const rows = await res.json();
  if (!rows.length) return errorResponse('Reference not found', 404);
  return jsonResponse({ success: true });
}, 'remove-session-material');
