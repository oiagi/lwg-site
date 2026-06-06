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
      const dueDate = f.due_date ? `due ${formatDate(f.due_date)}` : '';
      const student = esc(f.student_name || '—');
      const courseParts = [f.course_code, f.course_subject, f.course_level].filter(Boolean);
      const course = esc(courseParts.join(' - ') || '—');
      const amount =
        f.total_amount !== null && f.total_amount !== undefined
          ? esc(`${Number(f.total_amount).toFixed(2)} ${f.currency || 'CHF'}`)
          : '';
      const knownStatusClasses = ['draft', 'sent', 'paid', 'cancelled', 'overdue'];
      const statusClass = knownStatusClasses.includes(f.status) ? f.status : 'draft';
      const statusLabel = esc(f.status || '—');
      const isOverdue =
        f.status !== 'paid' &&
        f.status !== 'overdue' &&
        f.due_date &&
        new Date(f.due_date) < new Date();
      const overdueFlag = isOverdue ? `<span class="inv-status overdue">overdue</span>` : '';
      const reminderFlag = f.reminder_sent_at
        ? `<span class="inv-status reminder">reminded</span>`
        : '';
      const canRemind = ['sent', 'pending', 'unpaid', 'open', 'overdue'].includes(f.status);
      const view = f.signed_url
        ? `<li><a class="status-opt-btn status-opt-btn--view" href="${esc(f.signed_url)}" target="_blank" rel="noopener noreferrer">view</a></li>`
        : `<li><span class="status-opt-btn status-opt-btn--disabled">unavailable</span></li>`;
      const remind = canRemind
        ? `<li><button class="status-opt-btn status-opt-btn--remind" data-action="sendInvoiceReminder" data-args="${name}">remind</button></li>`
        : '';
      const remove = `<li class="status-dropdown-divider"></li><li><button class="status-opt-btn status-opt-btn--delete" data-action="deleteInvoice" data-args="${name}">delete</button></li>`;
      return `
        <div class="invoice-row">
          <div class="invoice-summary">
            <span class="inv-number">${name}</span>
            <span class="inv-student">${student}</span>
            <span class="inv-course">${course}</span>
            <span class="inv-amount">${amount}</span>
            <span class="inv-date"><span>${date}</span>${dueDate ? `<span>${esc(dueDate)}</span>` : ''}</span>
            <span class="inv-status-wrap"><span class="inv-status ${statusClass}">${statusLabel}</span>${overdueFlag}${reminderFlag}</span>
            <span class="inv-action">
              <span class="invoice-action-wrap">
                <button class="invoice-action-toggle" data-action="toggleInvoiceActions" data-args="${name}">view</button>
                <ul class="status-dropdown invoice-action-dropdown is-hidden" id="invoice-actions-${name}">
                  ${view}${remind}${remove}
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
