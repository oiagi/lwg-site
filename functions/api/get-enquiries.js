// functions/get-enquiries.js
// GET /api/get-enquiries?status=new&limit=100
//
// Requires header: x-admin-password matching ADMIN_PASSWORD env var
// Returns enquiries from Supabase ordered newest first.
//
// Environment variables:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY, ADMIN_PASSWORD

import {
  supabaseHeaders,
  requireAdminAuth,
  listResponse,
  errorResponse,
  withErrorHandling,
} from './_utils.js';

export const onRequestGet = withErrorHandling(async ({ request, env }) => {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;

  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  // ── Parse query params ───────────────────────────────────────────────
  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '50', 10), 1), 200);
  const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10), 0);

  let supabaseUrl = `${SUPABASE_URL}/rest/v1/enquiries?order=created_at.desc&limit=${limit}&offset=${offset}&select=*,student:students(id,first_name,last_name,email)`;
  if (status && status !== 'all') supabaseUrl += `&status=eq.${status}`;

  // ── Fetch from Supabase ──────────────────────────────────────────────
  try {
    const H = supabaseHeaders(SUPABASE_SERVICE_KEY);
    const res = await fetch(supabaseUrl, { headers: { ...H, Prefer: 'count=exact' } });

    if (!res.ok) {
      console.error('Supabase error:', await res.text());
      return errorResponse('Database error');
    }

    const contentRange = res.headers.get('Content-Range');
    const total = contentRange ? parseInt(contentRange.split('/')[1] || '0', 10) : 0;
    return listResponse(await res.json(), { total, limit, offset });
  } catch (err) {
    console.error('Fetch error:', err);
    return errorResponse('Connection error');
  }
}, 'get-enquiries');
