// functions/get-enquiries.js
// GET /api/get-enquiries?status=new&limit=100
//
// Requires header: x-admin-password matching ADMIN_PASSWORD env var
// Returns enquiries from Supabase ordered newest first.
//
// Environment variables:
//   SUPABASE_URL         — https://eedxxgbsxnuxarwiommo.supabase.co
//   SUPABASE_SERVICE_KEY — service_role key
//   ADMIN_PASSWORD       — password protecting the admin dashboard

export async function onRequestGet({ request, env }) {
  const SUPABASE_URL         = env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = env.SUPABASE_SERVICE_KEY;
  const ADMIN_PASSWORD       = env.ADMIN_PASSWORD;

  // ── Password check ───────────────────────────────────────────────────
  const pwd = request.headers.get('x-admin-password');
  if (!pwd || pwd !== ADMIN_PASSWORD) {
    return new Response(JSON.stringify({ error: 'Unauthorised' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── Parse query params ───────────────────────────────────────────────
  const url    = new URL(request.url);
  const status = url.searchParams.get('status');
  const limit  = url.searchParams.get('limit') || '100';

  let supabaseUrl = `${SUPABASE_URL}/rest/v1/enquiries?order=created_at.desc&limit=${limit}`;
  if (status && status !== 'all') supabaseUrl += `&status=eq.${status}`;

  // ── Fetch from Supabase ──────────────────────────────────────────────
  try {
    const res = await fetch(supabaseUrl, {
      headers: {
        'apikey':        SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Supabase error:', err);
      return new Response(JSON.stringify({ error: 'Database error' }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = await res.json();
    return new Response(JSON.stringify(data), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Fetch error:', err);
    return new Response(JSON.stringify({ error: 'Connection error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
