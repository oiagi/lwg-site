// functions/api/auth/callback.js
// GET /api/auth/callback?code=...&state=<teacher_id>
//
// Handles the redirect back from Google after OAuth consent.
// Exchanges the authorisation code for access + refresh tokens,
// then stores them against the teacher record in Supabase.
//
// Environment variables:
//   GOOGLE_CLIENT_ID     — OAuth client ID
//   GOOGLE_CLIENT_SECRET — OAuth client secret
//   SUPABASE_URL         — Supabase project URL
//   SUPABASE_SERVICE_KEY — Supabase service role key

export async function onRequestGet({ request, env }) {
  const GOOGLE_CLIENT_ID = env.GOOGLE_CLIENT_ID;
  const GOOGLE_CLIENT_SECRET = env.GOOGLE_CLIENT_SECRET;
  const SUPABASE_URL = env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = env.SUPABASE_SERVICE_KEY;

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const teacher_id = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  // ── Handle user denying consent ──────────────────────────────────────
  if (error) {
    return Response.redirect('https://oiagi.org/admin.html?auth=denied', 302);
  }

  if (!code || !teacher_id) {
    return Response.redirect('https://oiagi.org/admin.html?auth=error', 302);
  }

  // ── Exchange authorisation code for tokens ───────────────────────────
  let tokens;
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: 'https://oiagi.org/api/auth-callback',
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      console.error('Token exchange failed:', await tokenRes.text());
      return Response.redirect('https://oiagi.org/admin.html?auth=error', 302);
    }

    tokens = await tokenRes.json();
  } catch (err) {
    console.error('Token exchange error:', err);
    return Response.redirect('https://oiagi.org/admin.html?auth=error', 302);
  }

  // ── Store tokens in Supabase against the teacher record ─────────────
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  try {
    const patch = {
      access_token: tokens.access_token,
      token_expires_at: expiresAt,
    };
    // Only update refresh token if Google issued a new one
    // (Google only issues it on first consent or when prompt=consent is used)
    if (tokens.refresh_token) {
      patch.refresh_token = tokens.refresh_token;
    }

    const res = await fetch(`${SUPABASE_URL}/rest/v1/teachers?id=eq.${teacher_id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify(patch),
    });

    if (!res.ok) {
      console.error('Supabase token store failed:', await res.text());
      return Response.redirect('https://oiagi.org/admin.html?auth=error', 302);
    }
  } catch (err) {
    console.error('Supabase error:', err);
    return Response.redirect('https://oiagi.org/admin.html?auth=error', 302);
  }

  // ── Success — redirect back to admin dashboard ───────────────────────
  return Response.redirect('https://oiagi.org/admin.html?auth=success', 302);
}
