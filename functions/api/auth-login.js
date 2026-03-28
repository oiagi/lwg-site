// functions/api/auth/login.js
// GET /api/auth/login?teacher_id=<uuid>&token=<supabase_jwt>
//
// Initiates the Google OAuth flow for a teacher.
// Redirects to Google's consent screen requesting Calendar access.
// After consent, Google redirects to /api/auth/callback.
//
// Token is passed as a query parameter because this endpoint is
// opened in a browser popup window which cannot send custom headers.
//
// Environment variables:
//   GOOGLE_CLIENT_ID — OAuth client ID from Google Cloud Console
//   SUPABASE_URL     — Supabase project URL (for JWT verification)

import { verifySupabaseToken } from './_utils.js';

export async function onRequestGet({ request, env }) {
  const GOOGLE_CLIENT_ID = env.GOOGLE_CLIENT_ID;

  const url = new URL(request.url);
  const teacher_id = url.searchParams.get('teacher_id');

  // ── JWT check (via query param for popup compatibility) ──────────────
  const token = url.searchParams.get('token');
  const user = await verifySupabaseToken(token, env);
  if (!user) {
    return new Response('Unauthorised', { status: 401 });
  }

  if (!teacher_id) {
    return new Response('Missing teacher_id', { status: 400 });
  }

  // ── Build Google OAuth URL ────────────────────────────────────────────
  // Scopes requested:
  //   calendar.events   — create and manage events
  //   calendar.readonly — read calendar metadata
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: 'https://oiagi.org/api/auth-callback',
    response_type: 'code',
    scope:
      'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly',
    access_type: 'offline', // request refresh token for long-lived access
    prompt: 'consent', // always show consent to ensure refresh token is issued
    state: teacher_id, // passed back in callback to identify which teacher
  });

  return Response.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`, 302);
}
