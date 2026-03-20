/* ── Shared formatters & DOM utilities ─────────────────────────────── */

export function fmt(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
}

export function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('de-CH', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function dl(key, val) {
  if (!val) return '';
  const v = Array.isArray(val) ? val.join(', ') : val;
  return `<div class="detail-row"><span class="detail-key">${key}</span><span class="detail-val">${v}</span></div>`;
}

export function showSaved(id, duration = 2000) {
  const msg = document.getElementById(id);
  if (msg) {
    msg.style.display = 'inline';
    setTimeout(() => msg.style.display = 'none', duration);
  }
}
