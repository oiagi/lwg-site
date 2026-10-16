// functions/api/save-material.js
// POST /api/save-material
// Body (create, after the upload finished):
//   { title, description?, file_path, file_name, size_bytes }
// Body (edit):
//   { id, title?, description?, archived? }
//
// Registers an uploaded PDF in the material library, or edits its title,
// description and archive state. The file itself never changes after upload.
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
import { isMaterialPath } from './_materials.js';

const SCHEMA = {
  id: { type: 'string' },
  title: { type: 'string', maxLength: 200 },
  description: { type: 'string', maxLength: 2000 },
  file_path: { type: 'string', maxLength: 255 },
  file_name: { type: 'string', maxLength: 255 },
  size_bytes: { type: 'number' },
  archived: { type: 'boolean' },
};

export const onRequestPost = withErrorHandling(async ({ request, env }) => {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;

  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  const { body, error } = await parseJsonBody(request);
  if (error) return error;

  const err = validate(body, SCHEMA);
  if (err) return errorResponse(err, 400);

  const data = {};
  if (body.title !== undefined) {
    data.title = String(body.title).trim();
    if (!data.title) return errorResponse('title must not be empty', 400);
  }
  if (body.description !== undefined) data.description = String(body.description).trim() || null;
  if (body.archived !== undefined) data.archived = body.archived;

  const H = { ...supabaseHeaders(SUPABASE_SERVICE_KEY), Prefer: 'return=representation' };
  let res;

  if (body.id) {
    if (!Object.keys(data).length) return errorResponse('Nothing to update', 400);
    res = await fetch(`${SUPABASE_URL}/rest/v1/materials?id=eq.${encodeURIComponent(body.id)}`, {
      method: 'PATCH',
      headers: H,
      body: JSON.stringify(data),
    });
  } else {
    if (!data.title) return errorResponse('title is required', 400);
    if (!isMaterialPath(body.file_path)) return errorResponse('Invalid file_path', 400);
    if (!body.file_name) return errorResponse('file_name is required', 400);
    res = await fetch(`${SUPABASE_URL}/rest/v1/materials`, {
      method: 'POST',
      headers: H,
      body: JSON.stringify({
        ...data,
        file_path: body.file_path,
        file_name: body.file_name,
        size_bytes: body.size_bytes ?? null,
        content_type: 'application/pdf',
      }),
    });
  }

  if (res.status === 409) return errorResponse('Datei ist bereits registriert', 409);
  if (!res.ok) {
    console.error('save-material error:', await res.text());
    return errorResponse('Database error');
  }
  const rows = await res.json();
  if (!rows.length) return errorResponse('Material not found', 404);
  return jsonResponse(rows[0]);
}, 'save-material');
