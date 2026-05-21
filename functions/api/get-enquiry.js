// functions/api/get-enquiry.js
// GET /api/get-enquiry?id=<uuid>
//
// Admin-only helper used to prefill course creation from a booking request.

import {
  supabaseHeaders,
  requireAdminAuth,
  jsonResponse,
  errorResponse,
  withErrorHandling,
} from './_utils.js';

function cleanString(value, max = 120) {
  if (value === null || value === undefined) return null;
  const cleaned = String(value).replace(/\s+/g, ' ').trim();
  return cleaned ? cleaned.slice(0, max) : null;
}

export const onRequestGet = withErrorHandling(async ({ request, env }) => {
  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  const id = cleanString(new URL(request.url).searchParams.get('id'), 80);
  if (!id) return errorResponse('Missing id', 400);

  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/enquiries?id=eq.${encodeURIComponent(id)}&select=*`,
    { headers: supabaseHeaders(SUPABASE_SERVICE_KEY) }
  );
  if (!res.ok) return errorResponse('Could not load enquiry');

  const rows = await res.json();
  if (!rows.length) return errorResponse('Enquiry not found', 404);
  return jsonResponse(rows[0]);
}, 'get-enquiry');
