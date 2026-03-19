// functions/get-enquiries.js
// GET /api/get-enquiries?status=new&limit=100
//
// Requires header: x-admin-password matching ADMIN_PASSWORD env var
// Returns enquiries from Supabase ordered newest first.
//
// Environment variables:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY, ADMIN_PASSWORD

import { supabaseHeaders, requireAdminAuth, jsonResponse, errorResponse } from './_utils.js';

export async function onRequestGet({ request, env }) {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;

  const authErr = requireAdminAuth(request, env);
  if (authErr) return authErr;

  // ── Parse query params ───────────────────────────────────────────────
  const url    = new URL(request.url);
  const status = url.searchParams.get('status');
  const limit  = url.searchParams.get('limit') || '100';

  let supabaseUrl = `${SUPABASE_URL}/rest/v1/enquiries?order=created_at.desc&limit=${limit}`;
  if (status && status !== 'all') supabaseUrl += `&status=eq.${status}`;

  // ── Fetch from Supabase ──────────────────────────────────────────────
  try {
    const res = await fetch(supabaseUrl, { headers: supabaseHeaders(SUPABASE_SERVICE_KEY) });

    if (!res.ok) {
      console.error('Supabase error:', await res.text());
      return errorResponse('Database error');
    }

    return jsonResponse(await res.json());
  } catch (err) {
    console.error('Fetch error:', err);
    return errorResponse('Connection error');
  }
}
