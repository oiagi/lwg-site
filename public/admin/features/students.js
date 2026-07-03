/* ── Students tab ─────────────────────────────────────────────────── */
import { apiFetch } from '../core/api.js';
import { esc, queryString, attachListControls } from '../core/helpers.js';
import { MESSAGE_TIMEOUT_MS } from '../core/constants.js';
import { openConfirmSend } from './confirm-send.js';

let currentStudentFilter = 'active';
const studentListState = { search: '', sort: 'name', direction: 'asc' };
let selectedStudentId = null;
let fromCourseContext = null;
let studentControlsAttached = false;
let currentStudentDetail = null;
const filterFlagCounts = { active: null, all: null, inactive: null };
let filterCountsInitialized = false;

export function getCurrentStudentFilter() {
  return currentStudentFilter;
}

export function filterStudents(active) {
  currentStudentFilter = active;
  setStudentFilterButtonState(active);
  loadStudents(active);
}

function setStudentFilterButtonState(status) {
  document.querySelectorAll('[data-student-status]').forEach((b) => {
    b.classList.toggle('active', b.dataset.studentStatus === status);
  });
}

function buildStudentQuery(status) {
  return queryString({
    ...(status !== 'all' && { status }),
    ...(studentListState.search && { q: studentListState.search }),
    ...(studentListState.sort !== 'name' && { sort: studentListState.sort }),
    ...(studentListState.direction !== 'asc' && { dir: studentListState.direction }),
  });
}

function attachStudentListControls() {
  if (studentControlsAttached) return;
  const searchEl = document.getElementById('student-search');
  const sortEl = document.getElementById('student-sort');
  const dirEl = document.getElementById('student-sort-dir');
  if (!searchEl || !sortEl || !dirEl) return;

  studentControlsAttached = true;
  attachListControls({
    searchEl,
    sortEl,
    directionEl: dirEl,
    state: studentListState,
    defaults: { sort: 'name' },
    onSearch: () => loadStudents(currentStudentFilter),
    onChange: () => loadStudents(currentStudentFilter),
  });
}

export async function loadStudents(status = 'active') {
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
    const totalRequests = Number(res.headers.get('X-Untreated-Request-Count')) || null;
    filterFlagCounts[status] =
      totalRequests ?? students.reduce((sum, s) => sum + Number(s.pending_request_count || 0), 0);
    updateFilterBadges();
    renderStudents(students, totalRequests);
    restoreStudentSelection(students);
    if (!filterCountsInitialized) {
      filterCountsInitialized = true;
      ['active', 'all', 'inactive'].filter((s) => s !== status).forEach(fetchStudentFlagCount);
    }
  } catch {
    list.innerHTML =
      '<div class="loading-state">Could not load students. <button type="button" class="inline-link-btn">Retry</button></div>';
    list.querySelector('button').addEventListener('click', () => loadStudents(status));
  }
}

function clearStudentDetailPane() {
  selectedStudentId = null;
  currentStudentDetail = null;
  const pane = document.getElementById('student-detail-panel');
  if (!pane) return;
  pane.className = 'student-detail-empty';
  pane.innerHTML = '<p>select a student to view their details</p>';
}

function restoreStudentSelection(students) {
  if (!selectedStudentId) {
    clearStudentDetailPane();
    return;
  }
  const stillVisible = students.some((s) => String(s.id) === String(selectedStudentId));
  if (!stillVisible) {
    clearStudentDetailPane();
    return;
  }
  document.querySelectorAll('.student-row').forEach((row) => {
    const isSelected = row.id === 'student-' + selectedStudentId;
    row.classList.toggle('selected', isSelected);
    row.setAttribute('aria-selected', String(isSelected));
  });
}

function subjectLabel(s) {
  if (s.target_language) return s.target_language;
  if (s.service === 'tutoring' || s.service === 'gymivorbereitung') return 'Tutoring';
  if (s.service === 'exam preparation') return 'Exam prep';
  if (s.service === 'language course') return 'Language';
  return '';
}

function courseSubLine(s) {
  if (s.pending_request_count) {
    const request = (s.pending_requests || [])[0] || {};
    const course = request.course || {};
    const booking = request.booking_data || {};
    const label =
      [
        course.course_code || booking.course_code,
        course.level || booking.level,
        course.course_type || booking.course_type,
      ]
        .filter(Boolean)
        .join(' · ') || 'untreated request';
    const extra = s.pending_request_count > 1 ? ` +${s.pending_request_count - 1}` : '';
    return `<span class="request-subline">${esc(label)}${esc(extra)}</span>`;
  }
  const activeCourses = (s.courses || []).filter((c) => c.status === 'active');
  const primary = activeCourses[0];
  if (primary) {
    const parts = [primary.course_code, primary.level, primary.course_type].filter(Boolean);
    const label = parts.join(' · ');
    const extra = activeCourses.length - 1 > 0 ? ` +${activeCourses.length - 1}` : '';
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

function updateFilterBadges() {
  document.querySelectorAll('[data-student-status]').forEach((btn) => {
    const status = btn.dataset.studentStatus;
    const count = filterFlagCounts[status];
    btn.classList.toggle('has-flag-count', count > 0);
    btn.dataset.flagCount = count > 0 ? String(count) : '';
  });
}

async function fetchStudentFlagCount(status) {
  try {
    const qs = status !== 'all' ? `?status=${status}` : '';
    const res = await apiFetch('/api/get-students' + qs);
    if (!res.ok) return;
    filterFlagCounts[status] = Number(res.headers.get('X-Untreated-Request-Count')) || 0;
    await res.json();
    updateFilterBadges();
    if (status === 'all') updateStudentsSectionFlag([], filterFlagCounts.all);
  } catch {
    /* silent */
  }
}

export async function initStudentTabFlag() {
  await fetchStudentFlagCount('all');
}

function updateStudentsSectionFlag(students, totalRequests = null) {
  const count =
    totalRequests ?? students.reduce((sum, s) => sum + Number(s.pending_request_count || 0), 0);
  const tab = document.getElementById('tab-students');
  if (!tab) return;
  tab.classList.toggle('has-request-flag', count > 0);
  tab.dataset.requestCount = count ? String(count) : '';
  tab.setAttribute('aria-label', count ? `students, ${count} untreated requests` : 'students');
}

function renderStudents(students, totalRequests = null) {
  const list = document.getElementById('student-list');
  updateStudentsSectionFlag(students, totalRequests);
  if (!students.length) {
    list.innerHTML = '<div class="empty-state">no students found</div>';
    return;
  }

  const header = `
    <div class="student-list-header">
      <span>Ref</span>
      <span>Name</span>
      <span class="text-right">Status</span>
    </div>`;

  const rows = students
    .map((s) => {
      const name = esc([s.first_name, s.last_name].filter(Boolean).join(' ')) || '—';
      const ref = esc(s.customer_reference) || '—';
      const status = statusLabel(s);
      const subLine = courseSubLine(s);
      const requestFlag = s.pending_request_count
        ? `<span class="request-flag" title="Untreated request">${s.pending_request_count > 1 ? esc(s.pending_request_count) : '!'}</span>`
        : '';
      return `
    <div class="student-row${s.pending_request_count ? ' has-pending-request' : ''}" id="student-${s.id}"
         role="option" aria-selected="${String(String(s.id) === String(selectedStudentId))}" tabindex="0"
         data-action="selectStudent" data-args="${s.id}">
      <span class="student-ref">${ref}</span>
      <span class="student-name">${requestFlag}${name}</span>
      <span class="student-status ${esc(status)}">${esc(status)}</span>
      <span class="student-sub">${subLine}</span>
    </div>`;
    })
    .join('');

  list.innerHTML = header + rows;
}

export async function selectStudent(id, { updateUrl = true } = {}) {
  if (selectedStudentId === id && currentStudentDetail) return;
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
  if (!pane) return;
  pane.className = '';
  pane.innerHTML = '<div class="loading-state">loading…</div>';

  try {
    const res = await apiFetch('/api/get-student-detail?id=' + encodeURIComponent(id));
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || 'Could not load student details.');
    }
    const s = await res.json();
    currentStudentDetail = s;
    renderStudentDetail(pane, s);
  } catch (err) {
    pane.innerHTML = `<p class="detail-error">${esc(err.message || 'Could not load student details.')}</p>`;
  }
}

function waitForStudentPanel() {
  if (document.getElementById('student-list') && document.getElementById('student-detail-panel')) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    let attempts = 0;
    const tick = () => {
      attempts += 1;
      if (
        document.getElementById('student-list') &&
        document.getElementById('student-detail-panel')
      ) {
        resolve();
      } else if (attempts > 60) {
        resolve();
      } else {
        requestAnimationFrame(tick);
      }
    };
    requestAnimationFrame(tick);
  });
}

export async function selectStudentFromCourse(studentId, courseId, courseCode) {
  fromCourseContext = { courseId, courseCode };
  // Skip the default loadStudents so loadStudentsKeepingContext can scroll-to-row instead.
  const ev = new CustomEvent('admin:switchTab', {
    detail: { tab: 'students', skipReload: true },
  });
  document.dispatchEvent(ev);
  await waitForStudentPanel();
  selectedStudentId = studentId;
  const detailPromise = fetchAndRenderStudent(studentId);
  await loadStudentsKeepingContext(currentStudentFilter, studentId);
  await detailPromise;
  history.replaceState({}, '', '#students/' + studentId);
}

async function loadStudentsKeepingContext(
  status,
  keepSelectedId,
  { allowAllFallback = true } = {}
) {
  attachStudentListControls();
  const list = document.getElementById('student-list');
  if (!list) return;
  if (!list.querySelector('.student-row')) {
    list.innerHTML = '<div class="loading-state">loading…</div>';
  }
  try {
    const qs = buildStudentQuery(status);
    const res = await apiFetch('/api/get-students' + qs);
    if (!res.ok) throw new Error();
    const students = await res.json();
    const totalRequests = Number(res.headers.get('X-Untreated-Request-Count')) || null;
    filterFlagCounts[status] =
      totalRequests ?? students.reduce((sum, s) => sum + Number(s.pending_request_count || 0), 0);
    updateFilterBadges();
    renderStudents(students, totalRequests);
    if (keepSelectedId) {
      const row = document.getElementById('student-' + keepSelectedId);
      if (row) {
        row.classList.add('selected');
        row.setAttribute('aria-selected', 'true');
        row.scrollIntoView({ block: 'nearest' });
      } else if (allowAllFallback && status !== 'all') {
        currentStudentFilter = 'all';
        setStudentFilterButtonState('all');
        await loadStudentsKeepingContext('all', keepSelectedId, { allowAllFallback: false });
      }
    }
  } catch {
    list.innerHTML =
      '<div class="loading-state">Could not load students. <button type="button" class="inline-link-btn">Retry</button></div>';
    list
      .querySelector('button')
      .addEventListener('click', () => loadStudentsKeepingContext(status, keepSelectedId));
  }
}

function renderStudentDetail(container, s) {
  const fmtDate = (value) => new Date(value).toLocaleDateString('de-CH');
  const visibleCourses = (s.courses || []).filter((c) =>
    ['active', 'completed'].includes(c.status)
  );
  const coursesHtml = visibleCourses.length
    ? visibleCourses
        .map(
          (c) =>
            `<button class="course-tag course-tag-link" data-action="openRequestCourse" data-args="${esc(c.id)}">${esc(c.course_code) || '—'} · ${esc(c.course_type)} · <em>${esc(c.status)}</em></button>`
        )
        .join('')
    : '<span class="detail-muted">no courses</span>';

  const enrolButton = `<button class="save-btn mt-medium" data-action="openEnrolStudentModal" data-args="${esc(s.id)}">+ enrol in course</button>`;

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
  const billingGender = s.billing_gender || s.gender || '';
  const billingGenderNote = s.billing_gender_note || '';
  const contactLine = (kind, value, hrefPrefix) => {
    if (!value) return '';
    const safeValue = esc(value);
    const hrefValue = hrefPrefix === 'tel:' ? String(value).replace(/[^\d+]/g, '') : value;
    return `<span class="detail-contact-line">
      <a class="detail-contact-link" href="${hrefPrefix}${esc(hrefValue)}">${safeValue}</a>
      <button class="detail-copy-btn" data-action="copyDetailValue" data-copy-value="${safeValue}" title="Copy ${esc(kind)}">copy</button>
    </span>`;
  };

  const personalBlock = `
    <div>
      <p class="detail-meta">Personal</p>
      <p class="detail-body">
        ${fullName}<br>
        ${s.gender ? esc(s.gender === 'other' && s.gender_note ? `other: ${s.gender_note}` : s.gender) + '<br>' : ''}
        ${contactLine('email', s.email, 'mailto:')}
        ${contactLine('phone', s.phone, 'tel:')}
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
        ${contactLine('phone', s.ec_phone, 'tel:')}
        ${contactLine('email', s.ec_email, 'mailto:')}
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
               ${billingGender ? esc(billingGender === 'other' && billingGenderNote ? `other: ${billingGenderNote}` : billingGender) + '<br>' : ''}
               ${contactLine('email', s.billing_email, 'mailto:')}
               ${contactLine('phone', s.billing_phone, 'tel:')}
               ${esc([s.billing_street, s.billing_street_number].filter(Boolean).join(' '))}<br>
               ${esc([s.billing_postcode, s.billing_city].filter(Boolean).join(' '))}`
            : '<span class="detail-muted">same as personal</span>'
        }
        ${s.vat_number ? '<br><span class="detail-muted">VAT: ' + esc(s.vat_number) + '</span>' : ''}
      </p>
    </div>`;

  const courseCodeById = {};
  (s.courses || []).forEach((c) => {
    courseCodeById[c.id] = c.course_code;
  });
  const contractsHtml = (s.contracts || []).length
    ? (s.contracts || [])
        .map((con) => {
          const courseLabel = courseCodeById[con.course_id] || '—';
          const statusHtml = con.signed_uploaded_at
            ? `<span class="sent-tag paid-tag">signed uploaded · ${esc(fmtDate(con.signed_uploaded_at))}</span>
               <button class="contract-view-btn" data-action="downloadSignedContract"
                 data-args="${esc(con.id)}">view / download</button>`
            : '<span class="detail-muted">awaiting signed upload</span>';
          return `<li class="contract-row">
            <span class="contract-row-main">${esc(courseLabel)} · ${esc(con.contract_ref)}
              <span class="detail-muted">sent ${esc(fmtDate(con.sent_at))}</span></span>
            ${statusHtml}
          </li>`;
        })
        .join('')
    : '';

  const adminHtml = renderAdminSection(s);
  const requestHtml = renderRequestSection(s);
  const requestFlag = s.pending_request_count
    ? `<span class="detail-request-flag">${esc(String(s.pending_request_count))} untreated request${s.pending_request_count === 1 ? '' : 's'}</span>`
    : '';
  const intakeSentTag = s.intake_link_sent_at
    ? `<span class="sent-tag">intake link sent · ${esc(fmtDate(s.intake_link_sent_at))}</span>`
    : '';
  const bookingCodeSentTag = s.booking_code_sent_at
    ? `<span class="sent-tag">booking code sent · ${esc(fmtDate(s.booking_code_sent_at))}</span>`
    : '';

  container.innerHTML = `
    ${breadcrumb}
    <div class="detail-header">
      <div>
        <span class="detail-header-name">${fullName}</span>${refLine}${requestFlag}
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
      <p class="detail-meta">Requests</p>
      ${requestHtml}
    </div>
    ${
      contractsHtml
        ? `<div class="detail-section">
             <p class="detail-meta">Contracts</p>
             <ul class="contract-list">${contractsHtml}</ul>
           </div>`
        : ''
    }
    <div class="detail-section">
      <p class="detail-meta">Admin</p>
      ${adminHtml}
    </div>
    ${s.consent_given ? '<p class="detail-hint">Consent given' + (s.consent_date ? ' on ' + new Date(s.consent_date).toLocaleDateString('de-CH') : '') + '</p>' : ''}
    ${
      s.intake_completed_at
        ? `<div class="detail-section">
             <p class="detail-meta">intake</p>
             <div class="intake-flag">
               <span class="intake-flag-label">Form completed ${fmtDate(s.intake_completed_at)}</span>
               <button class="save-btn" data-action="markIntakeSeen" data-args="${s.id}">mark as seen</button>
               <span class="detail-action-msg" id="intake-seen-msg-${s.id}"></span>
             </div>
           </div>`
        : ''
    }
    <div class="detail-actions">
      <button class="save-btn" data-action="editStudent" data-args="${s.id}">edit</button>
      <button class="save-btn" data-action="sendIntakeLink" data-args="${s.id}">send intake link</button>
      ${
        s.access_token
          ? `<button class="save-btn" data-action="copyIntakeLink" data-args="${esc(s.access_token)}">copy intake link</button>`
          : ''
      }
      ${intakeSentTag}
      ${bookingCodeSentTag}
      <span class="detail-action-msg" id="intake-msg-${s.id}"></span>
      <button class="delete-btn" data-action="deleteStudent" data-args="${s.id}">delete</button>
    </div>
  `;
}

function requestLabel(enquiry) {
  if (enquiry.status === 'pending_course_booking') return 'group booking request';
  if (enquiry.status === 'pending_group_slot_booking') return 'forming group course request';
  return 'enquiry';
}

function requestCourseLabel(enquiry) {
  const course = enquiry.course || {};
  const booking = enquiry.booking_data || {};
  return (
    [
      course.course_code || booking.course_code,
      booking.preferred_level || course.level || booking.level,
      booking.preferred_location || booking.location,
      booking.schedule_text,
      course.course_type || booking.course_type,
    ]
      .filter(Boolean)
      .join(' · ') || 'requested course slot'
  );
}

function requestAgeDays(enquiry) {
  if (!enquiry.created_at) return null;
  const created = new Date(enquiry.created_at);
  if (Number.isNaN(created.getTime())) return null;
  return Math.floor((Date.now() - created.getTime()) / (24 * 60 * 60 * 1000));
}

function renderRequestSection(s) {
  const enquiries = s.enquiries || [];
  if (!enquiries.length) return '<p class="detail-muted">No enquiries or booking requests yet.</p>';

  const untreated = enquiries.filter((enquiry) => enquiry.untreated);
  const history = enquiries.filter((enquiry) => !enquiry.untreated);
  const renderRows = (rows) =>
    rows
      .map((enquiry) => {
        const created = enquiry.created_at
          ? new Date(enquiry.created_at).toLocaleDateString('de-CH')
          : '—';
        const ageDays = requestAgeDays(enquiry);
        const isStale = enquiry.untreated && ageDays !== null && ageDays >= 14;
        const staleBadge = isStale
          ? `<span class="request-stale-badge">${esc(String(ageDays))}d open</span>`
          : '';
        const courseLink = enquiry.course_id
          ? `<button class="student-request-course" data-action="openRequestCourse" data-args="${esc(enquiry.course_id)}">${esc(requestCourseLabel(enquiry))}</button>`
          : `<span class="detail-muted">${esc(requestCourseLabel(enquiry))}</span>`;
        const actions =
          enquiry.untreated && enquiry.status === 'pending_course_booking' && enquiry.course_id
            ? `<div class="student-request-actions">
                   <button class="save-btn" data-action="handleStudentRequestBooking" data-args="${esc(enquiry.id)},approve,${esc(enquiry.course_id)},${esc(s.id)}">approve</button>
                   <button class="delete-btn" data-action="handleStudentRequestBooking" data-args="${esc(enquiry.id)},decline,${esc(enquiry.course_id)},${esc(s.id)}">decline</button>
                   <span class="saved-msg" id="student-request-msg-${esc(enquiry.id)}">saved</span>
                 </div>`
            : enquiry.untreated
              ? `<div class="student-request-actions">
                     ${
                       enquiry.status === 'pending_group_slot_booking'
                         ? `<a class="save-btn" href="/admin/pages/course-new.html?enquiry_id=${encodeURIComponent(enquiry.id)}">create course</a>`
                         : `<button class="save-btn" data-action="openEnrolStudentModal" data-args="${esc(s.id)}">enrol</button>`
                     }
                     <button class="save-btn secondary-btn" data-action="markStudentEnquiryTreated" data-args="${esc(enquiry.id)},${esc(s.id)}">mark treated</button>
                     <span class="saved-msg" id="student-request-msg-${esc(enquiry.id)}">saved</span>
                   </div>`
              : '';
        return `
            <div class="student-request-row${enquiry.untreated ? ' untreated' : ' treated'}${isStale ? ' stale' : ''}">
              <span class="request-dot ${esc(enquiry.status || '')}"></span>
              <div>
                <p class="student-request-title">${esc(requestLabel(enquiry))}${staleBadge}</p>
                <p class="student-request-meta">${esc(created)} · <span class="enq-status ${esc(enquiry.status || '')}">${esc(enquiry.status || '—')}</span></p>
              </div>
              <div class="student-request-target">${courseLink}${actions}</div>
            </div>`;
      })
      .join('');

  return `
    ${
      untreated.length
        ? `<p class="student-request-hint">Resolve open requests by enrolling, creating a course, approving/declining bookings, or marking stale enquiries treated.</p>`
        : ''
    }
    <div class="student-request-list">
      ${renderRows(untreated)}
      ${
        history.length
          ? `<p class="student-request-history-label">history</p>${renderRows(history)}`
          : ''
      }
    </div>`;
}

export function copyDetailValue(btn) {
  const value = btn?.dataset.copyValue || '';
  if (!value) return;
  const original = btn.textContent;
  const done = () => {
    btn.textContent = 'copied';
    setTimeout(() => {
      btn.textContent = original || 'copy';
    }, MESSAGE_TIMEOUT_MS);
  };

  if (navigator.clipboard?.writeText) {
    navigator.clipboard
      .writeText(value)
      .then(done)
      .catch(() => prompt('Copy this value:', value));
  } else {
    prompt('Copy this value:', value);
  }
}

export async function handleStudentRequestBooking(enquiryId, action, courseId, studentId, btn) {
  const verb = action === 'approve' ? 'approve' : 'decline';
  if (!confirm(`${verb[0].toUpperCase() + verb.slice(1)} this direct booking request?`)) return;

  const msg = document.getElementById('student-request-msg-' + enquiryId);
  const row = btn?.closest('.student-request-row');
  const buttons = row ? [...row.querySelectorAll('button')] : btn ? [btn] : [];
  buttons.forEach((button) => {
    button.disabled = true;
  });
  if (btn) btn.textContent = action === 'approve' ? 'approving…' : 'declining…';

  try {
    const res = await apiFetch('/api/handle-course-booking', {
      method: 'POST',
      body: { enquiry_id: enquiryId, action },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
    if (msg) {
      msg.textContent = action === 'approve' ? 'approved' : 'declined';
      msg.classList.add('is-visible-inline');
    }
    selectedStudentId = studentId;
    await loadStudentsKeepingContext(currentStudentFilter, studentId);
    await fetchAndRenderStudent(studentId);
  } catch (err) {
    if (msg) {
      msg.textContent = 'Error: ' + err.message;
      msg.classList.add('error-text', 'is-visible-inline');
    } else {
      alert('Could not update booking request: ' + err.message);
    }
    buttons.forEach((button) => {
      button.disabled = false;
    });
    if (btn) btn.textContent = action === 'approve' ? 'approve' : 'decline';
  }
}

export async function markStudentEnquiryTreated(enquiryId, studentId, btn) {
  if (!confirm('Mark this enquiry as treated without enrolling the student?')) return;

  const msg = document.getElementById('student-request-msg-' + enquiryId);
  const row = btn?.closest('.student-request-row');
  const buttons = row ? [...row.querySelectorAll('button')] : btn ? [btn] : [];
  buttons.forEach((button) => {
    button.disabled = true;
  });
  if (btn) btn.textContent = 'saving...';

  try {
    const res = await apiFetch('/api/mark-enquiry-treated', {
      method: 'POST',
      body: { enquiry_id: enquiryId, student_id: studentId },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
    if (msg) {
      msg.textContent = 'treated';
      msg.classList.add('is-visible-inline');
    }
    selectedStudentId = studentId;
    await loadStudentsKeepingContext(currentStudentFilter, studentId);
    await fetchAndRenderStudent(studentId);
  } catch (err) {
    if (msg) {
      msg.textContent = 'Error: ' + err.message;
      msg.classList.add('error-text', 'is-visible-inline');
    } else {
      alert('Could not mark enquiry treated: ' + err.message);
    }
    buttons.forEach((button) => {
      button.disabled = false;
    });
    if (btn) btn.textContent = 'mark treated';
  }
}

export async function sendIntakeLink(studentId, _btn) {
  const s = currentStudentDetail;
  if (!s || String(s.id) !== String(studentId)) {
    alert('Student data not loaded. Please try again.');
    return;
  }
  if (!s.email) {
    alert('This student has no email address on file.');
    return;
  }

  const fullName = [s.first_name, s.last_name].filter(Boolean).join(' ') || '—';
  const contentHtml = `
    <p class="cs-section-label">intake form</p>
    <ul class="cs-detail-list">
      <li>Personal details form link</li>
      <li>Link valid for 90 days</li>
    </ul>
  `;

  openConfirmSend({
    title: 'send intake link',
    recipients: [{ name: fullName, email: s.email }],
    subject: 'Dein Anmeldeformular / Your intake form · learning with gioia',
    contentHtml,
    languageOptions: [
      { value: 'de', label: 'Deutsch' },
      { value: 'en', label: 'English' },
    ],
    defaultLanguage: 'de',
    onConfirm: async ({ language }) => {
      const res = await apiFetch('/api/send-intake-link', {
        method: 'POST',
        body: { student_id: studentId, language },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      if (body.intake_link_sent_at) {
        currentStudentDetail = {
          ...currentStudentDetail,
          intake_link_sent_at: body.intake_link_sent_at,
        };
        const pane = document.getElementById('student-detail-panel');
        if (pane) renderStudentDetail(pane, currentStudentDetail);
      }
      const msgEl = document.getElementById('intake-msg-' + studentId);
      if (msgEl) {
        msgEl.textContent = 'sent';
        msgEl.classList.add('is-visible-inline');
        setTimeout(() => {
          msgEl.classList.remove('is-visible-inline');
        }, MESSAGE_TIMEOUT_MS);
      }
    },
  });
}

export async function markIntakeSeen(studentId, btn) {
  const msgEl = document.getElementById('intake-seen-msg-' + studentId);
  const show = (text) => {
    if (msgEl) {
      msgEl.textContent = text;
      msgEl.classList.add('is-visible-inline');
      setTimeout(() => {
        msgEl.classList.remove('is-visible-inline');
      }, MESSAGE_TIMEOUT_MS);
    }
  };

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'saving…';
  }
  try {
    const res = await apiFetch('/api/mark-intake-seen', {
      method: 'POST',
      body: { student_id: studentId },
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(result.error || 'Failed');
    await fetchAndRenderStudent(studentId);
  } catch (e) {
    show('error: ' + (e.message || 'could not update'));
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'mark as seen';
    }
  }
}

export function copyIntakeLink(token, btn) {
  const url = `${window.location.origin}/intake.html?token=${encodeURIComponent(token)}`;
  const msgEl = btn?.parentElement?.querySelector('.detail-action-msg');
  const done = (text) => {
    if (msgEl) {
      msgEl.textContent = text;
      msgEl.classList.add('is-visible-inline');
      setTimeout(() => {
        msgEl.classList.remove('is-visible-inline');
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
  const courses = (s.courses || []).filter((c) => c.status === 'active');
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
    return `${metaBlock}${notesBlock}<p class="detail-muted mt-large">No courses enrolled yet.</p>`;
  }

  const courseRows = courses
    .map((c) => {
      const currency = esc(c.currency || 'CHF');
      const priceCell =
        c.price_per_person_per_60min !== null && c.price_per_person_per_60min !== undefined
          ? `${Number(c.price_per_person_per_60min).toFixed(2)} ${currency} / person / 60min`
          : c.price_per_session !== null && c.price_per_session !== undefined
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
        <td>${esc(c.course_type) || '—'}</td>
        <td>${esc(c.location) || '—'}</td>
        <td>
          <button class="remove-enrolment-btn" data-action="removeStudentEnrolment"
            data-args="${s.id},${c.id}" data-course-code="${esc(c.course_code || 'this course')}">remove</button>
        </td>
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
            <th>price</th>
            <th>open charges</th>
            <th>level</th>
            <th>subject</th>
            <th>location</th>
            <th></th>
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

export function openRequestCourse(courseId) {
  backToCourse(courseId);
}

/* ── Student modal ───────────────────────────────────────────────── */

export function editStudent(studentId) {
  window.location.href = '/admin/pages/student-form.html?id=' + encodeURIComponent(studentId);
}

/* ── Enrol-in-course modal ───────────────────────────────────────── */

let enrolStudentId = null;

function todayInputValue() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

export async function openEnrolStudentModal(studentId) {
  enrolStudentId = studentId;
  const modal = document.getElementById('enrol-student-modal');
  const sel = document.getElementById('es-course');
  const msg = document.getElementById('es-msg');
  const btn = document.getElementById('es-submit');
  const createLink = document.getElementById('es-create-course');

  msg.classList.remove('is-visible-block');
  msg.textContent = '';
  btn.textContent = 'enrol';
  btn.disabled = true;
  document.getElementById('es-joined-at').value = todayInputValue();
  sel.innerHTML = '<option value="">loading courses…</option>';
  if (createLink) {
    createLink.href = `/admin/pages/course-new.html?student_id=${encodeURIComponent(studentId)}`;
  }

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
      msg.textContent =
        'Student is already enrolled in all active courses. Create a new course instead.';
      msg.className = 'modal-msg';
      msg.classList.add('is-visible-block');
      return;
    }

    sel.innerHTML =
      '<option value="">select a course…</option>' +
      available
        .map((c) => {
          const label = [c.course_code, c.course_type, c.level].filter(Boolean).join(' · ');
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
    msg.classList.add('is-visible-block');
  }
}

export function closeEnrolStudentModal() {
  document.getElementById('enrol-student-modal').classList.remove('open');
  enrolStudentId = null;
}

export async function submitEnrolStudent() {
  const btn = document.getElementById('es-submit');
  const msg = document.getElementById('es-msg');
  const courseId = document.getElementById('es-course').value;
  const joinedAt = document.getElementById('es-joined-at')?.value || null;
  if (!courseId || !enrolStudentId) return;

  btn.disabled = true;
  btn.textContent = 'enrolling…';
  msg.classList.remove('is-visible-block');

  try {
    const res = await apiFetch('/api/add-enrolment', {
      method: 'POST',
      body: { course_id: courseId, student_id: enrolStudentId, joined_at: joinedAt },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed');
    }
    btn.textContent = 'enrolled';
    const sid = enrolStudentId;
    setTimeout(async () => {
      closeEnrolStudentModal();
      selectedStudentId = sid;
      await loadStudentsKeepingContext(currentStudentFilter, sid);
      await fetchAndRenderStudent(sid);
    }, MESSAGE_TIMEOUT_MS);
  } catch (e) {
    msg.textContent = 'Error: ' + e.message;
    msg.className = 'modal-msg err';
    msg.classList.add('is-visible-block');
    btn.textContent = 'enrol';
    btn.disabled = false;
  }
}

export async function removeStudentEnrolment(studentId, courseId, btn) {
  const courseCode = btn?.dataset.courseCode || 'this course';
  if (
    !confirm(
      `Remove this student from ${courseCode}? Attendance records for this course will also be removed.`
    )
  ) {
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'removing...';
  }

  try {
    const res = await apiFetch('/api/remove-enrolment', {
      method: 'DELETE',
      body: { course_id: courseId, student_id: studentId },
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(result.error || 'Could not remove student from course.');

    selectedStudentId = studentId;
    await loadStudentsKeepingContext(currentStudentFilter, studentId);
    await fetchAndRenderStudent(studentId);
  } catch (e) {
    alert(e.message || 'Could not remove student from course.');
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'remove';
    }
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
