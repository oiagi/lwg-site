// functions/api/delete-material.js
// POST /api/delete-material
// Body: { id }
//
// Removes a PDF from the material library: the Storage object first, then the
// row. Refused with 409 while any logged session references the material
// (archive it instead), so lesson history never points at a missing file.
//
// Environment variables:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY, SUPABASE_ANON_KEY

import {
  supabaseHeaders,
  requireAdminAuth,
  jsonResponse,
  errorResponse,
  withErrorHandling,
  parseJsonBody,
} from './_utils.js';
import { validate } from './_validate.js';
import { MATERIALS_BUCKET, encodePath, storageHeaders } from './_materials.js';

const SCHEMA = { id: { required: true, type: 'string' } };

export const onRequestPost = withErrorHandling(async ({ request, env }) => {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;

  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  const { body, error } = await parseJsonBody(request);
  if (error) return error;
  const err = validate(body, SCHEMA);
  if (err) return errorResponse(err, 400);

  const H = supabaseHeaders(SUPABASE_SERVICE_KEY);
  const id = encodeURIComponent(body.id);

  const [matRes, useRes] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/materials?id=eq.${id}&select=id,file_path`, { headers: H }),
    fetch(`${SUPABASE_URL}/rest/v1/session_materials?material_id=eq.${id}&select=id&limit=1`, {
      headers: H,
    }),
  ]);
  if (!matRes.ok || !useRes.ok) return errorResponse('Database error');
  const [material] = await matRes.json();
  if (!material) return errorResponse('Material not found', 404);
  if ((await useRes.json()).length) {
    return errorResponse('Material wird in Lektionen verwendet. Bitte archivieren.', 409);
  }

  const objRes = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${MATERIALS_BUCKET}/${encodePath(material.file_path)}`,
    { method: 'DELETE', headers: storageHeaders(env, false) }
  );
  // 404: the upload never finished or the file is already gone; the row can still go.
  if (!objRes.ok && objRes.status !== 404) {
    console.error('delete-material storage error:', await objRes.text());
    return errorResponse('Datei konnte nicht gelöscht werden', 502);
  }

  const delRes = await fetch(`${SUPABASE_URL}/rest/v1/materials?id=eq.${id}`, {
    method: 'DELETE',
    headers: H,
  });
  if (!delRes.ok) {
    console.error('delete-material row error:', await delRes.text());
    return errorResponse('Database error');
  }
  return jsonResponse({ success: true });
}, 'delete-material');
