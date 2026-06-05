/* ── Companies tab ─────────────────────────────────────────────────── */
import { apiFetch } from '../core/api.js';
import { esc } from '../core/helpers.js';
import { MESSAGE_TIMEOUT_MS } from '../core/constants.js';
import { openConfirmSend } from './confirm-send.js';

let companies = [];
let selectedCompanyId = null;

let addStudentCompanyId = null;
let selectedAddStudentId = null;
let addStudentResults = [];
let addStudentSearchTimeout = null;

/* ── Load + render list ────────────────────────────────────────────── */

export async function loadCompanies() {
  const list = document.getElementById('company-list');
  if (!list) return;
  if (!list.querySelector('.company-row')) {
    list.innerHTML = '<div class="loading-state">loading…</div>';
  }
  try {
    const res = await apiFetch('/api/get-companies');
    if (!res.ok) throw new Error();
    companies = await res.json();
    renderCompanyList();
    if (selectedCompanyId) {
      const still = companies.find((c) => String(c.id) === String(selectedCompanyId));
      if (still) renderCompanyDetail(still);
    }
  } catch {
    list.innerHTML =
      '<div class="loading-state">Could not load companies. <button type="button" class="inline-link-btn">Retry</button></div>';
    list.querySelector('button')?.addEventListener('click', loadCompanies);
  }
}

function renderCompanyList() {
  const list = document.getElementById('company-list');
  if (!list) return;
  if (!companies.length) {
    list.innerHTML = '<div class="empty-state">no companies yet</div>';
    return;
  }
  list.innerHTML = companies
    .map((c) => {
      const isSelected = String(c.id) === String(selectedCompanyId);
      return `
      <div class="student-row${isSelected ? ' selected' : ''}" id="company-row-${esc(c.id)}"
           role="option" aria-selected="${isSelected}" tabindex="0"
           data-action="selectCompany" data-args="${esc(c.id)}">
        <span class="student-name">${esc(c.name) || '—'}</span>
        <span class="student-sub">${c.students.length} student${c.students.length === 1 ? '' : 's'}${c.booking_code ? ' · ' + esc(c.booking_code) : ''}</span>
      </div>`;
    })
    .join('');
}

/* ── Select company ────────────────────────────────────────────────── */

export function selectCompany(id) {
  selectedCompanyId = String(id);
  document.querySelectorAll('.company-row').forEach((row) => {
    const isSelected = row.id === 'company-row-' + id;
    row.classList.toggle('selected', isSelected);
    row.setAttribute('aria-selected', String(isSelected));
  });
  const company = companies.find((c) => String(c.id) === String(id));
  if (company) renderCompanyDetail(company);
}

/* ── Render detail pane ────────────────────────────────────────────── */

function renderCompanyDetail(c) {
  const pane = document.getElementById('company-detail-panel');
  if (!pane) return;
  pane.className = '';

  const studentRows = c.students.length
    ? c.students
        .map(
          (s) => `
        <div class="company-student-row-wrap">
          <label class="cs-recipient-row company-student-row">
            <input type="checkbox" class="company-student-cb" data-student-id="${esc(s.id)}"
                   data-student-name="${esc([s.first_name, s.last_name].filter(Boolean).join(' '))}"
                   data-student-email="${esc(s.email || '')}"
                   ${s.email ? 'checked' : 'disabled'}>
            <span class="cs-recipient-name">${esc([s.first_name, s.last_name].filter(Boolean).join(' ')) || '—'}</span>
            <span class="cs-recipient-email">${s.email ? '&lt;' + esc(s.email) + '&gt;' : '<span class="detail-muted">no email</span>'}</span>
          </label>
          <button class="inline-link-btn company-remove-student-btn"
                  data-action="removeStudentFromCompany"
                  data-args="${esc(String(s.id))},${esc(String(c.id))}">remove</button>
        </div>`
        )
        .join('')
    : '<p class="detail-muted">No students linked to this company yet.</p>';

  pane.innerHTML = `
    <div class="detail-header">
      <span class="detail-header-name" id="company-detail-name">${esc(c.name)}</span>
    </div>

    <div class="detail-section">
      <p class="detail-meta">Company name</p>
      <div class="company-inline-edit">
        <input type="text" id="company-name-input" class="list-search" value="${esc(c.name)}" placeholder="Company name" style="flex:1;max-width:280px;">
        <button class="save-btn" data-action="saveCompanyName" data-args="${esc(c.id)}">save</button>
        <span class="detail-action-msg" id="company-name-msg"></span>
      </div>
    </div>

    <div class="detail-section">
      <p class="detail-meta">Booking code</p>
      <div class="company-inline-edit">
        <input type="text" id="company-code-input" class="list-search" value="${esc(c.booking_code || '')}"
               placeholder="e.g. ACME2025" style="flex:1;max-width:280px;font-family:monospace;text-transform:uppercase;">
        <button class="save-btn" data-action="saveCompanyCode" data-args="${esc(c.id)}">save</button>
        <span class="detail-action-msg" id="company-code-msg"></span>
      </div>
      ${c.booking_code ? `<p class="label-hint mt-small">Deep-link: /group-courses?code=${esc(c.booking_code)}</p>` : ''}
    </div>

    <div class="detail-section">
      <p class="detail-meta">Students
        <label class="company-select-all-label">
          <input type="checkbox" id="company-select-all" ${c.students.some((s) => s.email) ? 'checked' : 'disabled'}> select all
        </label>
        <button class="inline-link-btn company-add-student-btn"
                data-action="openAddStudentModal" data-args="${esc(String(c.id))}">+ add student</button>
      </p>
      <div class="company-student-list">${studentRows}</div>
    </div>

    <div class="detail-actions">
      <button class="save-btn" data-action="openSendBookingCode" data-args="${esc(c.id)}"
              ${c.booking_code ? '' : 'disabled title="Set a booking code first"'}>
        send booking code email
      </button>
    </div>
  `;

  wireSelectAll();
  wireCodeInputUppercase();
}

function wireSelectAll() {
  const selectAll = document.getElementById('company-select-all');
  if (!selectAll) return;
  selectAll.addEventListener('change', () => {
    document.querySelectorAll('.company-student-cb:not(:disabled)').forEach((cb) => {
      cb.checked = selectAll.checked;
    });
  });
  document.querySelectorAll('.company-student-cb').forEach((cb) => {
    cb.addEventListener('change', () => {
      const all = [...document.querySelectorAll('.company-student-cb:not(:disabled)')];
      selectAll.checked = all.length > 0 && all.every((box) => box.checked);
      selectAll.indeterminate = all.some((box) => box.checked) && !all.every((box) => box.checked);
    });
  });
}

function wireCodeInputUppercase() {
  const input = document.getElementById('company-code-input');
  input?.addEventListener('input', () => {
    const pos = input.selectionStart;
    input.value = input.value.toUpperCase().replace(/\s/g, '');
    input.setSelectionRange(pos, pos);
  });
}

/* ── Inline save: name ─────────────────────────────────────────────── */

export async function saveCompanyName(id) {
  const input = document.getElementById('company-name-input');
  const msg = document.getElementById('company-name-msg');
  const name = input?.value.trim();
  if (!name) return;
  try {
    const res = await apiFetch('/api/save-company', { method: 'POST', body: { id, name } });
    if (!res.ok) throw new Error();
    const updated = await res.json();
    const idx = companies.findIndex((c) => String(c.id) === String(id));
    if (idx !== -1) {
      companies[idx].name = updated.name;
    }
    renderCompanyList();
    document.getElementById('company-detail-name').textContent = updated.name;
    if (msg) {
      msg.textContent = 'saved';
      msg.classList.add('is-visible-inline');
      setTimeout(() => msg.classList.remove('is-visible-inline'), MESSAGE_TIMEOUT_MS);
    }
  } catch {
    if (msg) {
      msg.textContent = 'error';
      msg.classList.add('is-visible-inline', 'error-text');
    }
  }
}

/* ── Inline save: booking code ─────────────────────────────────────── */

export async function saveCompanyCode(id) {
  const input = document.getElementById('company-code-input');
  const msg = document.getElementById('company-code-msg');
  const booking_code = input?.value.trim().toUpperCase() || null;
  try {
    const res = await apiFetch('/api/save-company', {
      method: 'POST',
      body: {
        id,
        name: companies.find((c) => String(c.id) === String(id))?.name || '',
        booking_code,
      },
    });
    if (!res.ok) throw new Error();
    const updated = await res.json();
    const idx = companies.findIndex((c) => String(c.id) === String(id));
    if (idx !== -1) companies[idx].booking_code = updated.booking_code;
    const company = companies[idx];
    renderCompanyList();
    renderCompanyDetail(company);
    if (msg) {
      msg.textContent = 'saved';
      msg.classList.add('is-visible-inline');
      setTimeout(() => msg.classList.remove('is-visible-inline'), MESSAGE_TIMEOUT_MS);
    }
  } catch {
    if (msg) {
      msg.textContent = 'error';
      msg.classList.add('is-visible-inline', 'error-text');
    }
  }
}

/* ── Open send booking code modal ──────────────────────────────────── */

export function openSendBookingCode(id) {
  const company = companies.find((c) => String(c.id) === String(id));
  if (!company) return;

  const checkboxes = [...document.querySelectorAll('.company-student-cb:not(:disabled)')];
  const selected = checkboxes
    .filter((cb) => cb.checked)
    .map((cb) => ({
      id: cb.dataset.studentId,
      name: cb.dataset.studentName,
      email: cb.dataset.studentEmail,
      selected: true,
    }));

  if (!selected.length) {
    alert('No students with email addresses selected.');
    return;
  }

  const code = company.booking_code;
  const previewUrl = `/group-courses?code=${encodeURIComponent(code)}`;

  openConfirmSend({
    title: 'send booking code email',
    recipients: selected,
    subject: `Your company booking code · learning with gioia`,
    contentHtml: `
      <p>Hello [first name] :)<br>
      Here is the link to courses currently happening at your company.<br>
      <a href="${esc(previewUrl)}" target="_blank" rel="noopener">${esc(previewUrl)}</a><br><br>
      <strong>Booking code: ${esc(code)}</strong></p>
      <p style="color:#888;font-size:12px;margin-top:8px;">Each recipient receives a personalised email with their first name.</p>`,
    languageOptions: [{ value: 'de' }, { value: 'en' }],
    defaultLanguage: 'de',
    selectableRecipients: true,
    onConfirm: async ({ language, recipients }) => {
      const studentIds = recipients.map((r) => r.id);
      const res = await apiFetch('/api/send-company-booking-code', {
        method: 'POST',
        body: { company_id: id, student_ids: studentIds, language },
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || `HTTP ${res.status}`);
    },
  });
}

/* ── New company modal ─────────────────────────────────────────────── */

export function openNewCompanyModal() {
  const modal = document.getElementById('new-company-modal');
  const input = document.getElementById('nc-name');
  if (!modal || !input) return;
  input.value = '';
  document.getElementById('nc-msg').textContent = '';
  document.getElementById('nc-msg').className = 'modal-msg';
  modal.classList.add('open');
  requestAnimationFrame(() => input.focus());
}

export function closeNewCompanyModal() {
  document.getElementById('new-company-modal')?.classList.remove('open');
}

/* ── Add student to company modal ──────────────────────────────────── */

export function openAddStudentModal(id) {
  addStudentCompanyId = String(id);
  selectedAddStudentId = null;
  addStudentResults = [];
  clearTimeout(addStudentSearchTimeout);

  const modal = document.getElementById('add-company-student-modal');
  const search = document.getElementById('acs-search');
  const submit = document.getElementById('acs-submit');
  const results = document.getElementById('acs-results');
  const msg = document.getElementById('acs-msg');
  if (!modal || !search) return;

  search.value = '';
  results.innerHTML = '';
  if (submit) submit.disabled = true;
  if (msg) {
    msg.textContent = '';
    msg.className = 'modal-msg';
  }

  const createForm = document.getElementById('acs-create-form');
  if (createForm) createForm.hidden = true;
  ['acs-first-name', 'acs-last-name', 'acs-email'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const createMsg = document.getElementById('acs-create-msg');
  if (createMsg) {
    createMsg.textContent = '';
    createMsg.className = 'modal-msg';
  }
  const createBtn = document.getElementById('acs-create-submit');
  if (createBtn) {
    createBtn.disabled = false;
    createBtn.textContent = 'create & add';
  }

  modal.classList.add('open');
  requestAnimationFrame(() => search.focus());

  search.oninput = () => {
    clearTimeout(addStudentSearchTimeout);
    addStudentSearchTimeout = setTimeout(doAddStudentSearch, 300);
  };
}

export function closeAddStudentModal() {
  document.getElementById('add-company-student-modal')?.classList.remove('open');
  clearTimeout(addStudentSearchTimeout);
}

async function doAddStudentSearch() {
  const q = document.getElementById('acs-search')?.value.trim();
  const resultsEl = document.getElementById('acs-results');
  if (!resultsEl) return;

  if (!q) {
    resultsEl.innerHTML = '';
    return;
  }

  resultsEl.innerHTML = '<div class="acs-searching">searching…</div>';

  try {
    const res = await apiFetch(`/api/get-students?q=${encodeURIComponent(q)}&status=all`);
    if (!res.ok) throw new Error();
    const all = await res.json();

    const company = companies.find((c) => String(c.id) === String(addStudentCompanyId));
    const existingIds = new Set((company?.students || []).map((s) => String(s.id)));
    addStudentResults = all.filter((s) => !existingIds.has(String(s.id)));

    if (!addStudentResults.length) {
      resultsEl.innerHTML = '<div class="acs-searching">no matching students</div>';
      return;
    }

    resultsEl.innerHTML = addStudentResults
      .slice(0, 20)
      .map((s) => {
        const name = [s.first_name, s.last_name].filter(Boolean).join(' ') || '—';
        const email = s.email || '';
        return `<div class="acs-result-row" role="option" tabindex="0"
                     data-action="pickAddStudent" data-args="${esc(String(s.id))}">
          <span class="acs-result-name">${esc(name)}</span>
          ${email ? `<span class="acs-result-email">&lt;${esc(email)}&gt;</span>` : '<span class="acs-result-email detail-muted">no email</span>'}
        </div>`;
      })
      .join('');
  } catch {
    resultsEl.innerHTML = '<div class="acs-searching" style="color:#c00">search failed</div>';
  }
}

export function pickAddStudent(studentId) {
  selectedAddStudentId = studentId;
  document.querySelectorAll('.acs-result-row').forEach((row) => {
    row.classList.toggle('selected', row.dataset.args === studentId);
  });
  const submit = document.getElementById('acs-submit');
  if (submit) submit.disabled = false;
}

export async function confirmAddStudent() {
  if (!selectedAddStudentId || !addStudentCompanyId) return;
  const submit = document.getElementById('acs-submit');
  const msg = document.getElementById('acs-msg');
  if (submit) {
    submit.disabled = true;
    submit.textContent = 'adding…';
  }
  if (msg) {
    msg.textContent = '';
    msg.className = 'modal-msg';
  }

  try {
    const idx = companies.findIndex((c) => String(c.id) === String(addStudentCompanyId));
    const companyId = idx !== -1 ? companies[idx].id : addStudentCompanyId;
    const res = await apiFetch('/api/save-student', {
      method: 'POST',
      body: { id: selectedAddStudentId, company_id: companyId },
    });
    if (!res.ok) throw new Error();

    const student = addStudentResults.find((s) => String(s.id) === selectedAddStudentId);
    if (idx !== -1 && student) {
      companies[idx].students.push({
        id: student.id,
        first_name: student.first_name,
        last_name: student.last_name,
        email: student.email || null,
      });
      companies[idx].students.sort(
        (a, b) =>
          (a.last_name || '').localeCompare(b.last_name || '') ||
          (a.first_name || '').localeCompare(b.first_name || '')
      );
    }

    renderCompanyList();
    if (idx !== -1) renderCompanyDetail(companies[idx]);
    closeAddStudentModal();
  } catch {
    if (msg) {
      msg.textContent = 'Could not add student. Please try again.';
      msg.className = 'modal-msg err is-visible-block';
    }
    if (submit) {
      submit.disabled = false;
      submit.textContent = 'add';
    }
  }
}

export function toggleCreateStudentForm() {
  const form = document.getElementById('acs-create-form');
  if (!form) return;
  form.hidden = !form.hidden;
  if (!form.hidden) {
    requestAnimationFrame(() => document.getElementById('acs-first-name')?.focus());
  }
}

export async function submitCreateAndAddStudent() {
  const firstName = document.getElementById('acs-first-name')?.value.trim();
  const lastName = document.getElementById('acs-last-name')?.value.trim();
  const email = document.getElementById('acs-email')?.value.trim() || null;
  const msg = document.getElementById('acs-create-msg');
  const btn = document.getElementById('acs-create-submit');

  if (!firstName || !lastName) {
    if (msg) {
      msg.textContent = 'First and last name are required.';
      msg.className = 'modal-msg err is-visible-block';
    }
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'creating…';
  }
  if (msg) {
    msg.textContent = '';
    msg.className = 'modal-msg';
  }

  try {
    const idx = companies.findIndex((c) => String(c.id) === String(addStudentCompanyId));
    const companyId = idx !== -1 ? companies[idx].id : addStudentCompanyId;
    const body = { first_name: firstName, last_name: lastName, company_id: companyId };
    if (email) body.email = email;

    const res = await apiFetch('/api/save-student', { method: 'POST', body });
    if (!res.ok) throw new Error();
    const newStudent = await res.json();

    if (idx !== -1) {
      companies[idx].students.push({
        id: newStudent.id,
        first_name: newStudent.first_name,
        last_name: newStudent.last_name,
        email: newStudent.email || null,
      });
      companies[idx].students.sort(
        (a, b) =>
          (a.last_name || '').localeCompare(b.last_name || '') ||
          (a.first_name || '').localeCompare(b.first_name || '')
      );
    }

    renderCompanyList();
    if (idx !== -1) renderCompanyDetail(companies[idx]);
    closeAddStudentModal();
  } catch {
    if (msg) {
      msg.textContent = 'Could not create student. Please try again.';
      msg.className = 'modal-msg err is-visible-block';
    }
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'create & add';
    }
  }
}

/* ── Remove student from company ───────────────────────────────────── */

export async function removeStudentFromCompany(studentId, companyId) {
  if (!confirm('Remove this student from the company?')) return;

  try {
    const res = await apiFetch('/api/save-student', {
      method: 'POST',
      body: { id: studentId, company_id: null },
    });
    if (!res.ok) throw new Error();

    const idx = companies.findIndex((c) => String(c.id) === String(companyId));
    if (idx !== -1) {
      companies[idx].students = companies[idx].students.filter(
        (s) => String(s.id) !== String(studentId)
      );
    }
    renderCompanyList();
    if (idx !== -1) renderCompanyDetail(companies[idx]);
  } catch {
    alert('Could not remove student. Please try again.');
  }
}

export async function submitNewCompany() {
  const input = document.getElementById('nc-name');
  const msg = document.getElementById('nc-msg');
  const btn = document.getElementById('nc-submit');
  const name = input?.value.trim();
  if (!name) {
    input?.focus();
    return;
  }

  btn.disabled = true;
  btn.textContent = 'saving…';
  msg.textContent = '';

  try {
    const res = await apiFetch('/api/save-company', { method: 'POST', body: { name } });
    if (!res.ok) throw new Error();
    const newCompany = await res.json();
    newCompany.students = [];
    companies.push(newCompany);
    companies.sort((a, b) => a.name.localeCompare(b.name));
    renderCompanyList();
    closeNewCompanyModal();
    selectedCompanyId = String(newCompany.id);
    renderCompanyDetail(newCompany);
    renderCompanyList();
  } catch {
    msg.textContent = 'Could not save. Please try again.';
    msg.className = 'modal-msg err is-visible-block';
  } finally {
    btn.disabled = false;
    btn.textContent = 'create';
  }
}
