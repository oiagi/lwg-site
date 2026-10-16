// functions/api/_materials.js
// Shared helpers for the PDF material library (private Storage bucket
// `materials`). Files are only ever touched with the service key on the
// server or through short-lived signed URLs it issues.

export const MATERIALS_BUCKET = 'materials';
export const MAX_MATERIAL_BYTES = 50 * 1024 * 1024; // keep in sync with the bucket's file_size_limit
export const SIGNED_URL_TTL = 3600;

// Storage keys: <uuid>/<sanitised file name>. The uuid folder keeps two
// uploads of "Kapitel 3.pdf" apart; the original name is kept in the row.
const FILE_PATH_RE = /^[0-9a-f-]{36}\/[\w.\- ]+\.pdf$/;

export function sanitiseFileName(name) {
  const base = String(name || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w.\- ]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(-150);
  return base && /\.pdf$/i.test(base) ? base.replace(/\.pdf$/i, '.pdf') : null;
}

export function isMaterialPath(path) {
  return typeof path === 'string' && FILE_PATH_RE.test(path);
}

export function storageHeaders(env, json = true) {
  const h = {
    Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
    apikey: env.SUPABASE_SERVICE_KEY,
  };
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

// Storage paths go into URLs segment by segment so spaces survive.
export function encodePath(path) {
  return path.split('/').map(encodeURIComponent).join('/');
}

export async function signDownloadUrl(env, path) {
  const res = await fetch(
    `${env.SUPABASE_URL}/storage/v1/object/sign/${MATERIALS_BUCKET}/${encodePath(path)}`,
    {
      method: 'POST',
      headers: storageHeaders(env),
      body: JSON.stringify({ expiresIn: SIGNED_URL_TTL }),
    }
  );
  if (!res.ok) throw new Error(`Storage sign failed: ${await res.text()}`);
  const { signedURL } = await res.json();
  return `${env.SUPABASE_URL}/storage/v1${signedURL}`;
}

export async function signUploadUrl(env, path) {
  const res = await fetch(
    `${env.SUPABASE_URL}/storage/v1/object/upload/sign/${MATERIALS_BUCKET}/${encodePath(path)}`,
    // Storage rejects a JSON content-type with an empty body, so send {}.
    { method: 'POST', headers: storageHeaders(env), body: '{}' }
  );
  if (!res.ok) throw new Error(`Storage upload sign failed: ${await res.text()}`);
  const { url } = await res.json();
  return `${env.SUPABASE_URL}/storage/v1${url}`;
}
