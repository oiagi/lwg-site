/* ── Students tab ─────────────────────────────────────────────────── */
import { apiFetch } from './api.js';
import { esc } from './helpers.js';

let currentStudentFilter = 'active';

export function getCurrentStudentFilter() {
  return currentStudentFilter;
}

export function filterStudents(active) {
  currentStudentFilter = active;
  document.querySelectorAll('[data-student-status]').forEach((b) => {
    b.classList.toggle('active', b.dataset.studentStatus === active);
  });
  loadStudents(active);
}

export async function loadStudents(status = 'active') {
  const list = document.getElementById('student-list');
  if (!list.querySelector('.student-row')) {
    list.innerHTML = '<div class="loading-state">loading…</div>';
  }
  try {
    const qs = status !== 'all' ? `?status=${status}` : '';
    const res = await apiFetch('/api/get-students' + qs);
    if (!res.ok) throw new Error();
    const students = await res.json();
    renderStudents(students);
  } catch {
    list.innerHTML = '<div class="loading-state">Could not load students.</div>';
  }
}

function renderStudents(students) {
  const list = document.getElementById('student-list');
  if (!students.length) {
    list.innerHTML = '<div class="empty-state">no students found</div>';
    return;
  }

  list.innerHTML = students
    .map((s) => {
      const name = [s.first_name, s.last_name].filter(Boolean).join(' ');
      const stats =
        [
          s.course_count ? s.course_count + ' course' + (s.course_count !== 1 ? 's' : '') : null,
          s.company_name ? s.company_name : null,
        ]
          .filter(Boolean)
          .join(' · ') || 'no courses';

      return `
    <div class="student-row" id="student-${s.id}">
      <div class="student-summary" data-action="toggleStudent" data-args="${s.id}">
        <span class="student-name">${esc(name)}</span>
        <span class="student-email">${esc(s.email) || '—'}</span>
        <span class="student-stats">${esc(stats)}</span>
      </div>
      <div class="student-detail" id="student-detail-${s.id}">
        <div class="student-detail-loading">loading…</div>
      </div>
    </div>`;
    })
    .join('');
}

export async function toggleStudent(id) {
  const detail = document.getElementById('student-detail-' + id);
  if (detail.classList.contains('open')) {
    detail.classList.remove('open');
    return;
  }
  detail.classList.add('open');

  // Load full detail if not yet loaded
  if (detail.querySelector('.student-detail-loading')) {
    try {
      const res = await apiFetch('/api/get-student-detail?id=' + id);
      if (!res.ok) throw new Error();
      const s = await res.json();
      renderStudentDetail(detail, s);
    } catch {
      detail.innerHTML =
        '<p style="color:#c0392b;font-size:0.78rem;">Could not load student details.</p>';
    }
  }
}

function renderStudentDetail(container, s) {
  const coursesHtml =
    s.courses && s.courses.length
      ? s.courses
          .map(
            (c) =>
              `<span style="display:inline-block;background:#f5f5f5;padding:0.15rem 0.5rem;border-radius:3px;font-size:0.75rem;margin:0.15rem 0.2rem 0.15rem 0;">${esc(c.course_code) || '—'} · ${esc(c.service)} · <em>${esc(c.status)}</em></span>`
          )
          .join('')
      : '<span style="color:#aaa;font-size:0.78rem;">no courses</span>';

  container.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem;">
      <div>
        <p style="font-size:0.68rem;letter-spacing:0.14em;text-transform:uppercase;color:#aaa;margin-bottom:0.4rem;">personal</p>
        <p style="font-size:0.82rem;color:#555;line-height:1.8;">
          ${esc(s.first_name)} ${esc(s.last_name)}<br>
          ${s.email ? '<span style="color:#aaa;">' + esc(s.email) + '</span><br>' : ''}
          ${s.phone ? '<span style="color:#aaa;">' + esc(s.phone) + '</span><br>' : ''}
          ${s.date_of_birth ? 'DOB: ' + esc(s.date_of_birth) + '<br>' : ''}
          ${s.nationality ? 'Nationality: ' + esc(s.nationality) + '<br>' : ''}
          ${s.postcode ? 'Postcode: ' + esc(s.postcode) : ''}
        </p>
        ${s.emergency_contact ? '<p style="font-size:0.75rem;color:#888;margin-top:0.4rem;">Emergency: ' + esc(s.emergency_contact) + '</p>' : ''}
      </div>
      <div>
        <p style="font-size:0.68rem;letter-spacing:0.14em;text-transform:uppercase;color:#aaa;margin-bottom:0.4rem;">billing</p>
        <p style="font-size:0.82rem;color:#555;line-height:1.8;">
          ${esc(s.billing_name) || '—'}<br>
          ${esc(s.billing_address) || '—'}<br>
          ${s.billing_email ? '<span style="color:#aaa;">' + esc(s.billing_email) + '</span><br>' : ''}
          ${s.vat_number ? 'VAT: ' + esc(s.vat_number) + '<br>' : ''}
          ${s.rate_per_session ? '<strong>' + esc(s.rate_per_session) + ' ' + esc(s.currency || 'CHF') + '</strong> per session<br>' : ''}
          ${s.payment_method ? 'Payment: ' + esc(s.payment_method) : ''}
        </p>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem;">
      <div>
        <p style="font-size:0.68rem;letter-spacing:0.14em;text-transform:uppercase;color:#aaa;margin-bottom:0.4rem;">language</p>
        <p style="font-size:0.82rem;color:#555;line-height:1.8;">
          ${s.native_language ? 'Native: ' + esc(s.native_language) + '<br>' : ''}
          ${s.target_language ? 'Target: ' + esc(s.target_language) + '<br>' : ''}
          ${s.current_level ? 'Level: ' + esc(s.current_level) + '<br>' : ''}
          ${s.course_type ? 'Type: ' + esc(s.course_type) + '<br>' : ''}
          ${s.course_format ? 'Format: ' + esc(s.course_format) + '<br>' : ''}
          ${s.location ? 'Location: ' + esc(s.location) : ''}
        </p>
        ${s.learning_goals ? '<p style="font-size:0.75rem;color:#888;margin-top:0.3rem;">Goals: ' + esc(s.learning_goals) + '</p>' : ''}
        ${s.desired_start_date ? '<p style="font-size:0.75rem;color:#888;">Start date: ' + esc(s.desired_start_date) + '</p>' : ''}
      </div>
      <div>
        <p style="font-size:0.68rem;letter-spacing:0.14em;text-transform:uppercase;color:#aaa;margin-bottom:0.4rem;">courses</p>
        <div>${coursesHtml}</div>
      </div>
    </div>
    ${s.referral_source ? '<p style="font-size:0.75rem;color:#888;margin-bottom:0.5rem;">Referral: ' + esc(s.referral_source) + '</p>' : ''}
    ${s.progress_notes ? '<p style="font-size:0.78rem;color:#888;margin-bottom:1rem;">' + esc(s.progress_notes) + '</p>' : ''}
    ${s.consent_given ? '<p style="font-size:0.7rem;color:#aaa;margin-bottom:0.5rem;">Consent given' + (s.consent_date ? ' on ' + new Date(s.consent_date).toLocaleDateString('de-CH') : '') + '</p>' : ''}
    <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
      <button class="save-btn" data-action="editStudent" data-args="${s.id}">edit</button>
      <button class="action-btn" data-action="copyIntakeLink" data-args="${s.id},${s.access_token}">copy intake link</button>
    </div>
  `;
}

/* ── Student modal ───────────────────────────────────────────────── */

export function openStudentModal(existingData) {
  const allFields = [
    'sm-id',
    'sm-first-name',
    'sm-last-name',
    'sm-email',
    'sm-phone',
    'sm-postcode',
    'sm-dob',
    'sm-nationality',
    'sm-native-lang',
    'sm-target-lang',
    'sm-level',
    'sm-learning-goals',
    'sm-emergency-contact',
    'sm-desired-start',
    'sm-course-type',
    'sm-course-format',
    'sm-location',
    'sm-billing-name',
    'sm-billing-address',
    'sm-billing-email',
    'sm-rate',
    'sm-vat',
    'sm-payment-method',
    'sm-referral',
    'sm-company',
    'sm-notes',
  ];
  allFields.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  document.getElementById('sm-status').value = 'active';
  document.getElementById('student-modal-title').textContent = 'new student';
  const btn = document.getElementById('sm-submit');
  btn.textContent = 'save student';
  btn.disabled = false;
  const msg = document.getElementById('sm-msg');
  msg.style.display = 'none';
  msg.textContent = '';

  if (existingData) {
    document.getElementById('student-modal-title').textContent = 'edit student';
    document.getElementById('sm-id').value = existingData.id || '';
    document.getElementById('sm-first-name').value = existingData.first_name || '';
    document.getElementById('sm-last-name').value = existingData.last_name || '';
    document.getElementById('sm-email').value = existingData.email || '';
    document.getElementById('sm-phone').value = existingData.phone || '';
    document.getElementById('sm-postcode').value = existingData.postcode || '';
    document.getElementById('sm-dob').value = existingData.date_of_birth || '';
    document.getElementById('sm-nationality').value = existingData.nationality || '';
    document.getElementById('sm-native-lang').value = existingData.native_language || '';
    document.getElementById('sm-target-lang').value = existingData.target_language || '';
    document.getElementById('sm-level').value = existingData.current_level || '';
    document.getElementById('sm-learning-goals').value = existingData.learning_goals || '';
    document.getElementById('sm-emergency-contact').value = existingData.emergency_contact || '';
    document.getElementById('sm-desired-start').value = existingData.desired_start_date || '';
    document.getElementById('sm-course-type').value = existingData.course_type || '';
    document.getElementById('sm-course-format').value = existingData.course_format || '';
    document.getElementById('sm-location').value = existingData.location || '';
    document.getElementById('sm-billing-name').value = existingData.billing_name || '';
    document.getElementById('sm-billing-address').value = existingData.billing_address || '';
    document.getElementById('sm-billing-email').value = existingData.billing_email || '';
    document.getElementById('sm-rate').value = existingData.rate_per_session || '';
    document.getElementById('sm-vat').value = existingData.vat_number || '';
    document.getElementById('sm-payment-method').value = existingData.payment_method || '';
    document.getElementById('sm-referral').value = existingData.referral_source || '';
    document.getElementById('sm-company').value = existingData.company_id || '';
    document.getElementById('sm-notes').value = existingData.progress_notes || '';
    // Resolve status from status field, falling back to active boolean for old records
    const resolvedStatus =
      existingData.status || (existingData.active !== false ? 'active' : 'inactive');
    document.getElementById('sm-status').value = resolvedStatus;
  }

  loadCompanyOptions();
  document.getElementById('student-modal').classList.add('open');
}

async function loadCompanyOptions() {
  const sel = document.getElementById('sm-company');
  const current = sel.value;
  try {
    const res = await apiFetch('/api/get-companies');
    if (!res.ok) return;
    const companies = await res.json();
    sel.innerHTML =
      '<option value="">— none —</option>' +
      companies
        .map(
          (c) =>
            `<option value="${c.id}"${c.id === current ? ' selected' : ''}>${esc(c.name)}</option>`
        )
        .join('');
  } catch {
    /* keep default */
  }
}

export function closeStudentModal() {
  document.getElementById('student-modal').classList.remove('open');
}

export async function editStudent(studentId) {
  try {
    const res = await apiFetch('/api/get-student-detail?id=' + studentId);
    if (!res.ok) throw new Error();
    const data = await res.json();
    openStudentModal(data);
  } catch {
    alert('Could not load student details.');
  }
}

export async function submitStudent() {
  const btn = document.getElementById('sm-submit');
  const msgEl = document.getElementById('sm-msg');
  msgEl.style.display = 'none';

  const firstName = document.getElementById('sm-first-name').value.trim();
  const lastName = document.getElementById('sm-last-name').value.trim();
  if (!firstName || !lastName) {
    msgEl.textContent = 'First name and last name are required.';
    msgEl.className = 'modal-msg err';
    msgEl.style.display = 'block';
    return;
  }

  btn.textContent = 'saving…';
  btn.disabled = true;

  const body = {
    first_name: firstName,
    last_name: lastName,
    email: document.getElementById('sm-email').value.trim() || null,
    phone: document.getElementById('sm-phone').value.trim() || null,
    postcode: document.getElementById('sm-postcode').value.trim() || null,
    date_of_birth: document.getElementById('sm-dob').value || null,
    nationality: document.getElementById('sm-nationality').value.trim() || null,
    native_language: document.getElementById('sm-native-lang').value.trim() || null,
    target_language: document.getElementById('sm-target-lang').value.trim() || null,
    current_level: document.getElementById('sm-level').value || null,
    learning_goals: document.getElementById('sm-learning-goals').value.trim() || null,
    emergency_contact: document.getElementById('sm-emergency-contact').value.trim() || null,
    desired_start_date: document.getElementById('sm-desired-start').value || null,
    course_type: document.getElementById('sm-course-type').value || null,
    course_format: document.getElementById('sm-course-format').value || null,
    location: document.getElementById('sm-location').value || null,
    billing_name: document.getElementById('sm-billing-name').value.trim() || null,
    billing_address: document.getElementById('sm-billing-address').value.trim() || null,
    billing_email: document.getElementById('sm-billing-email').value.trim() || null,
    rate_per_session: document.getElementById('sm-rate').value
      ? parseFloat(document.getElementById('sm-rate').value)
      : null,
    vat_number: document.getElementById('sm-vat').value.trim() || null,
    payment_method: document.getElementById('sm-payment-method').value || null,
    referral_source: document.getElementById('sm-referral').value.trim() || null,
    company_id: document.getElementById('sm-company').value || null,
    progress_notes: document.getElementById('sm-notes').value.trim() || null,
    status: document.getElementById('sm-status').value,
  };
  const id = document.getElementById('sm-id').value;
  if (id) body.id = id;

  try {
    const res = await apiFetch('/api/save-student', {
      method: 'POST',
      body,
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Unknown error');

    msgEl.textContent = id ? 'Student updated.' : 'Student created.';
    msgEl.className = 'modal-msg';
    msgEl.style.cssText = 'display:block;color:#27ae60;font-size:0.75rem;margin-top:0.8rem;';
    btn.textContent = 'saved ✓';

    setTimeout(() => {
      closeStudentModal();
      loadStudents(currentStudentFilter);
    }, 1200);
  } catch (err) {
    msgEl.textContent = 'Error: ' + err.message;
    msgEl.className = 'modal-msg err';
    msgEl.style.display = 'block';
    btn.textContent = 'save student';
    btn.disabled = false;
  }
}

export function copyIntakeLink(studentId, accessToken) {
  if (!accessToken) {
    alert('This student has no access token. Edit and save the student first.');
    return;
  }
  const url = window.location.origin + '/intake.html?token=' + accessToken;
  navigator.clipboard
    .writeText(url)
    .then(() => {
      // Brief visual feedback on the button that was clicked
      const btn = document.querySelector(
        `[data-action="copyIntakeLink"][data-args="${studentId},${accessToken}"]`
      );
      if (btn) {
        const orig = btn.textContent;
        btn.textContent = 'copied!';
        setTimeout(() => {
          btn.textContent = orig;
        }, 1500);
      }
    })
    .catch(() => {
      prompt('Copy this link:', window.location.origin + '/intake.html?token=' + accessToken);
    });
}
