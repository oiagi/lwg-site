// functions/api/get-topics.js
// GET /api/get-topics
// GET /api/get-topics?include_archived=1
//
// Returns the grammar / vocabulary tags that can be attached to a logged
// session, sorted by kind then name. Archived tags are left out unless
// include_archived=1 (the Materialien tab shows them to restore).
//
// Environment variables:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY, SUPABASE_ANON_KEY

import {
  supabaseHeaders,
  requireAdminAuth,
  jsonResponse,
  errorResponse,
  withErrorHandling,
} from './_utils.js';

export const onRequestGet = withErrorHandling(async ({ request, env }) => {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;

  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  const url = new URL(request.url);
  const includeArchived = url.searchParams.get('include_archived') === '1';
  const filter = includeArchived ? '' : '&archived=eq.false';

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/topics?select=id,kind,name,archived&order=kind.asc,name.asc${filter}`,
    { headers: supabaseHeaders(SUPABASE_SERVICE_KEY) }
  );
  if (!res.ok) {
    console.error('get-topics error:', await res.text());
    return errorResponse('Database error');
  }
  return jsonResponse(await res.json());
}, 'get-topics');
