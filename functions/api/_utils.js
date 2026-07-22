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

export async function parseJsonBody(request) {
  try {
    const body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return { body: null, error: errorResponse('Invalid JSON', 400) };
    }
    return { body, error: null };
  } catch {
    return { body: null, error: errorResponse('Invalid JSON', 400) };
  }
}

export function pickDefined(source, fields) {
  return Object.fromEntries(
    fields.filter((field) => source[field] !== undefined).map((field) => [field, source[field]])
  );
}

export function hasFields(obj) {
  return Object.keys(obj).length > 0;
}

export function normalizePageLanguage(value, fallback = 'en') {
  return ['en', 'de'].includes(value) ? value : fallback;
}

// ── Formal capitalization ─────────────────────────────────────────────────
// Uppercases the first letter of each word ("firstname lastname" →
// "Firstname Lastname"), including after hyphens ("anna-lena" → "Anna-Lena").
// Letters that are already uppercase are left alone, so "McDonald" and
// acronyms survive unchanged.
export function capitalizeWords(value) {
  if (typeof value !== 'string') return value;
  return value.replace(
    /(^|[\s\-/.])(\p{Ll})/gu,
    (match, sep, letter) => sep + letter.toUpperCase()
  );
}

// Student fields that carry names/addresses and should be stored with formal
// capitalization regardless of how the student typed them.
export const CAPITALIZED_STUDENT_FIELDS = [
  'first_name',
  'last_name',
  'street',
  'city',
  'billing_name',
  'billing_street',
  'billing_city',
  'emergency_contact',
];

// Applies capitalizeWords() in place to whichever of the given fields are
// present as strings. Returns the same object for convenience.
export function capitalizeNameFields(data, fields = CAPITALIZED_STUDENT_FIELDS) {
  if (!data) return data;
  for (const field of fields) {
    if (typeof data[field] === 'string') data[field] = capitalizeWords(data[field]);
  }
  return data;
}

// ── Supabase request headers ──────────────────────────────────────────────
export function supabaseHeaders(key) {
  return {
    'Content-Type': 'application/json',
    apikey: key,
    Authorization: `Bearer ${key}`,
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
        Authorization: `Bearer ${token}`,
        apikey: env.SUPABASE_ANON_KEY,
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

// ── Request handler wrapper ─────────────────────────────────────────────
// Wraps a handler function with consistent error handling and logging.
// Usage: export const onRequestGet = withErrorHandling(async (ctx) => { ... });
export function withErrorHandling(handler, operationName) {
  return async (ctx) => {
    const startTime = Date.now();
    try {
      const response = await handler(ctx);
      const durationMs = Date.now() - startTime;
      const url = new URL(ctx.request.url);
      console.log(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'info',
          operation: operationName || url.pathname,
          method: ctx.request.method,
          path: url.pathname,
          status: response.status,
          durationMs,
        })
      );
      return response;
    } catch (err) {
      const durationMs = Date.now() - startTime;
      console.error(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'error',
          operation: operationName || 'API',
          message: err?.message || String(err),
          durationMs,
        })
      );
      return errorResponse(
        err?.userMessage || 'An unexpected error occurred',
        err?.statusCode || 500
      );
    }
  };
}

// ── Origin validation (CSRF protection for public endpoints) ─────────────
// Returns null if the origin is allowed, or an error Response if not.
export function validateOrigin(request, env) {
  const origin = request.headers.get('Origin') || '';
  const referer = request.headers.get('Referer') || '';
  const source = origin || referer;

  // Allow configured origins, or default to learningwithgioia.ch (+ legacy oiagi.org) + localhost
  const allowed = env.ALLOWED_ORIGINS
    ? env.ALLOWED_ORIGINS.split(',').map((s) => s.trim())
    : ['https://learningwithgioia.ch', 'https://oiagi.org', 'http://localhost'];

  if (!source) return errorResponse('Forbidden', 403);

  const isAllowed = allowed.some(
    (a) => source === a || source.startsWith(a + '/') || source.startsWith(a + ':')
  );
  if (!isAllowed) return errorResponse('Forbidden', 403);

  return null;
}

// ── Rate limiting (per-IP, via Cache API) ────────────────────────────────
// Returns null if under limit, or a 429 Response if exceeded.
// Uses Cloudflare's Cache API for lightweight per-colo rate state.
// Default: 5 requests per 60 seconds per IP per endpoint.
export async function checkRateLimit(request, { maxRequests = 5, windowSeconds = 60 } = {}) {
  try {
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const url = new URL(request.url);
    const cacheKey = `https://rate-limit.internal/${url.pathname}/${ip}`;
    const cache = caches.default;

    const cached = await cache.match(cacheKey);
    const count = cached ? parseInt(await cached.text(), 10) : 0;

    if (count >= maxRequests) {
      return new Response(JSON.stringify({ error: 'Too many requests. Please try again later.' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': String(windowSeconds) },
      });
    }

    const res = new Response(String(count + 1), {
      headers: { 'Cache-Control': `s-maxage=${windowSeconds}` },
    });
    await cache.put(cacheKey, res);
  } catch {
    // If cache API is unavailable (e.g. local dev), silently allow
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
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: teacher.refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch {
      parsed = {};
    }

    if (parsed.error === 'invalid_grant') {
      // Refresh token revoked or expired — clear stale tokens so the teacher
      // shows as "not authorised" and the admin knows to re-authenticate.
      await fetch(`${env.SUPABASE_URL}/rest/v1/teachers?id=eq.${teacher.id}`, {
        method: 'PATCH',
        headers: supabaseHeaders(env.SUPABASE_SERVICE_KEY),
        body: JSON.stringify({ access_token: null, refresh_token: null, token_expires_at: null }),
      });
      const err = new Error(
        'Google Calendar authorisation has expired for this teacher. Please re-authorise via the Teachers page.'
      );
      err.statusCode = 401;
      throw err;
    }

    if (parsed.error === 'invalid_client') {
      const detail = parsed.error_description ? ` Google says: ${parsed.error_description}` : '';
      const err = new Error(
        `Google OAuth credentials are invalid.${detail} Check GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the local/deployed environment, then re-authorise the teacher if the OAuth client changed.`
      );
      err.statusCode = 502;
      throw err;
    }

    const err = new Error(`Token refresh failed (${res.status}): ${body}`);
    err.statusCode = 502;
    throw err;
  }

  const tokens = await res.json();
  const expiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  await fetch(`${env.SUPABASE_URL}/rest/v1/teachers?id=eq.${teacher.id}`, {
    method: 'PATCH',
    headers: supabaseHeaders(env.SUPABASE_SERVICE_KEY),
    body: JSON.stringify({ access_token: tokens.access_token, token_expires_at: expiry }),
  });
  return tokens.access_token;
}
