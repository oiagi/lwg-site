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

// ── Supabase JWT verification ─────────────────────────────────────────────
// Verifies a Supabase access token by calling Supabase's auth API.
// Returns the user object if valid, or null if invalid/expired.
export async function verifySupabaseToken(token, env) {
  if (!token) return null;
  try {
    const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': env.SUPABASE_ANON_KEY,
      },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ── Admin auth check ─────────────────────────────────────────────────────
// Returns a 401 Response if the Authorization Bearer token is invalid, or
// null if authentication passes (so callers can do: const err = requireAdminAuth(...); if (err) return err;).
export async function requireAdminAuth(request, env) {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const user = await verifySupabaseToken(token, env);
  if (!user) {
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
