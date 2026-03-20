/* ── Shared API helper & password management ──────────────────────── */
let adminPassword = '';

export function getPassword() { return adminPassword; }
export function setPassword(pwd) { adminPassword = pwd; }

export async function apiFetch(path, opts = {}) {
  const { method = 'GET', body, headers = {} } = opts;
  const init = {
    method,
    headers: {
      'x-admin-password': adminPassword,
      ...headers,
    },
  };
  if (body) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  return fetch(path, init);
}
