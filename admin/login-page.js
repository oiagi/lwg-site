/* ── Admin login page ────────────────────────────────────────────────
   Lives at /admin (admin/index.html). If a session already exists
   (e.g. the browser kept it from a previous visit), bounce straight to
   the students page; otherwise show the login form.                   */

import { initAuth, signIn, getSession } from './auth.js';

const screen = document.getElementById('login-screen');

(async function () {
  try {
    await initAuth();
    const session = await getSession();
    if (session) {
      window.location.href = '/admin/students';
      return;
    }
  } catch (err) {
    console.error('Auth init failed:', err);
  }
  if (screen) screen.style.display = 'block';
})();

document.getElementById('admin-pwd').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('login-btn').click();
});

document.getElementById('login-btn').addEventListener('click', async () => {
  const email = document.getElementById('admin-email').value.trim();
  const pwd = document.getElementById('admin-pwd').value;
  if (!email || !pwd) return;
  try {
    await signIn(email, pwd);
    document.getElementById('pwd-error').style.display = 'none';
    window.location.href = '/admin/students';
  } catch {
    document.getElementById('pwd-error').style.display = 'block';
  }
});
