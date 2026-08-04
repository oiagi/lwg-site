/* ── Invoice Archive ─────────────────────────────────────────────── */
import { apiFetch } from '../core/api.js';
import { esc } from '../core/helpers.js';

const ARCHIVE_START_YEAR = 2024;
let activeYear = new Date().getFullYear();
// 'active' lists everything still in play, 'cancelled' the voided invoices that
// keep their number and stay in the archive for the audit trail.
let activeView = 'active';
// Last payload for the active year, so switching view re-filters without refetching.
let loadedFiles = [];

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

function renderViewFilters(view) {
  document.getElementById('archive-view-active')?.classList.toggle('active', view === 'active');
  document
    .getElementById('archive-view-cancelled')
    ?.classList.toggle('active', view === 'cancelled');
}

function isCancelled(file) {
  return file.status === 'cancelled';
}

function findFile(invoiceNumber) {
  return loadedFiles.find((f) => f.name.replace(/\.pdf$/i, '') === invoiceNumber) || null;
}

function amountLabel(file) {
  if (file.total_amount === null || file.total_amount === undefined) return '';
  return `${Number(file.total_amount).toFixed(2)} ${file.currency || 'CHF'}`;
}

function renderFiles() {
  const container = document.getElementById('archive-list');
  if (!container) return;
  const files = loadedFiles.filter((f) =>
    activeView === 'cancelled' ? isCancelled(f) : !isCancelled(f)
  );
  if (!files.length) {
    const msg =
      activeView === 'cancelled'
        ? 'No cancelled invoices for this year.'
        : 'No archived invoices for this year.';
    container.innerHTML = `<div class="loading-state">${msg}</div>`;
    return;
  }
  container.innerHTML = files
    .map((f) => {
      const name = esc(f.name.replace(/\.pdf$/i, ''));
      const date = esc(formatDate(f.created_at));
      const cancelled = isCancelled(f);
      const dueDate = cancelled
        ? f.cancelled_at
          ? `cancelled ${formatDate(f.cancelled_at)}`
          : ''
        : f.due_date
          ? `due ${formatDate(f.due_date)}`
          : '';
      const student = esc(f.student_name || '—');
      const courseParts = [f.course_code, f.course_subject, f.course_level].filter(Boolean);
      const course = esc(courseParts.join(' - ') || '—');
      const amount = esc(amountLabel(f));
      const knownStatusClasses = ['draft', 'sent', 'paid', 'cancelled', 'overdue'];
      const statusClass = knownStatusClasses.includes(f.status) ? f.status : 'draft';
      const statusLabel = esc(f.status || '—');
      // A cancelled invoice is never chased, so overdue/reminder flags are dropped.
      const isOverdue =
        !cancelled &&
        f.status !== 'paid' &&
        f.status !== 'overdue' &&
        f.due_date &&
        new Date(f.due_date) < new Date();
      const overdueFlag = isOverdue ? `<span class="inv-status overdue">overdue</span>` : '';
      const reminderFlag =
        !cancelled && f.reminder_sent_at ? `<span class="inv-status reminder">reminded</span>` : '';
      const notifiedFlag =
        cancelled && f.cancellation_notified_at
          ? `<span class="inv-status reminder">notified</span>`
          : '';
      const canRemind =
        !cancelled &&
        ['sent', 'pending', 'unpaid', 'open', 'overdue', 'downloaded'].includes(f.status);
      const canMarkPaid = !cancelled && f.invoice_id && f.status !== 'paid';
      const view = f.signed_url
        ? `<li><a class="status-opt-btn status-opt-btn--view" href="${esc(f.signed_url)}" target="_blank" rel="noopener noreferrer">view</a></li>`
        : `<li><span class="status-opt-btn status-opt-btn--disabled">unavailable</span></li>`;
      const remind = canRemind
        ? `<li><button class="status-opt-btn status-opt-btn--remind" data-action="sendInvoiceReminder" data-args="${name}">remind</button></li>`
        : '';
      const markPaid = canMarkPaid
        ? `<li><button class="status-opt-btn status-opt-btn--paid" data-action="markArchivedInvoicePaid" data-args="${esc(f.invoice_id)}">mark paid</button></li>`
        : '';
      // Cancelling voids the invoice but keeps it; deleting is only offered once
      // it is cancelled, matching what /api/delete-invoice now accepts.
      const cancel = cancelled
        ? ''
        : `<li class="status-dropdown-divider"></li><li><button class="status-opt-btn status-opt-btn--delete" data-action="openCancelInvoiceModal" data-args="${name}">cancel</button></li>`;
      const remove = cancelled
        ? `<li class="status-dropdown-divider"></li><li><button class="status-opt-btn status-opt-btn--delete" data-action="deleteInvoice" data-args="${name}">delete</button></li>`
        : '';
      return `
        <div class="invoice-row">
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

export async function loadInvoiceArchive(year) {
  year = year ? Number(year) : activeYear;
  activeYear = year;
  renderYearFilters(year);
  renderViewFilters(activeView);
  const container = document.getElementById('archive-list');
  if (container) container.innerHTML = '<div class="loading-state">loading…</div>';
  try {
    const res = await apiFetch(`/api/invoice-archive?year=${year}`);
    if (!res.ok) throw new Error(await res.text());
    const { files } = await res.json();
    loadedFiles = files || [];
    renderFiles();
  } catch (err) {
    console.error('Invoice archive load error:', err);
    loadedFiles = [];
    if (container) container.innerHTML = '<div class="loading-state">Failed to load archive.</div>';
  }
}

export function switchArchiveYear(year) {
  loadInvoiceArchive(Number(year));
}

export function switchArchiveView(view) {
  activeView = view === 'cancelled' ? 'cancelled' : 'active';
  renderViewFilters(activeView);
  renderFiles();
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

/* ── Cancel invoice ──────────────────────────────────────────────── */

export function openCancelInvoiceModal(invoiceNumber) {
  if (!invoiceNumber) return;
  const modal = document.getElementById('cancel-invoice-modal');
  if (!modal) return;

  document.getElementById('cancel-inv-number').value = invoiceNumber;

  const file = findFile(invoiceNumber);
  const summary = document.getElementById('cancel-inv-summary');
  if (summary) {
    const parts = [invoiceNumber, file?.student_name, amountLabel(file || {})].filter(Boolean);
    summary.textContent = parts.join(' · ');
  }

  const notify = document.getElementById('cancel-inv-notify');
  if (notify) notify.checked = false;

  const msg = document.getElementById('cancel-inv-msg');
  if (msg) {
    msg.classList.remove('is-visible-block');
    msg.textContent = '';
  }
  const btn = document.getElementById('cancel-inv-submit');
  if (btn) {
    btn.disabled = false;
    btn.textContent = 'cancel invoice';
  }

  modal.classList.add('open');
}

export function closeCancelInvoiceModal() {
  document.getElementById('cancel-invoice-modal')?.classList.remove('open');
}

export async function submitCancelInvoice() {
  const invoiceNumber = document.getElementById('cancel-inv-number')?.value || '';
  if (!invoiceNumber) return;
  const notify = document.getElementById('cancel-inv-notify')?.checked === true;
  const btn = document.getElementById('cancel-inv-submit');
  const msg = document.getElementById('cancel-inv-msg');
  if (msg) {
    msg.classList.remove('is-visible-block');
    msg.textContent = '';
  }
  if (btn) {
    btn.disabled = true;
    btn.textContent = notify ? 'cancelling & emailing...' : 'cancelling...';
  }
  try {
    const res = await apiFetch('/api/cancel-invoice', {
      method: 'POST',
      body: { invoice_number: invoiceNumber, notify },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Could not cancel invoice');
    if (body.cancellation_recorded === false) {
      alert(
        'Invoice cancelled, but the cancellation date could not be saved yet. Apply the invoice cancellation migration to record it.'
      );
    }
    closeCancelInvoiceModal();
    await loadInvoiceArchive(activeYear);
  } catch (err) {
    console.error('Cancel invoice error:', err);
    if (msg) {
      msg.textContent = err.message || 'Could not cancel invoice.';
      msg.className = 'modal-msg err';
      msg.classList.add('is-visible-block');
    }
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'cancel invoice';
    }
  }
}

export async function deleteInvoice(invoiceNumber, btn) {
  if (!invoiceNumber) return;
  const ok = confirm(
    `Delete invoice ${invoiceNumber}?\n\nThis permanently removes the invoice from the archive and the invoice table. Use this only for mistakes or test invoices.`
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
