// functions/api/get-teachers.js
// GET /api/get-teachers
//
// Returns all active teachers with their authentication status.
// Used by the admin dashboard to populate the teacher selector
// and show which teachers have authorised Google Calendar access.
//
// Environment variables:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY, ADMIN_PASSWORD

import { supabaseHeaders, requireAdminAuth } from './_utils.js';

export async function onRequestGet({ request, env }) {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;

  const authErr = requireAdminAuth(request, env);
  if (authErr) return authErr;

  try {
    // Select only non-sensitive fields — never return tokens to the client
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/teachers?active=eq.true&select=id,name,email,google_account,token_expires_at,refresh_token`,
      { headers: supabaseHeaders(SUPABASE_SERVICE_KEY) }
    );

    if (!res.ok) {
      return new Response(JSON.stringify({ error: 'Database error' }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      });
    }

    const teachers = await res.json();

    // Return teachers with a simple 'authorised' flag instead of raw tokens
    const sanitised = teachers.map(t => ({
      id:             t.id,
      name:           t.name,
      email:          t.email,
      google_account: t.google_account,
      authorised:     !!t.refresh_token,
      token_valid:    t.token_expires_at ? new Date(t.token_expires_at) > new Date() : false,
    }));

    return new Response(JSON.stringify(sanitised), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Error:', err);
    return new Response(JSON.stringify({ error: 'Connection error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
