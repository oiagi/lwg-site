/* ── Students tab ─────────────────────────────────────────────────── */
import { apiFetch } from '../core/api.js';
import { esc } from '../core/helpers.js';
import { MESSAGE_TIMEOUT_MS } from '../core/constants.js';

let currentStudentFilter = 'active';
let currentStudentSearch = '';
let currentStudentSort = 'name';
let currentStudentSortDir = 'asc';
let selectedStudentId = null;
let fromCourseContext = null;
let studentControlsAttached = false;
let studentSearchTimer = null;

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

function buildStudentQuery(status) {
  const params = new URLSearchParams();
  if (status !== 'all') params.set('status', status);
  if (currentStudentSearch) params.set('q', currentStudentSearch);
  if (currentStudentSort !== 'name') params.set('sort', currentStudentSort);
  if (currentStudentSortDir !== 'asc') params.set('dir', currentStudentSortDir);
  const qs = params.toString();
  return qs ? '?' + qs : '';
}

function attachStudentListControls() {
  if (studentControlsAttached) return;
  const searchEl = document.getElementById('student-search');
  const sortEl = document.getElementById('student-sort');
  const dirEl = document.getElementById('student-sort-dir');
  if (!searchEl || !sortEl || !dirEl) return;

  studentControlsAttached = true;
  searchEl.value = currentStudentSearch;
  sortEl.value = currentStudentSort;
  dirEl.dataset.dir = currentStudentSortDir;
  dirEl.textContent = currentStudentSortDir === 'desc' ? '↓' : '↑';
  dirEl.setAttribute(
    'aria-label',
    currentStudentSortDir === 'desc' ? 'Sort descending' : 'Sort ascending'
  );

  searchEl.addEventListener('input', () => {
    currentStudentSearch = searchEl.value.trim();
    clearTimeout(studentSearchTimer);
    studentSearchTimer = setTimeout(() => loadStudents(currentStudentFilter), 250);
  });
  sortEl.addEventListener('change', () => {
    currentStudentSort = sortEl.value || 'name';
    currentStudentSortDir = currentStudentSort === 'created_at' ? 'desc' : 'asc';
    dirEl.dataset.dir = currentStudentSortDir;
    dirEl.textContent = currentStudentSortDir === 'desc' ? '↓' : '↑';
    dirEl.setAttribute(
      'aria-label',
      currentStudentSortDir === 'desc' ? 'Sort descending' : 'Sort ascending'
    );
    loadStudents(currentStudentFilter);
  });
  dirEl.addEventListener('click', () => {
    currentStudentSortDir = currentStudentSortDir === 'desc' ? 'asc' : 'desc';
    dirEl.dataset.dir = currentStudentSortDir;
    dirEl.textContent = currentStudentSortDir === 'desc' ? '↓' : '↑';
    dirEl.setAttribute(
      'aria-label',
      currentStudentSortDir === 'desc' ? 'Sort descending' : 'Sort ascending'
    );
    loadStudents(currentStudentFilter);
  });
}

export async function loadStudents(status = 'active') {
  attachStudentListControls();
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
    const qs = buildStudentQuery(status);
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

export async function selectStudent(id, { updateUrl = true } = {}) {
  if (selectedStudentId === id) return;
  selectedStudentId = id;
  fromCourseContext = null;
  if (updateUrl) history.pushState({}, '', '#students/' + id);
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
  history.replaceState({}, '', '#students/' + studentId);
}

async function loadStudentsKeepingContext(status, keepSelectedId) {
  attachStudentListControls();
  const list = document.getElementById('student-list');
  if (!list.querySelector('.student-row')) {
    list.innerHTML = '<div class="loading-state">loading…</div>';
  }
  try {
    const qs = buildStudentQuery(status);
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
      ${
        s.access_token
          ? `<button class="save-btn" data-action="copyIntakeLink" data-args="${esc(s.access_token)}">copy intake link</button>
             <span class="detail-action-msg" id="intake-msg-${s.id}"></span>`
          : ''
      }
      <button class="delete-btn" data-action="deleteStudent" data-args="${s.id}">delete</button>
    </div>
  `;
}

export function copyIntakeLink(token, btn) {
  const url = `${window.location.origin}/intake.html?token=${encodeURIComponent(token)}`;
  const msgEl = btn?.parentElement?.querySelector('.detail-action-msg');
  const done = (text) => {
    if (msgEl) {
      msgEl.textContent = text;
      msgEl.style.display = 'inline';
      setTimeout(() => {
        msgEl.style.display = 'none';
      }, MESSAGE_TIMEOUT_MS);
    }
  };

  if (navigator.clipboard?.writeText) {
    navigator.clipboard
      .writeText(url)
      .then(() => done('link copied'))
      .catch(() => prompt('Copy this intake link:', url));
  } else {
    prompt('Copy this intake link:', url);
  }
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

export function editStudent(studentId) {
  window.location.href = '/admin/pages/student-form.html?id=' + encodeURIComponent(studentId);
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
