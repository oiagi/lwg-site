/* ── Shared dashboard shell ───────────────────────────────────────────
   Used by every admin/*-page.js entry: handles auth gating, the
   data-action event delegation registry, the logout button, modal
   focus-trap + Escape handling.                                       */

import { initAuth, signOut, getSession } from './auth.js';
import { trapFocus, releaseFocus } from './helpers.js';

const actions = {};

export function registerActions(obj) {
  Object.assign(actions, obj);
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const fn = actions[el.dataset.action];
  if (!fn) return;
  const args = el.dataset.args ? el.dataset.args.split(',') : [];
  e.stopPropagation();
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

function observeModals() {
  for (const overlay of document.querySelectorAll('.modal-overlay')) {
    modalObserver.observe(overlay, { attributes: true, attributeFilter: ['class'] });
  }
}

function wireLogout() {
  const btn = document.getElementById('logout-btn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    try {
      await signOut();
    } finally {
      window.location.href = '/admin';
    }
  });
}

/* ── Entry point: every page entry awaits this before loading data ── */
export async function initDashboard() {
  try {
    await initAuth();
    const session = await getSession();
    if (!session) {
      window.location.href = '/admin';
      return false;
    }
  } catch (err) {
    console.error('Auth init failed:', err);
    window.location.href = '/admin';
    return false;
  }
  observeModals();
  wireLogout();
  const dashboard = document.getElementById('dashboard');
  if (dashboard) dashboard.style.display = 'block';
  return true;
}
