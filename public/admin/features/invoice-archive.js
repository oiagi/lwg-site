/* ── Invoice Archive ─────────────────────────────────────────────── */
import { apiFetch } from '../core/api.js';
import { esc } from '../core/helpers.js';
import { openStornoModal } from './invoices.js';

const ARCHIVE_START_YEAR = 2024;
// Inert end states: no remind / mark-paid / delete / cancel on these rows.
const INERT_STATUSES = ['cancelled', 'storno'];
const REMINDABLE_STATUSES = ['sent', 'pending', 'unpaid', 'open', 'overdue', 'downloaded'];

// Status filters, in display order. `active` is the default: a cancellation
// produces two rows (the cancelled original and its storno credit note), which
// would otherwise dominate the list, so both are hidden until asked for.
const INVOICE_FILTERS = [
  { key: 'active', label: 'active', match: (f) => !isInert(f) },
  { key: 'open', label: 'awaiting payment', match: (f) => !isInert(f) && f.status !== 'paid' },
  { key: 'overdue', label: 'overdue', match: isOverdue },
  { key: 'paid', label: 'paid', match: (f) => f.status === 'paid' },
  { key: 'cancelled', label: 'cancelled', match: isInert },
  { key: 'all', label: 'all', match: () => true },
];
const DEFAULT_FILTER = 'active';

let activeYear = new Date().getFullYear();
let activeFilter = DEFAULT_FILTER;
let searchTerm = '';
let searchAttached = false;
// Every row of the currently loaded year, before filtering.
let currentFiles = [];
// Rows of the currently displayed year, keyed by invoice number (filename
// minus .pdf) — the cancel action needs the full row to prefill the modal.
let currentFilesByNumber = new Map();

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function isInert(file) {
  return INERT_STATUSES.includes(file.status);
}

// Past its due date and still owed. Cancelled/storno rows are never overdue,
// and 'overdue' rows already carry the status so they are not double-flagged.
function isOverdue(file) {
  return Boolean(
    !isInert(file) &&
    file.status !== 'paid' &&
    file.status !== 'overdue' &&
    file.due_date &&
    new Date(file.due_date) < new Date()
  );
}

function matchesSearch(file, term) {
  if (!term) return true;
  const haystack = [
    file.name?.replace(/\.pdf$/i, ''),
    file.student_name,
    file.course_code,
    file.course_subject,
    file.course_level,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(term);
}

// The whole visibility rule for one row: status filter AND search. Used both
// for the list itself and for the counts on the filter buttons, so a button
// can never promise a different number of rows than it shows.
export function matchesInvoiceFilter(file, filterKey, term = '') {
  const filter = INVOICE_FILTERS.find((f) => f.key === filterKey) || INVOICE_FILTERS[0];
  return filter.match(file) && matchesSearch(file, term.trim().toLowerCase());
}

function visibleFiles() {
  return currentFiles.filter((f) => matchesInvoiceFilter(f, activeFilter, searchTerm));
}

function renderStatusFilters() {
  const container = document.getElementById('archive-status-filters');
  if (!container) return;
  container.innerHTML = INVOICE_FILTERS.map((f) => {
    const count = currentFiles.filter((file) =>
      matchesInvoiceFilter(file, f.key, searchTerm)
    ).length;
    return `<button class="filter-btn${f.key === activeFilter ? ' active' : ''}" data-action="filterInvoices" data-args="${f.key}">${f.label} (${count})</button>`;
  }).join('');
}

function attachSearch() {
  if (searchAttached) return;
  const input = document.getElementById('invoice-search');
  if (!input) return;
  searchAttached = true;
  input.value = searchTerm;
  let timer = null;
  input.addEventListener('input', () => {
    searchTerm = input.value;
    clearTimeout(timer);
    timer = setTimeout(renderArchive, 200);
  });
}

// Re-renders from the already-loaded year — filtering never refetches.
function renderArchive() {
  renderStatusFilters();
  renderFiles(visibleFiles());
}

export function filterInvoices(status) {
  activeFilter = INVOICE_FILTERS.some((f) => f.key === status) ? status : DEFAULT_FILTER;
  renderArchive();
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
  const countEl = document.getElementById('archive-count');
  if (countEl) {
    countEl.textContent = currentFiles.length
      ? `${files.length} of ${currentFiles.length} invoice${currentFiles.length === 1 ? '' : 's'}`
      : '';
  }
  const container = document.getElementById('archive-list');
  if (!container) return;
  if (!files.length) {
    container.innerHTML = currentFiles.length
      ? '<div class="loading-state">No invoices match this filter.</div>'
      : '<div class="loading-state">No archived invoices for this year.</div>';
    return;
  }
  container.innerHTML = files
    .map((f) => {
      const name = esc(f.name.replace(/\.pdf$/i, ''));
      const date = esc(formatDate(f.created_at));
      const dueDate = f.due_date ? `due ${formatDate(f.due_date)}` : '';
      const student = esc(f.student_name || '—');
      const courseParts = [f.course_code, f.course_subject, f.course_level].filter(Boolean);
      const course = esc(courseParts.join(' - ') || '—');
      const amount =
        f.total_amount !== null && f.total_amount !== undefined
          ? esc(`${Number(f.total_amount).toFixed(2)} ${f.currency || 'CHF'}`)
          : '';
      const inert = isInert(f);
      const knownStatusClasses = ['draft', 'sent', 'paid', 'cancelled', 'storno', 'overdue'];
      const statusClass = knownStatusClasses.includes(f.status) ? f.status : 'draft';
      const statusLabel = esc(f.status || '—');
      const overdueFlag = isOverdue(f) ? `<span class="inv-status overdue">overdue</span>` : '';
      const reminderFlag = f.reminder_sent_at
        ? `<span class="inv-status reminder">reminded</span>`
        : '';
      const notifiedFlag =
        f.status === 'storno' && f.sent_at
          ? `<span class="inv-status reminder">notified ${esc(formatDate(f.sent_at))}</span>`
          : '';
      const canRemind = REMINDABLE_STATUSES.includes(f.status);
      const canMarkPaid = f.invoice_id && f.status !== 'paid' && !inert;
      const canCancel = f.invoice_id && !inert;
      const canDelete = !inert;
      const view = f.signed_url
        ? `<li><a class="status-opt-btn status-opt-btn--view" href="${esc(f.signed_url)}" target="_blank" rel="noopener noreferrer">view</a></li>`
        : `<li><span class="status-opt-btn status-opt-btn--disabled">unavailable</span></li>`;
      const remind = canRemind
        ? `<li><button class="status-opt-btn status-opt-btn--remind" data-action="sendInvoiceReminder" data-args="${name}">remind</button></li>`
        : '';
      const markPaid = canMarkPaid
        ? `<li><button class="status-opt-btn status-opt-btn--paid" data-action="markArchivedInvoicePaid" data-args="${esc(f.invoice_id)}">mark paid</button></li>`
        : '';
      const cancel = canCancel
        ? `<li><button class="status-opt-btn status-opt-btn--delete" data-action="cancelArchivedInvoice" data-args="${name}">cancel (storno)</button></li>`
        : '';
      const remove = canDelete
        ? `<li class="status-dropdown-divider"></li><li><button class="status-opt-btn status-opt-btn--delete" data-action="deleteInvoice" data-args="${name}">delete</button></li>`
        : '';
      const rowClass =
        f.status === 'storno'
          ? ' invoice-row--storno'
          : f.status === 'cancelled'
            ? ' invoice-row--cancelled'
            : '';
      return `
        <div class="invoice-row${rowClass}">
          <div class="invoice-summary">
            <span class="inv-number">${name}</span>
            <span class="inv-student">${student}</span>
            <span class="inv-course">${course}</span>
            <span class="inv-amount">${amount}</span>
            <span class="inv-date"><span>${date}</span>${dueDate ? `<span>${esc(dueDate)}</span>` : ''}</span>
            <span class="inv-status-wrap"><span class="inv-status ${statusClass}">${statusLabel}</span>${overdueFlag}${reminderFlag}${notifiedFlag}</span>
            <span class="inv-action">
              <span class="invoice-action-wrap">
                <button class="invoice-action-toggle" data-action="toggleInvoiceActions" data-args="${name}">view</button>
                <ul class="status-dropdown invoice-action-dropdown is-hidden" id="invoice-actions-${name}">
                  ${view}${remind}${markPaid}${cancel}${remove}
                </ul>
              </span>
            </span>
          </div>
        </div>`;
    })
    .join('');
}

export function cancelArchivedInvoice(invoiceNumber) {
  const row = currentFilesByNumber.get(invoiceNumber);
  if (!row) return;
  openStornoModal(row, () => loadInvoiceArchive(activeYear));
}

export async function loadInvoiceArchive(year) {
  year = year ? Number(year) : activeYear;
  activeYear = year;
  renderYearFilters(year);
  attachSearch();
  const container = document.getElementById('archive-list');
  if (container) container.innerHTML = '<div class="loading-state">loading…</div>';
  try {
    const res = await apiFetch(`/api/invoice-archive?year=${year}`);
    if (!res.ok) throw new Error(await res.text());
    const { files } = await res.json();
    currentFiles = files;
    // Keyed over every row, not just the visible ones, so the cancel action
    // still finds its row when the filter changes underneath it.
    currentFilesByNumber = new Map(files.map((f) => [f.name.replace(/\.pdf$/i, ''), f]));
    renderArchive();
  } catch (err) {
    console.error('Invoice archive load error:', err);
    currentFiles = [];
    currentFilesByNumber = new Map();
    if (container) container.innerHTML = '<div class="loading-state">Failed to load archive.</div>';
  }
}

export function switchArchiveYear(year) {
  loadInvoiceArchive(Number(year));
}

export function toggleInvoiceActions(invoiceNumber) {
  const drop = document.getElementById('invoice-actions-' + invoiceNumber);
  if (!drop) return;
  const isOpen = !drop.classList.contains('is-hidden');
  document.querySelectorAll('.status-dropdown').forEach((d) => {
    d.classList.add('is-hidden');
  });
  if (!isOpen) drop.classList.remove('is-hidden');
}

export async function sendInvoiceReminder(invoiceNumber, btn) {
  if (!invoiceNumber) return;
  if (!confirm(`Send payment reminder for ${invoiceNumber}?`)) return;
  const originalText = btn?.textContent || 'remind';
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'sending...';
  }
  try {
    const res = await apiFetch('/api/send-invoice-reminder', {
      method: 'POST',
      body: { invoice_number: invoiceNumber },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Could not send reminder');
    if (btn) btn.textContent = 'sent';
    if (body.reminder_recorded === false) {
      alert(
        'Reminder sent, but the reminder tag could not be saved yet. Apply the invoice reminder migration, then send again if you need the tag recorded.'
      );
    }
    await loadInvoiceArchive(activeYear);
  } catch (err) {
    console.error('Invoice reminder error:', err);
    alert(err.message || 'Could not send reminder.');
    if (btn) {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }
}

export async function markArchivedInvoicePaid(invoiceId, btn) {
  if (!invoiceId) return;
  if (!confirm('Mark this invoice as paid? This sends the payment-received email to the student.'))
    return;
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'saving...';
  }
  try {
    const res = await apiFetch('/api/mark-invoice-paid', {
      method: 'POST',
      body: { invoice_id: invoiceId },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Could not mark invoice paid');
    await loadInvoiceArchive(activeYear);
  } catch (err) {
    console.error('Mark invoice paid error:', err);
    alert(err.message || 'Could not mark invoice paid.');
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'mark paid';
    }
  }
}

export async function deleteInvoice(invoiceNumber, btn) {
  if (!invoiceNumber) return;
  const ok = confirm(
    `Delete invoice ${invoiceNumber}?\n\nThis removes the invoice from the archive and the invoice table. Use this only for mistakes or test invoices.`
  );
  if (!ok) return;
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'deleting...';
  }
  try {
    const res = await apiFetch(
      `/api/delete-invoice?invoice_number=${encodeURIComponent(invoiceNumber)}`,
      {
        method: 'DELETE',
      }
    );
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Could not delete invoice');
    await loadInvoiceArchive(activeYear);
  } catch (err) {
    console.error('Invoice delete error:', err);
    alert(err.message || 'Could not delete invoice.');
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'delete';
    }
  }
}
