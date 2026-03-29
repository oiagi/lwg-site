// Public endpoint: returns Supabase config needed by the frontend.
// Both values are designed to be public (anon key enforces RLS, not secrecy).

import { withErrorHandling } from './_utils.js';

export const onRequestGet = withErrorHandling(async ({ env }) => {
  return new Response(
    JSON.stringify({
      supabaseUrl: env.SUPABASE_URL,
      supabaseAnonKey: env.SUPABASE_ANON_KEY,
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
}, 'config');
