// Public endpoint: returns Supabase config needed by the frontend.
// Both values are designed to be public (anon key enforces RLS, not secrecy).

export async function onRequestGet({ env }) {
  return new Response(
    JSON.stringify({
      supabaseUrl: env.SUPABASE_URL,
      supabaseAnonKey: env.SUPABASE_ANON_KEY,
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
