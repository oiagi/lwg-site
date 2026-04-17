/* ── Students tab ─────────────────────────────────────────────────── */
import { apiFetch } from './api.js';
import { esc } from './helpers.js';
import { MESSAGE_TIMEOUT_MS } from './constants.js';

let currentStudentFilter = 'active';
let selectedStudentId = null;
let fromCourseContext = null;

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

function subjectLabel(s) {
  if (s.target_language) return s.target_language;
  if (s.service === 'tutoring' || s.service === 'gymivorbereitung') return 'Tutoring';
  if (s.service === 'exam preparation') return 'Exam prep';
  if (s.service === 'language course') return 'Language';
  return '';
}

function statusLabel(s) {
  return s.status || (s.active === false ? 'inactive' : 'active');
}

function renderStudents(students) {
  const list = document.getElementById('student-list');
  if (!students.length) {
    list.innerHTML = '<div class="empty-state">no students found</div>';
    return;
  }

  const header = `
    <div class="student-list-header">
      <span>Ref</span>
      <span>Name</span>
      <span style="text-align:right;">Status</span>
    </div>`;

  const rows = students
    .map((s) => {
      const name = esc([s.first_name, s.last_name].filter(Boolean).join(' ')) || '—';
      const ref = esc(s.customer_reference) || '—';
      const subject = esc(subjectLabel(s));
      const level = esc(s.current_level || '');
      const status = statusLabel(s);
      const subParts = [subject, level].filter(Boolean);
      const subLine = subParts.length
        ? subParts.join('<span class="sep">·</span>')
        : '<span class="detail-muted">no course set</span>';
      return `
    <div class="student-row" id="student-${s.id}"
         role="option" aria-selected="false" tabindex="0"
         data-action="selectStudent" data-args="${s.id}">
      <span class="student-ref">${ref}</span>
      <span class="student-name">${name}</span>
      <span class="student-status ${esc(status)}">${esc(status)}</span>
      <span class="student-sub">${subLine}</span>
    </div>`;
    })
    .join('');

  list.innerHTML = header + rows;
}

export async function selectStudent(id) {
  if (selectedStudentId === id) return;
  selectedStudentId = id;
  // Selections triggered from within the students tab clear any course breadcrumb.
  fromCourseContext = null;
  await fetchAndRenderStudent(id);
}

async function fetchAndRenderStudent(id) {
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
    pane.innerHTML = '<p class="detail-error">Could not load student details.</p>';
  }
}

export async function selectStudentFromCourse(studentId, courseId, courseCode) {
  fromCourseContext = { courseId, courseCode };
  // Skip the default loadStudents so loadStudentsKeepingContext can scroll-to-row instead.
  const ev = new CustomEvent('admin:switchTab', {
    detail: { tab: 'students', skipReload: true },
  });
  document.dispatchEvent(ev);
  selectedStudentId = studentId;
  await loadStudentsKeepingContext(currentStudentFilter, studentId);
  await fetchAndRenderStudent(studentId);
}

async function loadStudentsKeepingContext(status, keepSelectedId) {
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
    if (keepSelectedId) {
      const row = document.getElementById('student-' + keepSelectedId);
      if (row) row.scrollIntoView({ block: 'nearest' });
    }
  } catch {
    list.innerHTML = '<div class="loading-state">Could not load students.</div>';
  }
}

function renderStudentDetail(container, s) {
  const coursesHtml =
    s.courses && s.courses.length
      ? s.courses
          .map(
            (c) =>
              `<span class="course-tag">${esc(c.course_code) || '—'} · ${esc(c.service)} · <em>${esc(c.status)}</em></span>`
          )
          .join('')
      : '<span class="detail-muted">no courses</span>';

  const fullName = esc([s.first_name, s.last_name].filter(Boolean).join(' ')) || '—';
  const status = statusLabel(s);
  const refLine = s.customer_reference
    ? `<span class="detail-header-ref">${esc(s.customer_reference)}</span>`
    : '';

  const breadcrumb = fromCourseContext
    ? `<button class="detail-breadcrumb" data-action="backToCourse" data-args="${esc(fromCourseContext.courseId)}">
         <span class="crumb-arrow">←</span> back to course ${esc(fromCourseContext.courseCode || '')}
       </button>`
    : '';

  const hasPersonalAddress = s.street || s.postcode || s.city;
  const hasBillingAddress =
    s.billing_street || s.billing_postcode || s.billing_city || s.billing_name;

  const personalBlock = `
    <div>
      <p class="detail-meta">Personal</p>
      <p class="detail-body">
        ${fullName}<br>
        ${s.email ? esc(s.email) + '<br>' : ''}
        ${s.phone ? esc(s.phone) + '<br>' : ''}
        ${hasPersonalAddress ? esc([s.street, s.street_number].filter(Boolean).join(' ')) + '<br>' + esc([s.postcode, s.city].filter(Boolean).join(' ')) : '<span class="detail-muted">no address</span>'}
      </p>
    </div>`;

  const ecBlock =
    s.emergency_contact || s.ec_phone || s.ec_email
      ? `
    <div>
      <p class="detail-meta">Emergency contact</p>
      <p class="detail-body">
        ${esc(s.emergency_contact || '')}${s.ec_relationship ? ' <span class="detail-muted">(' + esc(s.ec_relationship) + ')</span>' : ''}<br>
        ${s.ec_phone ? esc(s.ec_phone) + '<br>' : ''}
        ${s.ec_email ? esc(s.ec_email) : ''}
      </p>
    </div>`
      : `
    <div>
      <p class="detail-meta">Emergency contact</p>
      <p class="detail-body detail-muted">—</p>
    </div>`;

  const billingBlock = `
    <div>
      <p class="detail-meta">Billing</p>
      <p class="detail-body">
        ${
          hasBillingAddress
            ? `${esc(s.billing_name) || fullName}<br>
               ${s.billing_email ? esc(s.billing_email) + '<br>' : ''}
               ${s.billing_phone ? esc(s.billing_phone) + '<br>' : ''}
               ${esc([s.billing_street, s.billing_street_number].filter(Boolean).join(' '))}<br>
               ${esc([s.billing_postcode, s.billing_city].filter(Boolean).join(' '))}`
            : '<span class="detail-muted">same as personal</span>'
        }
        ${s.vat_number ? '<br><span class="detail-muted">VAT: ' + esc(s.vat_number) + '</span>' : ''}
      </p>
    </div>`;

  const prefParts = [];
  if (s.service) prefParts.push(['Service', esc(s.service)]);
  if (s.target_language) prefParts.push(['Target', esc(s.target_language)]);
  if (s.native_language) prefParts.push(['Native', esc(s.native_language)]);
  if (s.current_level) prefParts.push(['Level', esc(s.current_level)]);
  if (s.course_type) prefParts.push(['Size', esc(s.course_type)]);
  if (s.course_format) prefParts.push(['Format', esc(s.course_format)]);
  if (s.location) prefParts.push(['Location', esc(s.location)]);
  if (s.grade) prefParts.push(['Grade', esc(s.grade)]);
  if (s.subjects) prefParts.push(['Subjects', esc(s.subjects)]);
  const prefsHtml = prefParts.length
    ? prefParts
        .map(
          ([k, v]) =>
            `<span class="detail-body" style="display:inline-block;margin-right:1rem;"><span class="detail-muted">${k}:</span> ${v}</span>`
        )
        .join('')
    : '<span class="detail-muted">none set</span>';

  const adminParts = [];
  if (s.rate_per_session)
    adminParts.push(['Rate', `${esc(s.rate_per_session)} ${esc(s.currency || 'CHF')}`]);
  if (s.payment_method) adminParts.push(['Payment', esc(s.payment_method)]);
  if (s.referral_source) adminParts.push(['Referral', esc(s.referral_source)]);
  const adminHtml = adminParts.length
    ? adminParts
        .map(
          ([k, v]) =>
            `<span class="detail-body" style="display:inline-block;margin-right:1rem;"><span class="detail-muted">${k}:</span> ${v}</span>`
        )
        .join('')
    : '';

  container.innerHTML = `
    ${breadcrumb}
    <div class="detail-header">
      <div>
        <span class="detail-header-name">${fullName}</span>${refLine}
      </div>
      <span class="detail-header-status ${esc(status)}">${esc(status)}</span>
    </div>
    <div class="detail-grid">
      ${personalBlock}
      ${ecBlock}
    </div>
    <div class="detail-grid">
      ${billingBlock}
      <div>
        <p class="detail-meta">Courses</p>
        <div>${coursesHtml}</div>
      </div>
    </div>
    <div class="detail-section">
      <p class="detail-meta">Course preferences</p>
      <div>${prefsHtml}</div>
      ${s.learning_goals ? '<p class="detail-note">Goals: ' + esc(s.learning_goals) + '</p>' : ''}
      ${s.desired_start_date ? '<p class="detail-note">Start date: ' + esc(s.desired_start_date) + '</p>' : ''}
    </div>
    ${
      adminHtml || s.progress_notes
        ? `
    <div class="detail-section">
      <p class="detail-meta">Admin</p>
      <div>${adminHtml}</div>
      ${s.progress_notes ? '<p class="detail-note">' + esc(s.progress_notes) + '</p>' : ''}
    </div>`
        : ''
    }
    ${s.consent_given ? '<p class="detail-hint">Consent given' + (s.consent_date ? ' on ' + new Date(s.consent_date).toLocaleDateString('de-CH') : '') + '</p>' : ''}
    <div class="detail-actions">
      <button class="save-btn" data-action="editStudent" data-args="${s.id}">edit</button>
      <button class="delete-btn" data-action="deleteStudent" data-args="${s.id}">delete</button>
    </div>
  `;
}

export function backToCourse(courseId) {
  fromCourseContext = null;
  const ev = new CustomEvent('admin:switchTab', {
    detail: { tab: 'courses', openCourseId: courseId },
  });
  document.dispatchEvent(ev);
}

/* ── Student modal ───────────────────────────────────────────────── */

export function openStudentModal(existingData) {
  const allFields = [
    'sm-id',
    'sm-first-name',
    'sm-last-name',
    'sm-email',
    'sm-phone',
    'sm-street',
    'sm-street-number',
    'sm-postcode',
    'sm-city',
    'sm-ec-name',
    'sm-ec-phone',
    'sm-ec-email',
    'sm-ec-relationship',
    'sm-service',
    'sm-native-lang',
    'sm-target-lang',
    'sm-level',
    'sm-grade',
    'sm-subjects',
    'sm-learning-goals',
    'sm-desired-start',
    'sm-course-type',
    'sm-course-format',
    'sm-location',
    'sm-billing-name',
    'sm-billing-phone',
    'sm-billing-street',
    'sm-billing-street-number',
    'sm-billing-postcode',
    'sm-billing-city',
    'sm-billing-email',
    'sm-rate',
    'sm-vat',
    'sm-payment-method',
    'sm-referral',
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
    document.getElementById('sm-street').value = existingData.street || '';
    document.getElementById('sm-street-number').value = existingData.street_number || '';
    document.getElementById('sm-postcode').value = existingData.postcode || '';
    document.getElementById('sm-city').value = existingData.city || '';
    document.getElementById('sm-ec-name').value = existingData.emergency_contact || '';
    document.getElementById('sm-ec-phone').value = existingData.ec_phone || '';
    document.getElementById('sm-ec-email').value = existingData.ec_email || '';
    document.getElementById('sm-ec-relationship').value = existingData.ec_relationship || '';
    document.getElementById('sm-service').value = existingData.service || '';
    document.getElementById('sm-native-lang').value = existingData.native_language || '';
    document.getElementById('sm-target-lang').value = existingData.target_language || '';
    document.getElementById('sm-level').value = existingData.current_level || '';
    document.getElementById('sm-grade').value = existingData.grade || '';
    document.getElementById('sm-subjects').value = existingData.subjects || '';
    document.getElementById('sm-learning-goals').value = existingData.learning_goals || '';
    document.getElementById('sm-desired-start').value = existingData.desired_start_date || '';
    document.getElementById('sm-course-type').value = existingData.course_type || '';
    document.getElementById('sm-course-format').value = existingData.course_format || '';
    document.getElementById('sm-location').value = existingData.location || '';
    document.getElementById('sm-billing-name').value = existingData.billing_name || '';
    document.getElementById('sm-billing-phone').value = existingData.billing_phone || '';
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
    document.getElementById('sm-notes').value = existingData.progress_notes || '';
    // Resolve status from status field, falling back to active boolean for old records
    const resolvedStatus =
      existingData.status || (existingData.active !== false ? 'active' : 'inactive');
    document.getElementById('sm-status').value = resolvedStatus;
  }

  // Billing address toggle
  const hasBilling = !!(
    existingData?.billing_street ||
    existingData?.billing_postcode ||
    existingData?.billing_name
  );
  resetBillingToggle(hasBilling);
  resetServiceToggle(existingData?.service);

  document.getElementById('student-modal').classList.add('open');
}

function resetBillingToggle(hasBillingData) {
  const cb = document.getElementById('sm-billing-separate');
  const section = document.getElementById('sm-billing-section');
  const hint = document.getElementById('sm-billing-hint');
  cb.checked = hasBillingData;
  section.style.display = hasBillingData ? 'block' : 'none';
  if (hint) hint.style.display = hasBillingData ? 'none' : 'block';
  cb.onchange = (e) => {
    const show = e.target.checked;
    section.style.display = show ? 'block' : 'none';
    if (hint) hint.style.display = show ? 'none' : 'block';
    if (!show) {
      [
        'sm-billing-name',
        'sm-billing-phone',
        'sm-billing-email',
        'sm-billing-street',
        'sm-billing-street-number',
        'sm-billing-postcode',
        'sm-billing-city',
      ].forEach((id) => {
        document.getElementById(id).value = '';
      });
    }
  };
}

function resetServiceToggle(service) {
  const sel = document.getElementById('sm-service');
  const langFields = document.getElementById('sm-lang-fields');
  const tutFields = document.getElementById('sm-tutoring-fields');

  function apply(val) {
    const isTutoring = val === 'tutoring' || val === 'gymivorbereitung';
    langFields.style.display = isTutoring ? 'none' : 'contents';
    tutFields.style.display = val === 'tutoring' ? 'contents' : 'none';
  }

  sel.value = service || '';
  apply(sel.value);
  sel.onchange = (e) => apply(e.target.value);
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
    street: document.getElementById('sm-street').value.trim() || null,
    street_number: document.getElementById('sm-street-number').value.trim() || null,
    postcode: document.getElementById('sm-postcode').value.trim() || null,
    city: document.getElementById('sm-city').value.trim() || null,
    emergency_contact: document.getElementById('sm-ec-name').value.trim() || null,
    ec_phone: document.getElementById('sm-ec-phone').value.trim() || null,
    ec_email: document.getElementById('sm-ec-email').value.trim() || null,
    ec_relationship: document.getElementById('sm-ec-relationship').value.trim() || null,
    service: document.getElementById('sm-service').value || null,
    ...(document.getElementById('sm-service').value === 'tutoring'
      ? {
          native_language: null,
          target_language: null,
          current_level: null,
          grade: document.getElementById('sm-grade').value || null,
          subjects: document.getElementById('sm-subjects').value.trim() || null,
        }
      : {
          native_language: document.getElementById('sm-native-lang').value.trim() || null,
          target_language: document.getElementById('sm-target-lang').value || null,
          current_level: document.getElementById('sm-level').value || null,
          grade: null,
          subjects: null,
        }),
    learning_goals: document.getElementById('sm-learning-goals').value.trim() || null,
    desired_start_date: document.getElementById('sm-desired-start').value || null,
    course_type: document.getElementById('sm-course-type').value || null,
    course_format: document.getElementById('sm-course-format').value || null,
    location: document.getElementById('sm-location').value || null,
    ...(document.getElementById('sm-billing-separate').checked
      ? {
          billing_name: document.getElementById('sm-billing-name').value.trim() || null,
          billing_phone: document.getElementById('sm-billing-phone').value.trim() || null,
          billing_street: document.getElementById('sm-billing-street').value.trim() || null,
          billing_street_number:
            document.getElementById('sm-billing-street-number').value.trim() || null,
          billing_postcode: document.getElementById('sm-billing-postcode').value.trim() || null,
          billing_city: document.getElementById('sm-billing-city').value.trim() || null,
          billing_email: document.getElementById('sm-billing-email').value.trim() || null,
        }
      : {
          billing_name: null,
          billing_phone: null,
          billing_street: null,
          billing_street_number: null,
          billing_postcode: null,
          billing_city: null,
          billing_email: null,
        }),
    rate_per_session: document.getElementById('sm-rate').value
      ? parseFloat(document.getElementById('sm-rate').value)
      : null,
    vat_number: document.getElementById('sm-vat').value.trim() || null,
    payment_method: document.getElementById('sm-payment-method').value || null,
    referral_source: document.getElementById('sm-referral').value.trim() || null,
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
    msgEl.className = 'modal-msg success';
    btn.textContent = 'saved ✓';

    setTimeout(() => {
      closeStudentModal();
      loadStudents(currentStudentFilter);
    }, MESSAGE_TIMEOUT_MS);
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
