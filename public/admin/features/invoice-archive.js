/* ── Invoice Archive ─────────────────────────────────────────────── */
import { apiFetch } from '../core/api.js';
import { esc } from '../core/helpers.js';

const ARCHIVE_START_YEAR = 2024;
let activeYear = new Date().getFullYear();

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function renderYearFilters(year) {
  const container = document.getElementById('archive-year-filters');
  if (!container) return;
  const now = new Date().getFullYear();
  let html = '';
  for (let y = now; y >= ARCHIVE_START_YEAR; y--) {
    html += `<button class="filter-btn${y === year ? ' active' : ''}" data-action="switchArchiveYear" data-args="${y}">${y}</button>`;
  }
  container.innerHTML = html;
}

function renderFiles(files) {
  const container = document.getElementById('archive-list');
  if (!container) return;
  if (!files.length) {
    container.innerHTML = '<div class="loading-state">No archived invoices for this year.</div>';
    return;
  }
  container.innerHTML = files
    .map((f) => {
      const name = esc(f.name.replace(/\.pdf$/i, ''));
      const date = esc(formatDate(f.created_at));
      const amount =
        f.total_amount != null
          ? esc(`${Number(f.total_amount).toFixed(2)} ${f.currency || 'CHF'}`)
          : '';
      const statusClass = f.status === 'paid' ? 'paid' : f.status === 'sent' ? 'sent' : 'draft';
      const statusLabel = esc(f.status || '—');
      const isOverdue = f.status !== 'paid' && f.due_date && new Date(f.due_date) < new Date();
      const overdueFlag = isOverdue ? `<span class="inv-status overdue">overdue</span>` : '';
      const action = f.signed_url
        ? `<a class="action-btn" href="${esc(f.signed_url)}" target="_blank" rel="noopener noreferrer">download</a>`
        : `<span class="inv-status">unavailable</span>`;
      return `
        <div class="invoice-row">
          <div class="invoice-summary">
            <span class="inv-number">${name}</span>
            <span class="inv-amount">${amount}</span>
            <span class="inv-date">${date}</span>
            <span class="inv-status ${statusClass}">${statusLabel}</span>
            ${overdueFlag}
            <span style="text-align:right">${action}</span>
          </div>
        </div>`;
    })
    .join('');
}

export async function loadInvoiceArchive(year) {
  year = year ? Number(year) : activeYear;
  activeYear = year;
  renderYearFilters(year);
  const container = document.getElementById('archive-list');
  if (container) container.innerHTML = '<div class="loading-state">loading…</div>';
  try {
    const res = await apiFetch(`/api/invoice-archive?year=${year}`);
    if (!res.ok) throw new Error(await res.text());
    const { files } = await res.json();
    renderFiles(files);
  } catch (err) {
    console.error('Invoice archive load error:', err);
    if (container) container.innerHTML = '<div class="loading-state">Failed to load archive.</div>';
  }
}

export function switchArchiveYear(year) {
  loadInvoiceArchive(Number(year));
}
