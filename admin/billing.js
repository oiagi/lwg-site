/* ── Billing / Invoices tab ───────────────────────────────────────── */
import { apiFetch } from './api.js';
import { esc } from './helpers.js';

let currentInvoiceFilter = 'all';
let invoiceCompanyCache = null;
let invoiceStudentCache = null;
let invoiceSessionsCache = [];
let invoiceMode = 'company'; // 'company' or 'student'

export function getCurrentInvoiceFilter() {
  return currentInvoiceFilter;
}

export function filterInvoices(status) {
  currentInvoiceFilter = status;
  document.querySelectorAll('[data-inv-status]').forEach((b) => {
    b.classList.toggle('active', b.dataset.invStatus === status);
  });
  loadInvoices(status);
}

export async function loadInvoices(status = 'all') {
  const list = document.getElementById('invoice-list');
  if (!list.querySelector('.invoice-row')) {
    list.innerHTML = '<div class="loading-state">loading…</div>';
  }
  try {
    const qs = status !== 'all' ? `?status=${status}` : '';
    const res = await apiFetch('/api/get-invoices' + qs);
    if (!res.ok) throw new Error();
    const invoices = await res.json();
    renderInvoices(invoices);
  } catch {
    list.innerHTML = '<div class="loading-state">Could not load invoices.</div>';
  }
}

function renderInvoices(invoices) {
  const list = document.getElementById('invoice-list');
  if (!invoices.length) {
    list.innerHTML = '<div class="empty-state">no invoices found</div>';
    return;
  }

  list.innerHTML = invoices
    .map(
      (inv) => `
    <div class="invoice-row" data-action="openInvoiceDetail" data-args="${inv.id}">
      <div class="invoice-summary">
        <span class="inv-number">${esc(inv.invoice_number)}</span>
        <span class="inv-company">${esc(inv.billed_to || inv.company_name) || '—'}</span>
        <span class="inv-amount">${esc(inv.currency)} ${parseFloat(inv.total_amount).toFixed(2)}</span>
        <span class="inv-date">${esc(inv.issued_date) || '—'}</span>
        <span class="inv-status ${esc(inv.status)}">${esc(inv.status)}</span>
      </div>
    </div>
  `
    )
    .join('');
}

/* ── Invoice detail modal ──────────────────────────────────────────── */
export async function openInvoiceDetail(invoiceId) {
  document.getElementById('inv-detail-title').textContent = 'loading…';
  document.getElementById('inv-detail-content').innerHTML =
    '<div class="loading-state">loading…</div>';
  document.getElementById('invoice-detail-modal').classList.add('open');

  try {
    const res = await apiFetch('/api/get-invoice-detail?id=' + invoiceId);
    if (!res.ok) throw new Error();
    const inv = await res.json();

    document.getElementById('inv-detail-title').textContent = inv.invoice_number;

    const linesHtml = (inv.lines || [])
      .map(
        (l) => `
      <div style="display:grid;grid-template-columns:1fr 40px 70px 70px;gap:0.5rem;padding:0.3rem 0;border-bottom:1px solid #f0f0f0;font-size:0.78rem;">
        <span style="color:#555;">${esc(l.description)}</span>
        <span style="color:#888;text-align:right;">${l.quantity}</span>
        <span style="color:#888;text-align:right;">${parseFloat(l.unit_price).toFixed(2)}</span>
        <span style="color:#1a1a1a;text-align:right;">${parseFloat(l.line_total).toFixed(2)}</span>
      </div>
    `
      )
      .join('');

    const billedTo = inv.billed_to || {};
    const billedLabel = inv.student_id ? 'Student' : 'Company';
    const netAmt = parseFloat(inv.net_amount).toFixed(2);
    const vatAmt = parseFloat(inv.vat_amount).toFixed(2);
    const totalAmt = parseFloat(inv.total_amount).toFixed(2);

    document.getElementById('inv-detail-content').innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1.2rem;">
        <div>
          <p style="font-size:0.68rem;letter-spacing:0.14em;text-transform:uppercase;color:#aaa;margin-bottom:0.4rem;">details</p>
          <p style="font-size:0.82rem;color:#555;line-height:1.8;">
            ${billedLabel}: ${esc(billedTo.name) || '—'}<br>
            Date: ${esc(inv.issued_date)}<br>
            Due: ${esc(inv.due_date)}<br>
            Status: <strong>${esc(inv.status)}</strong>
          </p>
        </div>
        <div>
          <p style="font-size:0.68rem;letter-spacing:0.14em;text-transform:uppercase;color:#aaa;margin-bottom:0.4rem;">payment</p>
          <p style="font-size:0.82rem;color:#555;line-height:1.8;">
            QR-IBAN: ${esc(inv.qr_iban) || '—'}<br>
            QR Ref: ${esc(inv.qr_reference_formatted) || '—'}<br>
            Currency: ${esc(inv.currency)}
          </p>
        </div>
      </div>

      <p style="font-size:0.68rem;letter-spacing:0.14em;text-transform:uppercase;color:#aaa;margin-bottom:0.6rem;">line items</p>
      <div style="display:grid;grid-template-columns:1fr 40px 70px 70px;gap:0.5rem;padding:0.3rem 0;border-bottom:1px solid #ccc;font-size:0.68rem;color:#aaa;text-transform:uppercase;letter-spacing:0.08em;">
        <span>Description</span><span style="text-align:right;">Qty</span><span style="text-align:right;">Price</span><span style="text-align:right;">Total</span>
      </div>
      ${linesHtml}

      <div style="margin-top:0.8rem;text-align:right;font-size:0.85rem;line-height:1.8;">
        <span style="color:#888;">Net: ${inv.currency} ${netAmt}</span><br>
        ${inv.vat_rate ? `<span style="color:#888;">VAT (${inv.vat_rate}%): ${inv.currency} ${vatAmt}</span><br>` : ''}
        <strong>Total: ${inv.currency} ${totalAmt}</strong>
      </div>

      ${inv.notes ? `<p style="font-size:0.78rem;color:#888;margin-top:1rem;">${esc(inv.notes)}</p>` : ''}

      ${
        inv.linked_students && inv.linked_students.length
          ? `<div style="margin-top:1rem;">
          <p style="font-size:0.68rem;letter-spacing:0.14em;text-transform:uppercase;color:#aaa;margin-bottom:0.4rem;">students</p>
          ${inv.linked_students
            .map(
              (s) =>
                `<span style="display:inline-block;font-size:0.78rem;color:#555;margin-right:1rem;">${esc(s.first_name)} ${esc(s.last_name)}</span>`
            )
            .join('')}
        </div>`
          : ''
      }

      <div style="display:flex;gap:0.5rem;margin-top:1.4rem;flex-wrap:wrap;">
        <button class="save-btn" data-action="downloadInvoicePdf" data-args="${inv.id},${inv.invoice_number}">download PDF</button>
        ${inv.status === 'draft' ? `<button class="action-btn" data-action="updateInvoiceStatus" data-args="${inv.id},sent">mark sent</button>` : ''}
        ${inv.status === 'sent' ? `<button class="log-btn" data-action="updateInvoiceStatus" data-args="${inv.id},paid">mark paid</button>` : ''}
        ${inv.status !== 'cancelled' && inv.status !== 'paid' ? `<button class="cancel-btn" data-action="updateInvoiceStatus" data-args="${inv.id},cancelled">cancel</button>` : ''}
      </div>
    `;
  } catch {
    document.getElementById('inv-detail-content').innerHTML =
      '<p style="color:#c0392b;">Could not load invoice.</p>';
  }
}

export function closeInvoiceDetailModal() {
  document.getElementById('invoice-detail-modal').classList.remove('open');
}

export async function updateInvoiceStatus(invoiceId, newStatus) {
  if (newStatus === 'cancelled' && !confirm('Cancel this invoice?')) return;
  try {
    const res = await apiFetch('/api/update-invoice', {
      method: 'PATCH',
      body: { id: invoiceId, status: newStatus },
    });
    if (!res.ok) throw new Error();
    closeInvoiceDetailModal();
    loadInvoices(currentInvoiceFilter);
  } catch {
    alert('Could not update invoice status.');
  }
}

export async function downloadInvoicePdf(invoiceId, invoiceNumber) {
  try {
    const res = await apiFetch('/api/generate-invoice-pdf?id=' + invoiceId);
    if (!res.ok) throw new Error();
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (invoiceNumber || 'invoice') + '.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch {
    alert('Could not download PDF.');
  }
}

/* ── Create invoice modal ──────────────────────────────────────────── */

export function switchInvoiceMode(mode) {
  invoiceMode = mode;
  const companyField = document.getElementById('inv-company-field');
  const studentField = document.getElementById('inv-student-field');
  const sessDiv = document.getElementById('inv-sessions');

  document.querySelectorAll('[data-inv-mode]').forEach((b) => {
    b.classList.toggle('active', b.dataset.invMode === mode);
  });

  if (mode === 'company') {
    companyField.style.display = 'block';
    studentField.style.display = 'none';
    document.getElementById('inv-student').value = '';
  } else {
    companyField.style.display = 'none';
    studentField.style.display = 'block';
    document.getElementById('inv-company').value = '';
  }

  sessDiv.innerHTML = `<p style="font-size:0.78rem;color:#aaa;">Select a ${mode} first.</p>`;
  document.getElementById('inv-total-preview').textContent = 'Total: —';
}

export async function openCreateInvoiceModal() {
  const companySel = document.getElementById('inv-company');
  const studentSel = document.getElementById('inv-student');
  const sessDiv = document.getElementById('inv-sessions');
  const msg = document.getElementById('inv-msg');
  const btn = document.getElementById('inv-submit');

  msg.style.display = 'none';
  msg.textContent = '';
  btn.textContent = 'create invoice';
  btn.disabled = false;
  document.getElementById('inv-vat-rate').value = '';
  document.getElementById('inv-notes').value = '';
  document.getElementById('inv-total-preview').textContent = 'Total: —';

  // Reset to company mode
  invoiceMode = 'company';
  switchInvoiceMode('company');

  // Load companies
  try {
    const res = await apiFetch('/api/get-companies');
    if (res.ok) {
      invoiceCompanyCache = await res.json();
      companySel.innerHTML =
        '<option value="">select company…</option>' +
        invoiceCompanyCache
          .map(
            (c) =>
              `<option value="${c.id}">${esc(c.name)}${c.rate_per_session ? ' (' + esc(c.rate_per_session) + ' ' + esc(c.currency || 'CHF') + '/session)' : ''}</option>`
          )
          .join('');
    }
  } catch {
    /* keep default */
  }

  // Load students
  try {
    const res = await apiFetch('/api/get-students?status=active');
    if (res.ok) {
      invoiceStudentCache = await res.json();
      studentSel.innerHTML =
        '<option value="">select student…</option>' +
        invoiceStudentCache
          .map((s) => {
            const name = [s.first_name, s.last_name].filter(Boolean).join(' ');
            const rateInfo = s.rate_per_session
              ? ' (' + esc(s.rate_per_session) + ' ' + esc(s.currency || 'CHF') + '/session)'
              : '';
            return `<option value="${s.id}">${esc(name)}${rateInfo}</option>`;
          })
          .join('');
    }
  } catch {
    /* keep default */
  }

  companySel.onchange = () => loadCompanySessions(companySel.value);
  studentSel.onchange = () => loadStudentSessions(studentSel.value);

  document.getElementById('create-invoice-modal').classList.add('open');
}

export function closeCreateInvoiceModal() {
  document.getElementById('create-invoice-modal').classList.remove('open');
}

async function loadCompanySessions(companyId) {
  const sessDiv = document.getElementById('inv-sessions');
  if (!companyId) {
    sessDiv.innerHTML = '<p style="font-size:0.78rem;color:#aaa;">Select a company first.</p>';
    return;
  }

  sessDiv.innerHTML = '<p class="loading-state" style="padding:0.5rem 0;">loading sessions…</p>';

  try {
    const res = await apiFetch('/api/get-courses?status=all');
    if (!res.ok) throw new Error();
    const allCourses = await res.json();
    const companyCourses = allCourses.filter((c) => c.company_id === companyId);

    invoiceSessionsCache = [];
    for (const course of companyCourses) {
      for (const s of course.sessions || []) {
        if (s.status === 'completed') {
          invoiceSessionsCache.push({
            id: s.id,
            course_code: course.course_code,
            scheduled_at: s.scheduled_at,
          });
        }
      }
    }

    renderSessionCheckboxes();
  } catch {
    sessDiv.innerHTML = '<p style="font-size:0.78rem;color:#c0392b;">Could not load sessions.</p>';
  }
}

async function loadStudentSessions(studentId) {
  const sessDiv = document.getElementById('inv-sessions');
  if (!studentId) {
    sessDiv.innerHTML = '<p style="font-size:0.78rem;color:#aaa;">Select a student first.</p>';
    return;
  }

  sessDiv.innerHTML = '<p class="loading-state" style="padding:0.5rem 0;">loading sessions…</p>';

  try {
    // Load student's enrolled course IDs via get-student-detail
    const detailRes = await apiFetch('/api/get-student-detail?id=' + studentId);
    if (!detailRes.ok) throw new Error();
    const detail = await detailRes.json();
    const courseIds = (detail.courses || []).map((c) => c.id);

    if (!courseIds.length) {
      sessDiv.innerHTML =
        '<p style="font-size:0.78rem;color:#aaa;">No courses found for this student.</p>';
      return;
    }

    // Load all courses to get sessions
    const res = await apiFetch('/api/get-courses?status=all');
    if (!res.ok) throw new Error();
    const allCourses = await res.json();
    const studentCourses = allCourses.filter((c) => courseIds.includes(c.id));

    invoiceSessionsCache = [];
    for (const course of studentCourses) {
      for (const s of course.sessions || []) {
        if (s.status === 'completed') {
          invoiceSessionsCache.push({
            id: s.id,
            course_code: course.course_code,
            scheduled_at: s.scheduled_at,
          });
        }
      }
    }

    renderSessionCheckboxes();
  } catch {
    sessDiv.innerHTML = '<p style="font-size:0.78rem;color:#c0392b;">Could not load sessions.</p>';
  }
}

function renderSessionCheckboxes() {
  const sessDiv = document.getElementById('inv-sessions');

  if (!invoiceSessionsCache.length) {
    sessDiv.innerHTML =
      '<p style="font-size:0.78rem;color:#aaa;">No completed sessions to invoice.</p>';
    return;
  }

  invoiceSessionsCache.sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));

  sessDiv.innerHTML =
    `
    <div style="margin-bottom:0.5rem;">
      <button class="add-participant-btn" data-action="toggleAllInvSessions" data-args="true">select all</button>
      <button class="add-participant-btn" style="margin-left:0.8rem;" data-action="toggleAllInvSessions" data-args="false">deselect all</button>
    </div>
  ` +
    invoiceSessionsCache
      .map((s) => {
        const date = s.scheduled_at
          ? new Date(s.scheduled_at).toLocaleDateString('de-CH', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            })
          : '—';
        return `
      <div class="inv-session-check">
        <label>
          <input type="checkbox" value="${s.id}" checked data-action-change="updateInvTotalPreview">
          ${esc(s.course_code) || '—'} — ${date}
        </label>
      </div>`;
      })
      .join('');

  updateInvTotalPreview();
}

export function toggleAllInvSessions(checked) {
  const isChecked = checked === true || checked === 'true';
  document.querySelectorAll('#inv-sessions input[type="checkbox"]').forEach((cb) => {
    cb.checked = isChecked;
  });
  updateInvTotalPreview();
}

export function updateInvTotalPreview() {
  let rate = 0;
  let currency = 'CHF';

  if (invoiceMode === 'company') {
    const companyId = document.getElementById('inv-company').value;
    const company = invoiceCompanyCache?.find((c) => c.id === companyId);
    rate = company ? parseFloat(company.rate_per_session) || 0 : 0;
    currency = company?.currency || 'CHF';
  } else {
    const studentId = document.getElementById('inv-student').value;
    const student = invoiceStudentCache?.find((s) => s.id === studentId);
    rate = student ? parseFloat(student.rate_per_session) || 0 : 0;
    currency = student?.currency || 'CHF';
  }

  const count = document.querySelectorAll('#inv-sessions input[type="checkbox"]:checked').length;
  const vatRate = parseFloat(document.getElementById('inv-vat-rate').value) || 0;

  const net = count * rate;
  const vat = Math.round(((net * vatRate) / 100) * 100) / 100;
  const total = net + vat;

  document.getElementById('inv-total-preview').textContent =
    `${count} session${count !== 1 ? 's' : ''} × ${rate.toFixed(2)} = ${currency} ${net.toFixed(2)}` +
    (vatRate ? ` + VAT ${vatRate}% = ${currency} ${total.toFixed(2)}` : '');
}

export async function submitCreateInvoice() {
  const btn = document.getElementById('inv-submit');
  const msgEl = document.getElementById('inv-msg');
  msgEl.style.display = 'none';

  const companyId = document.getElementById('inv-company').value;
  const studentId = document.getElementById('inv-student').value;

  if (invoiceMode === 'company' && !companyId) {
    msgEl.textContent = 'Please select a company.';
    msgEl.className = 'modal-msg err';
    msgEl.style.display = 'block';
    return;
  }
  if (invoiceMode === 'student' && !studentId) {
    msgEl.textContent = 'Please select a student.';
    msgEl.className = 'modal-msg err';
    msgEl.style.display = 'block';
    return;
  }

  const sessionIds = [];
  document.querySelectorAll('#inv-sessions input[type="checkbox"]:checked').forEach((cb) => {
    sessionIds.push(cb.value);
  });

  if (!sessionIds.length) {
    msgEl.textContent = 'Please select at least one session.';
    msgEl.className = 'modal-msg err';
    msgEl.style.display = 'block';
    return;
  }

  btn.textContent = 'creating…';
  btn.disabled = true;

  const vatRate = document.getElementById('inv-vat-rate').value;
  const notes = document.getElementById('inv-notes').value.trim();

  const body = {
    session_ids: sessionIds,
    vat_rate: vatRate ? parseFloat(vatRate) : undefined,
    notes: notes || undefined,
  };

  if (invoiceMode === 'company') {
    body.company_id = companyId;
  } else {
    body.student_id = studentId;
  }

  try {
    const res = await apiFetch('/api/create-invoice', {
      method: 'POST',
      body,
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Unknown error');

    msgEl.textContent = `Created ${result.invoice_number}`;
    msgEl.className = 'modal-msg';
    msgEl.style.cssText = 'display:block;color:#27ae60;font-size:0.75rem;margin-top:0.8rem;';
    btn.textContent = 'created ✓';

    setTimeout(() => {
      closeCreateInvoiceModal();
      loadInvoices(currentInvoiceFilter);
    }, 1200);
  } catch (err) {
    msgEl.textContent = 'Error: ' + err.message;
    msgEl.className = 'modal-msg err';
    msgEl.style.display = 'block';
    btn.textContent = 'create invoice';
    btn.disabled = false;
  }
}

export function initVatListener() {
  document.getElementById('inv-vat-rate')?.addEventListener('input', updateInvTotalPreview);
}
