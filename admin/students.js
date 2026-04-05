/* ── Students tab ─────────────────────────────────────────────────── */
import { apiFetch } from './api.js';
import { esc } from './helpers.js';

let currentStudentFilter = 'active';
let selectedStudentId = null;

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
  // Reset selection and right pane on every reload attempt
  selectedStudentId = null;
  const pane = document.getElementById('student-detail-panel');
  if (pane) {
    pane.className = 'student-detail-empty';
    pane.innerHTML = '<p>select a student to view their details</p>';
  }
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
      return `
    <div class="student-row" id="student-${s.id}"
         role="option" aria-selected="false" tabindex="0"
         data-action="selectStudent" data-args="${s.id}">
      <span class="student-name">${esc(name)}</span>
      <span class="student-email">${esc(s.email) || '—'}</span>
    </div>`;
    })
    .join('');
}

export async function selectStudent(id) {
  if (selectedStudentId === id) return;
  selectedStudentId = id;

  document.querySelectorAll('.student-row').forEach((row) => {
    const isSelected = row.id === 'student-' + id;
    row.classList.toggle('selected', isSelected);
    row.setAttribute('aria-selected', String(isSelected));
  });

  const pane = document.getElementById('student-detail-panel');
  pane.className = '';
  pane.innerHTML = '<div class="loading-state">loading…</div>';

  try {
    const res = await apiFetch('/api/get-student-detail?id=' + id);
    if (!res.ok) throw new Error();
    const s = await res.json();
    renderStudentDetail(pane, s);
  } catch {
    pane.innerHTML =
      '<p style="color:#c0392b;font-size:0.78rem;">Could not load student details.</p>';
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
          ${s.nationality ? 'Nationality: ' + esc(s.nationality) + '<br>' : ''}
          ${s.street || s.street_number ? esc([s.street, s.street_number].filter(Boolean).join(' ')) + '<br>' : ''}
          ${s.postcode || s.city ? esc([s.postcode, s.city].filter(Boolean).join(' ')) : ''}
        </p>
        ${s.emergency_contact || s.ec_phone || s.ec_email ? `<p style="font-size:0.75rem;color:#888;margin-top:0.4rem;">Emergency: ${esc(s.emergency_contact || '')}${s.ec_relationship ? ' (' + esc(s.ec_relationship) + ')' : ''}${s.ec_phone ? ' · ' + esc(s.ec_phone) : ''}${s.ec_email ? ' · ' + esc(s.ec_email) : ''}</p>` : ''}
      </div>
      <div>
        <p style="font-size:0.68rem;letter-spacing:0.14em;text-transform:uppercase;color:#aaa;margin-bottom:0.4rem;">billing</p>
        <p style="font-size:0.82rem;color:#555;line-height:1.8;">
          ${esc(s.billing_name) || '—'}<br>
          ${
            s.billing_street || s.billing_postcode
              ? esc([s.billing_street, s.billing_street_number].filter(Boolean).join(' ')) +
                '<br>' +
                esc([s.billing_postcode, s.billing_city].filter(Boolean).join(' '))
              : esc(s.billing_address) || '—'
          }<br>
          ${s.billing_email ? '<span style="color:#aaa;">' + esc(s.billing_email) + '</span><br>' : ''}
          ${s.vat_number ? 'VAT: ' + esc(s.vat_number) : ''}
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
    ${
      s.referral_source || s.payment_method || s.rate_per_session || s.progress_notes
        ? `
    <div style="margin-bottom:1rem;">
      <p style="font-size:0.68rem;letter-spacing:0.14em;text-transform:uppercase;color:#aaa;margin-bottom:0.4rem;">admin</p>
      <p style="font-size:0.82rem;color:#555;line-height:1.8;">
        ${s.payment_method ? 'Payment: ' + esc(s.payment_method) + '<br>' : ''}
        ${s.referral_source ? 'Referral: ' + esc(s.referral_source) + '<br>' : ''}
        ${s.rate_per_session ? '<strong>' + esc(s.rate_per_session) + ' ' + esc(s.currency || 'CHF') + '</strong> per session<br>' : ''}
        ${s.progress_notes ? '<span style="color:#888;">' + esc(s.progress_notes) + '</span>' : ''}
      </p>
    </div>`
        : ''
    }
    ${s.consent_given ? '<p style="font-size:0.7rem;color:#aaa;margin-bottom:0.5rem;">Consent given' + (s.consent_date ? ' on ' + new Date(s.consent_date).toLocaleDateString('de-CH') : '') + '</p>' : ''}
    <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
      <button class="save-btn" data-action="editStudent" data-args="${s.id}">edit</button>
      <button class="action-btn" data-action="copyIntakeLink" data-args="${s.id},${s.access_token}">copy intake link</button>
      <button class="delete-btn" data-action="deleteStudent" data-args="${s.id}">delete</button>
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
    'sm-nationality',
    'sm-street',
    'sm-street-number',
    'sm-postcode',
    'sm-city',
    'sm-ec-name',
    'sm-ec-phone',
    'sm-ec-email',
    'sm-ec-relationship',
    'sm-native-lang',
    'sm-target-lang',
    'sm-level',
    'sm-learning-goals',
    'sm-desired-start',
    'sm-course-type',
    'sm-course-format',
    'sm-location',
    'sm-billing-name',
    'sm-billing-street',
    'sm-billing-street-number',
    'sm-billing-postcode',
    'sm-billing-city',
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
    document.getElementById('sm-nationality').value = existingData.nationality || '';
    document.getElementById('sm-street').value = existingData.street || '';
    document.getElementById('sm-street-number').value = existingData.street_number || '';
    document.getElementById('sm-postcode').value = existingData.postcode || '';
    document.getElementById('sm-city').value = existingData.city || '';
    document.getElementById('sm-ec-name').value = existingData.emergency_contact || '';
    document.getElementById('sm-ec-phone').value = existingData.ec_phone || '';
    document.getElementById('sm-ec-email').value = existingData.ec_email || '';
    document.getElementById('sm-ec-relationship').value = existingData.ec_relationship || '';
    document.getElementById('sm-native-lang').value = existingData.native_language || '';
    document.getElementById('sm-target-lang').value = existingData.target_language || '';
    document.getElementById('sm-level').value = existingData.current_level || '';
    document.getElementById('sm-learning-goals').value = existingData.learning_goals || '';
    document.getElementById('sm-desired-start').value = existingData.desired_start_date || '';
    document.getElementById('sm-course-type').value = existingData.course_type || '';
    document.getElementById('sm-course-format').value = existingData.course_format || '';
    document.getElementById('sm-location').value = existingData.location || '';
    document.getElementById('sm-billing-name').value = existingData.billing_name || '';
    document.getElementById('sm-billing-email').value = existingData.billing_email || '';
    // Billing address — prefer split fields, fall back to parsing legacy billing_address
    if (existingData.billing_street || existingData.billing_postcode) {
      document.getElementById('sm-billing-street').value = existingData.billing_street || '';
      document.getElementById('sm-billing-street-number').value =
        existingData.billing_street_number || '';
      document.getElementById('sm-billing-postcode').value = existingData.billing_postcode || '';
      document.getElementById('sm-billing-city').value = existingData.billing_city || '';
    } else if (existingData.billing_address) {
      const [streetPart = '', cityPart = ''] = existingData.billing_address
        .split(',')
        .map((p) => p.trim());
      const streetM = streetPart.match(/^(.+?)\s+(\d+\w*)$/);
      if (streetM) {
        document.getElementById('sm-billing-street').value = streetM[1];
        document.getElementById('sm-billing-street-number').value = streetM[2];
      } else {
        document.getElementById('sm-billing-street').value = streetPart;
      }
      const cityM = cityPart.match(/^(\d{4,5})\s+(.+)$/);
      if (cityM) {
        document.getElementById('sm-billing-postcode').value = cityM[1];
        document.getElementById('sm-billing-city').value = cityM[2];
      }
    }
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
    nationality: document.getElementById('sm-nationality').value.trim() || null,
    street: document.getElementById('sm-street').value.trim() || null,
    street_number: document.getElementById('sm-street-number').value.trim() || null,
    postcode: document.getElementById('sm-postcode').value.trim() || null,
    city: document.getElementById('sm-city').value.trim() || null,
    emergency_contact: document.getElementById('sm-ec-name').value.trim() || null,
    ec_phone: document.getElementById('sm-ec-phone').value.trim() || null,
    ec_email: document.getElementById('sm-ec-email').value.trim() || null,
    ec_relationship: document.getElementById('sm-ec-relationship').value.trim() || null,
    native_language: document.getElementById('sm-native-lang').value.trim() || null,
    target_language: document.getElementById('sm-target-lang').value.trim() || null,
    current_level: document.getElementById('sm-level').value || null,
    learning_goals: document.getElementById('sm-learning-goals').value.trim() || null,
    desired_start_date: document.getElementById('sm-desired-start').value || null,
    course_type: document.getElementById('sm-course-type').value || null,
    course_format: document.getElementById('sm-course-format').value || null,
    location: document.getElementById('sm-location').value || null,
    billing_name: document.getElementById('sm-billing-name').value.trim() || null,
    billing_street: document.getElementById('sm-billing-street').value.trim() || null,
    billing_street_number: document.getElementById('sm-billing-street-number').value.trim() || null,
    billing_postcode: document.getElementById('sm-billing-postcode').value.trim() || null,
    billing_city: document.getElementById('sm-billing-city').value.trim() || null,
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

export async function deleteStudent(studentId) {
  if (!confirm('Delete this student? This cannot be undone.')) return;
  try {
    const res = await apiFetch('/api/delete-student?id=' + studentId, { method: 'DELETE' });
    const result = await res.json();
    if (!res.ok) {
      alert(result.error || 'Could not delete student.');
      return;
    }
    loadStudents(currentStudentFilter);
  } catch {
    alert('Could not delete student.');
  }
}

export async function copyIntakeLink(studentId, accessToken) {
  if (!accessToken) {
    alert('This student has no access token. Edit and save the student first.');
    return;
  }
  // Reset token_created_at so the 90-day expiry window starts from now
  try {
    await apiFetch('/api/save-student', {
      method: 'POST',
      body: { id: studentId, token_created_at: new Date().toISOString() },
    });
  } catch {
    // Non-fatal — still copy the link
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
