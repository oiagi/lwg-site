// functions/api/create-material-upload.js
// POST /api/create-material-upload
// Body: { file_name, size_bytes }
//
// First step of adding a PDF to the material library. Returns a short-lived
// signed upload URL so the browser can PUT the file straight into the private
// `materials` bucket (whole books are too large to proxy through a Worker),
// plus the storage path to pass to save-material.js once the upload is done.
// The bucket's own size and MIME limits back up the checks made here.
//
// Environment variables:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY, SUPABASE_ANON_KEY

import {
  requireAdminAuth,
  jsonResponse,
  errorResponse,
  withErrorHandling,
  parseJsonBody,
} from './_utils.js';
import { validate } from './_validate.js';
import { MAX_MATERIAL_BYTES, sanitiseFileName, signUploadUrl } from './_materials.js';

const SCHEMA = {
  file_name: { required: true, type: 'string', maxLength: 255 },
  size_bytes: { required: true, type: 'number' },
};

export const onRequestPost = withErrorHandling(async ({ request, env }) => {
  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  const { body, error } = await parseJsonBody(request);
  if (error) return error;

  const err = validate(body, SCHEMA);
  if (err) return errorResponse(err, 400);

  const safeName = sanitiseFileName(body.file_name);
  if (!safeName) return errorResponse('Nur PDF-Dateien sind erlaubt', 400);
  if (!(body.size_bytes > 0)) return errorResponse('Die Datei ist leer', 400);
  if (body.size_bytes > MAX_MATERIAL_BYTES) {
    return errorResponse('Die Datei ist zu gross (max. 50 MB)', 400);
  }

  const filePath = `${crypto.randomUUID()}/${safeName}`;
  try {
    const uploadUrl = await signUploadUrl(env, filePath);
    return jsonResponse({ upload_url: uploadUrl, file_path: filePath });
  } catch (e) {
    console.error('create-material-upload error:', e);
    return errorResponse('Upload konnte nicht vorbereitet werden', 502);
  }
}, 'create-material-upload');
