/* ── Shared formatters & DOM utilities ─────────────────────────────── */
import { MESSAGE_TIMEOUT_MS, LOCALE_DATETIME } from './constants.js';

export function esc(str) {
  if (!str && str !== 0) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(LOCALE_DATETIME, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function showMessage(el, text, ms = MESSAGE_TIMEOUT_MS) {
  el.textContent = text;
  el.style.display = 'inline';
  setTimeout(() => (el.style.display = 'none'), ms);
}

export function dl(key, val) {
  if (!val) return '';
  const v = Array.isArray(val) ? val.join(', ') : val;
  return `<div class="detail-row"><span class="detail-key">${esc(key)}</span><span class="detail-val">${esc(v)}</span></div>`;
}

export function queryString(params) {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null)
  ).toString();
  return qs ? '?' + qs : '';
}

function updateSortDirectionButton(button, direction) {
  button.dataset.dir = direction;
  button.textContent = direction === 'desc' ? '↓' : '↑';
  button.setAttribute('aria-label', direction === 'desc' ? 'Sort descending' : 'Sort ascending');
}

export function attachListControls({
  searchEl,
  sortEl,
  directionEl,
  state,
  defaults,
  onSearch,
  onChange,
}) {
  searchEl.value = state.search;
  sortEl.value = state.sort;
  updateSortDirectionButton(directionEl, state.direction);

  let searchTimer = null;
  searchEl.addEventListener('input', () => {
    state.search = searchEl.value.trim();
    clearTimeout(searchTimer);
    searchTimer = setTimeout(onSearch, 250);
  });
  sortEl.addEventListener('change', () => {
    state.sort = sortEl.value || defaults.sort;
    state.direction = state.sort === defaults.descendingSort ? 'desc' : 'asc';
    updateSortDirectionButton(directionEl, state.direction);
    onChange();
  });
  directionEl.addEventListener('click', () => {
    state.direction = state.direction === 'desc' ? 'asc' : 'desc';
    updateSortDirectionButton(directionEl, state.direction);
    onChange();
  });
}

/* ── Modal focus trap ──────────────────────────────────────────────── */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

let _trapCleanup = null;

export function trapFocus(modalEl) {
  releaseFocus(); // clean up any previous trap
  const focusable = () =>
    [...modalEl.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
  const handler = (e) => {
    if (e.key !== 'Tab') return;
    const els = focusable();
    if (!els.length) return;
    const first = els[0];
    const last = els[els.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
  modalEl.addEventListener('keydown', handler);
  _trapCleanup = () => modalEl.removeEventListener('keydown', handler);
  // Focus first focusable element
  const els = focusable();
  if (els.length) els[0].focus();
}

export function releaseFocus() {
  if (_trapCleanup) {
    _trapCleanup();
    _trapCleanup = null;
  }
}
