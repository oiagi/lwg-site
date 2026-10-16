// functions/api/get-materials.js
// GET /api/get-materials
// GET /api/get-materials?include_archived=1
//
// Lists the PDF material library, newest first, with `usage_count`: how many
// session references point at each material. A material in use cannot be
// deleted, only archived.
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

const SELECT =
  'id,title,description,file_name,size_bytes,archived,created_at,session_materials(count)';

export const onRequestGet = withErrorHandling(async ({ request, env }) => {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;

  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  const url = new URL(request.url);
  const filter = url.searchParams.get('include_archived') === '1' ? '' : '&archived=eq.false';

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/materials?select=${SELECT}&order=created_at.desc${filter}`,
    { headers: supabaseHeaders(SUPABASE_SERVICE_KEY) }
  );
  if (!res.ok) {
    console.error('get-materials error:', await res.text());
    return errorResponse('Database error');
  }
  const rows = await res.json();
  return jsonResponse(
    rows.map(({ session_materials: usage, ...m }) => ({
      ...m,
      usage_count: usage?.[0]?.count ?? 0,
    }))
  );
}, 'get-materials');
