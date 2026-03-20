/* ── Supabase Auth wrapper ────────────────────────────────────────── */

let supabaseClient = null;

export async function initAuth() {
  const res = await fetch('/api/config');
  if (!res.ok) throw new Error('Failed to load config');
  const { supabaseUrl, supabaseAnonKey } = await res.json();
  supabaseClient = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
  return supabaseClient;
}

export function getClient() { return supabaseClient; }

export async function signIn(email, password) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabaseClient.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  return session;
}

export async function getAccessToken() {
  const session = await getSession();
  return session?.access_token ?? null;
}

export function onAuthStateChange(callback) {
  return supabaseClient.auth.onAuthStateChange(callback);
}
