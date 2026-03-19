// functions/api/_utils.js
// Shared utilities for Cloudflare Pages API functions.

// ── Response helpers ──────────────────────────────────────────────────────
const JSON_HEADERS = { 'Content-Type': 'application/json' };

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

export function errorResponse(message, status = 500) {
  return new Response(JSON.stringify({ error: message }), { status, headers: JSON_HEADERS });
}

// ── Supabase request headers ──────────────────────────────────────────────
export function supabaseHeaders(key) {
  return {
    'Content-Type':  'application/json',
    'apikey':        key,
    'Authorization': `Bearer ${key}`,
  };
}

// ── Admin password check ──────────────────────────────────────────────────
// Returns a 401 Response if the x-admin-password header does not match, or
// null if authentication passes (so callers can do: const err = requireAdminAuth(...); if (err) return err;).
export function requireAdminAuth(request, env) {
  const pwd = request.headers.get('x-admin-password');
  if (!pwd || pwd !== env.ADMIN_PASSWORD) {
    return errorResponse('Unauthorised', 401);
  }
  return null;
}

// ── Google OAuth token refresh ────────────────────────────────────────────
// Returns a valid access token for the given teacher, refreshing via OAuth
// if the current token is within 5 minutes of expiry. Persists the new
// token to Supabase so subsequent calls reuse it.
export async function getValidAccessToken(teacher, env) {
  const expiresAt = new Date(teacher.token_expires_at);
  if (expiresAt > new Date(Date.now() + 5 * 60 * 1000)) return teacher.access_token;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: teacher.refresh_token,
      grant_type:    'refresh_token',
    }),
  });
  if (!res.ok) throw new Error(`Token refresh failed: ${await res.text()}`);

  const tokens = await res.json();
  const expiry  = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  await fetch(`${env.SUPABASE_URL}/rest/v1/teachers?id=eq.${teacher.id}`, {
    method: 'PATCH', headers: supabaseHeaders(env.SUPABASE_SERVICE_KEY),
    body: JSON.stringify({ access_token: tokens.access_token, token_expires_at: expiry }),
  });
  return tokens.access_token;
}
