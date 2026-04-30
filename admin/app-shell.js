/* ── Shared admin shell: auth, login, event delegation, modals ────── */
import { initAuth, signIn, signOut, getSession } from './auth.js';
import { trapFocus, releaseFocus } from './helpers.js';

const actions = {};

export function registerActions(map) {
  Object.assign(actions, map);
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const fn = actions[el.dataset.action];
  if (!fn) return;
  e.stopPropagation();
  const args = el.dataset.args ? el.dataset.args.split(',') : [];
  fn(...args, el);
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const fn = actions[el.dataset.action];
  if (!fn) return;
  e.preventDefault();
  const args = el.dataset.args ? el.dataset.args.split(',') : [];
  fn(...args, el);
});

document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-action-change]');
  if (!el) return;
  const fn = actions[el.dataset.actionChange];
  if (!fn) return;
  const args = el.dataset.args ? el.dataset.args.split(',') : [];
  fn(...args);
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const openModals = document.querySelectorAll('.modal-overlay.open');
  if (!openModals.length) return;
  openModals[openModals.length - 1].classList.remove('open');
  releaseFocus();
});

const modalObserver = new MutationObserver((mutations) => {
  for (const m of mutations) {
    if (m.type !== 'attributes' || m.attributeName !== 'class') continue;
    const el = m.target;
    if (!el.classList.contains('modal-overlay')) continue;
    if (el.classList.contains('open')) {
      const modal = el.querySelector('.modal');
      if (modal) trapFocus(modal);
    } else {
      releaseFocus();
    }
  }
});

export function initAppShell({ onReady } = {}) {
  for (const overlay of document.querySelectorAll('.modal-overlay')) {
    modalObserver.observe(overlay, { attributes: true, attributeFilter: ['class'] });
  }

  function showDashboard() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';
    if (onReady) onReady();
  }

  const pwdInput = document.getElementById('admin-pwd');
  pwdInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('login-btn').click();
  });

  document.getElementById('login-btn').addEventListener('click', async () => {
    const email = document.getElementById('admin-email').value.trim();
    const pwd = document.getElementById('admin-pwd').value;
    if (!email || !pwd) return;
    try {
      await signIn(email, pwd);
      document.getElementById('pwd-error').style.display = 'none';
      showDashboard();
    } catch {
      document.getElementById('pwd-error').style.display = 'block';
    }
  });

  document.getElementById('logout-btn').addEventListener('click', async () => {
    await signOut();
    document.getElementById('dashboard').style.display = 'none';
    document.getElementById('login-screen').style.display = 'block';
    document.getElementById('admin-email').value = '';
    document.getElementById('admin-pwd').value = '';
  });

  // Strip ?auth=success / ?auth=error from URL after OAuth round-trip
  const p = new URLSearchParams(window.location.search);
  if (p.get('auth')) {
    p.delete('auth');
    const qs = p.toString();
    history.replaceState({}, '', window.location.pathname + (qs ? '?' + qs : ''));
  }

  (async function () {
    try {
      await initAuth();
      const session = await getSession();
      if (session) {
        showDashboard();
      }
    } catch (err) {
      console.error('Auth init failed:', err);
    }
  })();
}
