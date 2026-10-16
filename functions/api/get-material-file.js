// functions/api/get-material-file.js
// GET /api/get-material-file?id=<uuid>
//
// Returns { url, file_name } where url is a 1-hour signed link to the PDF in
// the private `materials` bucket. The admin opens it in a new tab and appends
// #page=N so the browser's PDF viewer jumps to the referenced page.
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
import { signDownloadUrl } from './_materials.js';

export const onRequestGet = withErrorHandling(async ({ request, env }) => {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;

  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return errorResponse('id is required', 400);

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/materials?id=eq.${encodeURIComponent(id)}&select=file_path,file_name`,
    { headers: supabaseHeaders(SUPABASE_SERVICE_KEY) }
  );
  if (!res.ok) return errorResponse('Database error');
  const [material] = await res.json();
  if (!material) return errorResponse('Material not found', 404);

  try {
    const url = await signDownloadUrl(env, material.file_path);
    return jsonResponse({ url, file_name: material.file_name });
  } catch (e) {
    console.error('get-material-file sign error:', e);
    return errorResponse('Could not generate download link', 502);
  }
}, 'get-material-file');
