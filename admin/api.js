/* ── Shared API helper ────────────────────────────────────────────── */
import { getAccessToken } from './auth.js';

export async function apiFetch(path, opts = {}) {
  const { method = 'GET', body, headers = {} } = opts;
  const token = await getAccessToken();
  const init = {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      ...headers,
    },
  };
  if (body) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  return fetch(path, init);
}
