// functions/api/auth/login.js
// GET /api/auth/login?teacher_id=<uuid>
//
// Initiates the Google OAuth flow for a teacher.
// Redirects to Google's consent screen requesting Calendar access.
// After consent, Google redirects to /api/auth/callback.
//
// Environment variables:
//   GOOGLE_CLIENT_ID     — OAuth client ID from Google Cloud Console
//   ADMIN_PASSWORD       — guards this endpoint from public access

export async function onRequestGet({ request, env }) {
  const GOOGLE_CLIENT_ID = env.GOOGLE_CLIENT_ID;
  const ADMIN_PASSWORD   = env.ADMIN_PASSWORD;

  // ── Password check ───────────────────────────────────────────────────
  const pwd = request.headers.get('x-admin-password');
  if (!pwd || pwd !== ADMIN_PASSWORD) {
    return new Response(JSON.stringify({ error: 'Unauthorised' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  const url        = new URL(request.url);
  const teacher_id = url.searchParams.get('teacher_id');

  if (!teacher_id) {
    return new Response(JSON.stringify({ error: 'Missing teacher_id' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  // Build Google OAuth URL
  // Scopes requested:
  //   calendar.events — create and read events
  //   calendar.readonly — read calendar metadata
  const params = new URLSearchParams({
    client_id:     GOOGLE_CLIENT_ID,
    redirect_uri:  'https://oiagi.org/api/auth/callback',
    response_type: 'code',
    scope:         'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly',
    access_type:   'offline',   // request refresh token
    prompt:        'consent',   // always show consent to ensure refresh token is issued
    state:         teacher_id,  // passed back in callback to identify which teacher
  });

  return Response.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
    302
  );
}
