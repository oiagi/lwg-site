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

function courseSubLine(s) {
  const activeCourses = (s.courses || []).filter(
    (c) => c.status !== 'cancelled' && c.status !== 'completed'
  );
  const primary = activeCourses[0] || (s.courses && s.courses[0]);
  if (primary) {
    const parts = [primary.course_code, primary.level, primary.service].filter(Boolean);
    const label = parts.join(' · ');
    const extra = s.courses.length - 1 > 0 ? ` +${s.courses.length - 1}` : '';
    return esc(label) + esc(extra);
  }
  const subject = esc(subjectLabel(s));
  const level = esc(s.current_level || '');
  const fallback = [subject, level].filter(Boolean);
  return fallback.length
    ? fallback.join('<span class="sep">·</span>')
    : '<span class="detail-muted">no course</span>';
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
      const status = statusLabel(s);
      const subLine = courseSubLine(s);
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

  const enrolButton = `<button class="save-btn" data-action="openEnrollStudentModal" data-args="${esc(s.id)}" style="margin-top:0.6rem;">+ enroll in course</button>`;

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

  const adminHtml = renderAdminSection(s);

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
        ${enrolButton}
      </div>
    </div>
    <div class="detail-section">
      <p class="detail-meta">Admin</p>
      ${adminHtml}
    </div>
    ${s.consent_given ? '<p class="detail-hint">Consent given' + (s.consent_date ? ' on ' + new Date(s.consent_date).toLocaleDateString('de-CH') : '') + '</p>' : ''}
    <div class="detail-actions">
      <button class="save-btn" data-action="editStudent" data-args="${s.id}">edit</button>
      <button class="delete-btn" data-action="deleteStudent" data-args="${s.id}">delete</button>
    </div>
  `;
}

// Admin section: one read-only row per enrolled course. Values come directly
// from the course record; open charges are the sum of the student's unpaid
// invoices linked to that course.
function renderAdminSection(s) {
  const courses = s.courses || [];
  const invoices = s.invoices || [];

  const openByCourse = {};
  for (const inv of invoices) {
    if (inv.status === 'paid' || !inv.course_id) continue;
    openByCourse[inv.course_id] =
      (openByCourse[inv.course_id] || 0) + Number(inv.total_amount || 0);
  }

  const metaRows = [
    ['status', esc(statusLabel(s))],
    ['payment method', esc(s.payment_method) || '—'],
    ['VAT number', esc(s.vat_number) || '—'],
  ]
    .map(
      ([k, v]) =>
        `<div class="detail-row"><span class="detail-key">${k}</span><span class="detail-val">${v}</span></div>`
    )
    .join('');

  const metaBlock = `<div class="admin-meta-grid">${metaRows}</div>`;

  const notesBlock = s.progress_notes ? `<p class="detail-note">${esc(s.progress_notes)}</p>` : '';

  if (!courses.length) {
    return `${metaBlock}${notesBlock}<p class="detail-muted" style="margin-top:0.8rem;">No courses enrolled yet.</p>`;
  }

  const courseRows = courses
    .map((c) => {
      const currency = esc(c.currency || 'CHF');
      const priceCell =
        c.price_per_session !== null && c.price_per_session !== undefined
          ? `${Number(c.price_per_session).toFixed(2)} ${currency}`
          : '—';
      const lengthCell = c.session_length_minutes ? `${c.session_length_minutes} min` : '—';
      const openAmount = openByCourse[c.id] || 0;
      const openCell = openAmount
        ? `<span class="charges-open">${openAmount.toFixed(2)} ${currency}</span>`
        : '<span class="detail-muted">none</span>';
      return `
      <tr>
        <td class="admin-course-code">${esc(c.course_code) || '—'}</td>
        <td>${c.sessions_total !== null && c.sessions_total !== undefined ? esc(String(c.sessions_total)) : '<span class="detail-muted">open</span>'}</td>
        <td>${lengthCell}</td>
        <td>${priceCell}</td>
        <td>${openCell}</td>
        <td>${esc(c.level) || '—'}</td>
        <td>${esc(c.service) || '—'}</td>
        <td>${esc(c.location) || '—'}</td>
      </tr>`;
    })
    .join('');

  const courseTable = `
    <div class="admin-course-table-wrap">
      <table class="admin-course-table">
        <thead>
          <tr>
            <th>course</th>
            <th>sessions</th>
            <th>length</th>
            <th>price/session</th>
            <th>open charges</th>
            <th>level</th>
            <th>subject</th>
            <th>location</th>
          </tr>
        </thead>
        <tbody>${courseRows}</tbody>
      </table>
    </div>`;

  return `${metaBlock}${courseTable}${notesBlock}`;
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
    'sm-billing-name',
    'sm-billing-phone',
    'sm-billing-street',
    'sm-billing-street-number',
    'sm-billing-postcode',
    'sm-billing-city',
    'sm-billing-email',
    'sm-vat',
    'sm-payment-method',
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
    document.getElementById('sm-vat').value = existingData.vat_number || '';
    document.getElementById('sm-payment-method').value = existingData.payment_method || '';
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
    vat_number: document.getElementById('sm-vat').value.trim() || null,
    payment_method: document.getElementById('sm-payment-method').value || null,
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

/* ── Enroll-in-course modal ──────────────────────────────────────── */

let enrollStudentId = null;

export async function openEnrollStudentModal(studentId) {
  enrollStudentId = studentId;
  const modal = document.getElementById('enroll-student-modal');
  const sel = document.getElementById('es-course');
  const msg = document.getElementById('es-msg');
  const btn = document.getElementById('es-submit');

  msg.style.display = 'none';
  msg.textContent = '';
  btn.textContent = 'enroll';
  btn.disabled = true;
  sel.innerHTML = '<option value="">loading courses…</option>';

  modal.classList.add('open');

  try {
    // Load active + all courses, and currently enrolled courses, in parallel.
    const [coursesRes, studentRes] = await Promise.all([
      apiFetch('/api/get-courses?status=active'),
      apiFetch('/api/get-student-detail?id=' + studentId),
    ]);
    if (!coursesRes.ok) throw new Error('Could not load courses');
    const courses = await coursesRes.json();
    const student = studentRes.ok ? await studentRes.json() : { courses: [] };
    const enrolledIds = new Set((student.courses || []).map((c) => c.id));

    const available = courses.filter((c) => !enrolledIds.has(c.id));
    if (!available.length) {
      sel.innerHTML = '<option value="">no available courses</option>';
      msg.textContent = 'Student is already enrolled in all active courses.';
      msg.className = 'modal-msg';
      msg.style.display = 'block';
      return;
    }

    sel.innerHTML =
      '<option value="">select a course…</option>' +
      available
        .map((c) => {
          const label = [c.course_code, c.service, c.level].filter(Boolean).join(' · ');
          return `<option value="${esc(c.id)}">${esc(label || c.id)}</option>`;
        })
        .join('');

    sel.onchange = () => {
      btn.disabled = !sel.value;
    };
  } catch {
    sel.innerHTML = '<option value="">error loading</option>';
    msg.textContent = 'Could not load courses.';
    msg.className = 'modal-msg err';
    msg.style.display = 'block';
  }
}

export function closeEnrollStudentModal() {
  document.getElementById('enroll-student-modal').classList.remove('open');
  enrollStudentId = null;
}

export async function submitEnrollStudent() {
  const btn = document.getElementById('es-submit');
  const msg = document.getElementById('es-msg');
  const courseId = document.getElementById('es-course').value;
  if (!courseId || !enrollStudentId) return;

  btn.disabled = true;
  btn.textContent = 'enrolling…';
  msg.style.display = 'none';

  try {
    const res = await apiFetch('/api/add-enrollment', {
      method: 'POST',
      body: { course_id: courseId, student_id: enrollStudentId },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed');
    }
    btn.textContent = 'enrolled ✓';
    const sid = enrollStudentId;
    setTimeout(async () => {
      closeEnrollStudentModal();
      selectedStudentId = sid;
      await loadStudentsKeepingContext(currentStudentFilter, sid);
      await fetchAndRenderStudent(sid);
    }, MESSAGE_TIMEOUT_MS);
  } catch (e) {
    msg.textContent = 'Error: ' + e.message;
    msg.className = 'modal-msg err';
    msg.style.display = 'block';
    btn.textContent = 'enroll';
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
