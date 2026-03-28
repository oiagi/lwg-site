/* ── Shared formatters & DOM utilities ─────────────────────────────── */

export function esc(str) {
  if (!str && str !== 0) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function fmt(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
}

export function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function dl(key, val) {
  if (!val) return '';
  const v = Array.isArray(val) ? val.join(', ') : val;
  return `<div class="detail-row"><span class="detail-key">${esc(key)}</span><span class="detail-val">${esc(v)}</span></div>`;
}

export function showSaved(id, duration = 2000) {
  const msg = document.getElementById(id);
  if (msg) {
    msg.style.display = 'inline';
    setTimeout(() => (msg.style.display = 'none'), duration);
  }
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
