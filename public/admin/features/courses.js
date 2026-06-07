/* ── Courses tab ──────────────────────────────────────────────────── */
import { apiFetch } from '../core/api.js';
import {
  fmtDate,
  fmtDateWithEnd,
  esc,
  showMessage,
  queryString,
  attachListControls,
} from '../core/helpers.js';
import { loadTeachers } from './teachers.js';
import { MESSAGE_TIMEOUT_MS } from '../core/constants.js';
import { openConfirmSend } from './confirm-send.js';
import { openCertificateModal as openCertificates } from './certificates.js';
import {
  openBulkInvoiceModal as openBulkInvoices,
  openInvoiceModal as openInvoice,
} from './invoices.js?v=individual-lesson-counts-20260530';

let currentCourseFilter = 'active';
const courseListState = { search: '', sort: 'created_at', direction: 'desc' };
let participantCount = 1;
let attendanceStudents = [];
let studentCache = [];
let clickAwayHandler = null;
let addParticipantCourseId = null;
let apSearchListenersAttached = false;
let coursesCache = [];
let groupSlotsCache = [];
let courseControlsAttached = false;
let publicSlotsCollapsed = null;

const WEEKDAY_LABELS = {
  1: 'Mondays',
  2: 'Tuesdays',
  3: 'Wednesdays',
  4: 'Thursdays',
  5: 'Fridays',
  6: 'Saturdays',
  7: 'Sundays',
};

document.addEventListener('click', (e) => {
  if (!e.target.closest('.course-status-wrap')) {
    document.querySelectorAll('.status-dropdown').forEach((d) => {
      d.classList.add('is-hidden');
    });
  }
});

function setVisible(el, show, visibleClass = 'is-visible-block') {
  if (!el) return;
  el.classList.toggle('is-hidden', !show);
  el.classList.toggle(visibleClass, show);
}

function showErrorMessage(el, text) {
  if (!el) return;
  el.textContent = text;
  el.classList.add('error-text', 'is-visible-inline');
}

function showAutosaveMessage(el, text, { error = false, hold = false } = {}) {
  if (!el) return;
  el.textContent = text;
  el.classList.toggle('error-text', error);
  el.classList.add('is-visible-inline');
  if (!hold) {
    setTimeout(() => el.classList.remove('is-visible-inline'), MESSAGE_TIMEOUT_MS);
  }
}

export function getCurrentCourseFilter() {
  return currentCourseFilter;
}

export function openInvoiceModal(courseId, studentId) {
  openInvoice(courseId, studentId, coursesCache);
}

export function openBulkInvoiceModal(courseId) {
  openBulkInvoices(courseId, coursesCache);
}

/* ── Location address helpers ───────────────────────────────────── */
export function formatCourseAddress(course) {
  const company = (course.location_company || '').trim();
  const street = (course.location_street || '').trim();
  const num = (course.location_street_number || '').trim();
  const postal = (course.location_postal_code || '').trim();
  const city = (course.location_city || '').trim();
  if (!company && !street && !num && !postal && !city) return '';
  const line1 = [street, num].filter(Boolean).join(' ');
  const line2 = [postal, city].filter(Boolean).join(' ');
  return [company, line1, line2].filter(Boolean).join(', ');
}

function locationSummaryHtml(course) {
  const type = course.location || '';
  const address = formatCourseAddress(course);
  const btnLabel = address ? 'edit' : '+ add address';
  return `<span id="loc-line-${course.id}">${esc(type) || '—'}${
    address ? `<br><span class="detail-muted">${esc(address)}</span>` : ''
  }<button type="button" class="loc-address-btn" data-action="toggleCourseAddressEditor" data-args="${course.id}">${btnLabel}</button></span>`;
}

function locationEditorHtml(course) {
  return `
    <div class="loc-address-editor is-hidden" id="loc-editor-${course.id}">
      <div class="loc-address-grid">
        <input type="text" id="loc-company-${course.id}" placeholder="Company"
          maxlength="120" value="${esc(course.location_company || '')}">
        <input type="text" id="loc-street-${course.id}" placeholder="Street"
          maxlength="100" value="${esc(course.location_street || '')}">
        <input type="text" id="loc-number-${course.id}" placeholder="No."
          maxlength="20" value="${esc(course.location_street_number || '')}">
        <input type="text" id="loc-postal-${course.id}" placeholder="Postal code"
          maxlength="20" value="${esc(course.location_postal_code || '')}">
        <input type="text" id="loc-city-${course.id}" placeholder="City"
          maxlength="80" value="${esc(course.location_city || '')}">
      </div>
      <div class="loc-address-actions">
        <button type="button" class="save-btn"
          data-action="saveCourseAddress" data-args="${course.id}">save</button>
        <button type="button" class="loc-address-btn"
          data-action="toggleCourseAddressEditor" data-args="${course.id}">cancel</button>
        <span class="saved-msg" id="loc-msg-${course.id}">saved</span>
      </div>
    </div>`;
}

function formatMoney(amount, currency = 'CHF') {
  if (amount === null || amount === undefined) return '—';
  return `${Number(amount).toFixed(2)} ${esc(currency || 'CHF')}`;
}

function dateInputValue(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

function todayInputValue() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function studentStartsBySession(student, session) {
  if (!student?.joined_at || !session?.scheduled_at) return true;
  const joined = new Date(student.joined_at + 'T00:00:00');
  const scheduled = new Date(session.scheduled_at);
  if (Number.isNaN(joined.getTime()) || Number.isNaN(scheduled.getTime())) return true;
  return scheduled >= joined;
}

export function toggleCourseAddressEditor(courseId) {
  const editor = document.getElementById('loc-editor-' + courseId);
  const line = document.getElementById('loc-line-' + courseId);
  if (!editor || !line) return;
  const open = !editor.classList.contains('is-hidden');
  setVisible(editor, !open);
  line.classList.toggle('is-hidden', !open);
}

export async function saveCourseAddress(courseId) {
  const company = document.getElementById('loc-company-' + courseId).value.trim();
  const street = document.getElementById('loc-street-' + courseId).value.trim();
  const number = document.getElementById('loc-number-' + courseId).value.trim();
  const postal = document.getElementById('loc-postal-' + courseId).value.trim();
  const city = document.getElementById('loc-city-' + courseId).value.trim();
  const msg = document.getElementById('loc-msg-' + courseId);

  try {
    const res = await apiFetch('/api/update-course', {
      method: 'PATCH',
      body: {
        course_id: courseId,
        location_company: company || null,
        location_street: street || null,
        location_street_number: number || null,
        location_postal_code: postal || null,
        location_city: city || null,
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Save failed');
    }
    const updated = await res.json();
    const cached = coursesCache.find((c) => String(c.id) === String(courseId));
    if (cached) {
      cached.location_company = updated.location_company;
      cached.location_street = updated.location_street;
      cached.location_street_number = updated.location_street_number;
      cached.location_postal_code = updated.location_postal_code;
      cached.location_city = updated.location_city;
    }
    showMessage(msg, 'saved');
    renderCourses(coursesCache);
    document.getElementById('course-detail-' + courseId)?.classList.add('open');
  } catch (err) {
    if (msg) {
      showErrorMessage(msg, 'Error: ' + err.message);
    }
  }
}

export async function togglePublicBooking(courseId) {
  const input = document.getElementById('public-booking-' + courseId);
  const msg = document.getElementById('public-booking-msg-' + courseId);
  if (!input) return;
  input.disabled = true;
  try {
    const res = await apiFetch('/api/update-course', {
      method: 'PATCH',
      body: {
        course_id: courseId,
        public_booking_enabled: input.checked,
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Save failed');
    }
    const updated = await res.json();
    const cached = coursesCache.find((c) => String(c.id) === String(courseId));
    if (cached) cached.public_booking_enabled = !!updated.public_booking_enabled;
    showMessage(msg, 'saved');
  } catch (err) {
    input.checked = !input.checked;
    if (msg) {
      showErrorMessage(msg, 'Error: ' + err.message);
    }
  } finally {
    input.disabled = false;
  }
}

export async function toggleCompanyCodeBooking(courseId) {
  const input = document.getElementById('company-code-booking-' + courseId);
  const msg = document.getElementById('company-code-booking-msg-' + courseId);
  if (!input) return;
  const cached = coursesCache.find((c) => String(c.id) === String(courseId));
  if (input.checked && !cached?.company_id && !cached?.access_code) {
    input.checked = false;
    showErrorMessage(msg, 'Link a company or add a custom booking code on the edit page first.');
    return;
  }
  input.disabled = true;
  try {
    const res = await apiFetch('/api/update-course', {
      method: 'PATCH',
      body: {
        course_id: courseId,
        company_code_booking_enabled: input.checked,
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Save failed');
    }
    const updated = await res.json();
    if (cached) {
      cached.company_code_booking_enabled = !!updated.company_code_booking_enabled;
    }
    showMessage(msg, 'saved');
  } catch (err) {
    input.checked = !input.checked;
    if (msg) {
      showErrorMessage(msg, 'Error: ' + err.message);
    }
  } finally {
    input.disabled = false;
  }
}

export async function markInvoicePaid(invoiceId, courseId) {
  if (!confirm('Mark this invoice as paid?')) return;
  try {
    const res = await apiFetch('/api/mark-invoice-paid', {
      method: 'POST',
      body: { invoice_id: invoiceId },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Could not mark invoice paid');
    await loadCourses(currentCourseFilter);
    document.getElementById('course-detail-' + courseId)?.classList.add('open');
  } catch (err) {
    alert('Error: ' + (err.message || err));
  }
}

function sentCommunicationsBlock(course) {
  const students = course.students || [];
  const total = students.length;

  const confirmedAt = course.course_confirmation_sent_at;
  const confirmationSent = students.filter((s) => s.confirmation_sent_at);
  const scheduleSent = students.filter((s) => s.schedule_sent_at);
  const certSent = students.filter((s) => s.certificate_sent_at);
  const invoiceSent = students.filter((s) => s.invoice_sent_at);

  if (
    !confirmedAt &&
    !confirmationSent.length &&
    !scheduleSent.length &&
    !certSent.length &&
    !invoiceSent.length
  ) {
    return '';
  }

  const latest = (rows, key) =>
    rows
      .map((s) => s[key])
      .filter(Boolean)
      .sort()
      .pop();

  const items = [];
  if (confirmationSent.length) {
    const last = latest(confirmationSent, 'confirmation_sent_at');
    items.push(
      `<li>confirmation sent to ${confirmationSent.length} of ${total} · <span class="detail-muted">last ${esc(
        fmtDate(last)
      )}</span></li>`
    );
  } else if (confirmedAt) {
    items.push(
      `<li>confirmation sent · <span class="detail-muted">${esc(fmtDate(confirmedAt))}</span></li>`
    );
  }
  if (scheduleSent.length) {
    const last = latest(scheduleSent, 'schedule_sent_at');
    items.push(
      `<li>schedule sent to ${scheduleSent.length} of ${total} · <span class="detail-muted">last ${esc(
        fmtDate(last)
      )}</span></li>`
    );
  }
  if (certSent.length) {
    const last = latest(certSent, 'certificate_sent_at');
    items.push(
      `<li>certificate sent to ${certSent.length} of ${total} · <span class="detail-muted">last ${esc(
        fmtDate(last)
      )}</span></li>`
    );
  }
  if (invoiceSent.length) {
    const last = latest(invoiceSent, 'invoice_sent_at');
    items.push(
      `<li>invoice sent to ${invoiceSent.length} of ${total} · <span class="detail-muted">last ${esc(
        fmtDate(last)
      )}</span></li>`
    );
  }

  return `
    <div class="sent-status">
      <p class="detail-meta">communications</p>
      <ul class="sent-status-list">${items.join('')}</ul>
    </div>`;
}

function pendingBookingBlocks(course) {
  const bookings = course.pending_bookings || [];
  if (!bookings.length) return '';

  const rows = bookings
    .map((b) => {
      const contact = b.contact_data || {};
      const intake = contact.intake || {};
      const booking = b.booking_data || {};
      const name =
        [b.lead_first || intake.first_name, b.lead_last || intake.last_name]
          .filter(Boolean)
          .join(' ') || '—';
      const email = b.lead_email || intake.email || '';
      const phone = b.lead_phone || intake.phone || '';
      const requestedAt = b.created_at ? fmtDate(b.created_at) : '—';
      const nameHtml = b.student_id
        ? `<button class="student-link" data-action="selectStudentFromCourse"
            data-args="${esc(b.student_id)},${esc(course.id)},${esc(course.course_code || '')}">
            ${esc(name)}
          </button>`
        : esc(name);
      const spots =
        booking.spots_remaining_at_booking !== null &&
        booking.spots_remaining_at_booking !== undefined
          ? `${booking.spots_remaining_at_booking} spot${Number(booking.spots_remaining_at_booking) === 1 ? '' : 's'} left then`
          : '';
      return `
        <div class="pending-booking-row" id="pending-booking-${esc(b.id)}">
          <div>
            <p class="pending-booking-name">${nameHtml}</p>
            <p class="detail-muted">
              ${email ? esc(email) : 'no email'}${phone ? ' · ' + esc(phone) : ''}
            </p>
            <p class="detail-muted">requested ${esc(requestedAt)}${spots ? ' · ' + esc(spots) : ''}</p>
          </div>
          <div class="pending-booking-actions">
            <button class="save-btn" data-action="handleCourseBooking" data-args="${esc(b.id)},approve,${esc(course.id)}">approve</button>
            <button class="delete-btn" data-action="handleCourseBooking" data-args="${esc(b.id)},decline,${esc(course.id)}">decline</button>
            <span class="saved-msg" id="booking-msg-${esc(b.id)}">saved</span>
          </div>
        </div>`;
    })
    .join('');

  return `
    <div class="pending-bookings">
      <p class="detail-meta">pending direct bookings</p>
      ${rows}
    </div>`;
}

export function filterCourses(status) {
  currentCourseFilter = status;
  document.querySelectorAll('[data-course-status]').forEach((b) => {
    b.classList.toggle('active', b.dataset.courseStatus === status);
  });
  loadCourses(status);
}

function buildCourseQuery(status) {
  return queryString({
    status,
    ...(courseListState.search && { q: courseListState.search }),
    ...(courseListState.sort !== 'created_at' && { sort: courseListState.sort }),
    ...(courseListState.direction !== 'desc' && { dir: courseListState.direction }),
  });
}

function attachCourseListControls() {
  if (courseControlsAttached) return;
  const searchEl = document.getElementById('course-search');
  const sortEl = document.getElementById('course-sort');
  const dirEl = document.getElementById('course-sort-dir');
  if (!searchEl || !sortEl || !dirEl) return;

  courseControlsAttached = true;
  attachListControls({
    searchEl,
    sortEl,
    directionEl: dirEl,
    state: courseListState,
    defaults: { sort: 'created_at', descendingSort: 'created_at' },
    onSearch: () => loadCourses(currentCourseFilter),
    onChange: () => loadCourses(currentCourseFilter),
  });
}

export async function loadCourses(status = 'active') {
  attachCourseListControls();
  const list = document.getElementById('course-list');

  const openIds = new Set(
    Array.from(document.querySelectorAll('.course-detail.open')).map((el) =>
      el.id.replace('course-detail-', '')
    )
  );

  if (!list.querySelector('.course-row')) {
    list.innerHTML = '<div class="loading-state">loading…</div>';
  }
  loadGroupSlots();

  try {
    const res = await apiFetch('/api/get-courses' + buildCourseQuery(status));
    if (!res.ok) throw new Error('Failed to load courses');
    const courses = await res.json();
    coursesCache = courses;
    renderCourses(courses);

    openIds.forEach((id) => {
      const detail = document.getElementById('course-detail-' + id);
      if (detail) detail.classList.add('open');
    });
  } catch {
    list.innerHTML = '<div class="loading-state">Could not load courses.</div>';
  }
}

function slotTime(value) {
  return String(value || '').slice(0, 5);
}

function slotSchedule(slot) {
  const day = WEEKDAY_LABELS[slot.weekday] || 'Weekly';
  return `${day} ${slotTime(slot.start_time)}-${slotTime(slot.end_time)}`;
}

function reducedLessonCount(sessionsTotal, actualStudents, minimumStudents = 3) {
  const total = Number(sessionsTotal);
  const actual = Number(actualStudents);
  const minimum = Number(minimumStudents) || 3;
  if (!Number.isFinite(total) || total <= 0) return null;
  if (!Number.isFinite(actual) || actual <= 0 || actual >= minimum) return total;
  return Math.max(1, Math.floor((total * actual) / minimum));
}

function slotRequestSummary(bookings = []) {
  if (!bookings.length) return '';
  const counts = {};
  bookings.forEach((row) => {
    const booking = row.booking_data || {};
    const key = [
      booking.preferred_level || booking.level || 'level open',
      booking.preferred_location || booking.location || 'location open',
    ].join(' · ');
    counts[key] = (counts[key] || 0) + 1;
  });
  return Object.entries(counts)
    .map(([label, count]) => `${label}: ${count}`)
    .join(' · ');
}

function slotRequestCount(slots = []) {
  return slots.reduce(
    (total, slot) =>
      total + Number(slot.pending_booking_count || slot.pending_bookings?.length || 0),
    0
  );
}

function updatePublicSlotsPanel(slots = groupSlotsCache) {
  const panel = document.getElementById('public-slots-panel');
  const toggle = document.getElementById('public-slots-toggle');
  const title = document.getElementById('public-slots-title');
  if (!panel || !toggle) return;

  const requestCount = slotRequestCount(slots);
  if (title) {
    title.textContent = `group course booking slots · ${requestCount} request${requestCount === 1 ? '' : 's'}`;
  }

  if (publicSlotsCollapsed === null) {
    publicSlotsCollapsed = true;
  }

  panel.classList.toggle('is-collapsed', publicSlotsCollapsed);
  toggle.textContent = publicSlotsCollapsed ? 'show' : 'hide';
  toggle.setAttribute('aria-expanded', String(!publicSlotsCollapsed));
}

export function togglePublicSlotsPanel() {
  publicSlotsCollapsed = !publicSlotsCollapsed;
  updatePublicSlotsPanel();
}

function slotRequestRows(slot) {
  const bookings = slot.pending_bookings || [];
  if (!bookings.length) return '';
  return `
    <div class="group-slot-requests">
      ${bookings
        .map((row) => {
          const contact = row.contact_data || {};
          const intake = contact.intake || {};
          const booking = row.booking_data || {};
          const name =
            [row.lead_first || intake.first_name, row.lead_last || intake.last_name]
              .filter(Boolean)
              .join(' ') || '—';
          const email = row.lead_email || intake.email || '';
          const phone = row.lead_phone || intake.phone || '';
          const requestedAt = row.created_at ? fmtDate(row.created_at) : '—';
          const prefs = [
            booking.preferred_level || booking.level,
            booking.preferred_location || booking.location,
            booking.preferred_start_date,
            booking.reduced_lessons_ok === true
              ? 'reduced ok'
              : booking.reduced_lessons_ok === false
                ? 'full length only'
                : '',
          ]
            .filter(Boolean)
            .join(' · ');
          return `
            <div class="group-slot-request-row">
              <div>
                <p class="pending-booking-name">${esc(name)}</p>
                <p class="detail-muted">${esc(prefs || 'no preferences')}</p>
                <p class="detail-muted">${email ? esc(email) : 'no email'}${phone ? ' · ' + esc(phone) : ''} · requested ${esc(requestedAt)}</p>
              </div>
              <a class="save-btn secondary-btn" href="/admin/pages/course-new.html?enquiry_id=${encodeURIComponent(row.id)}">create course</a>
            </div>`;
        })
        .join('')}
    </div>`;
}

function renderGroupSlots(slots) {
  const list = document.getElementById('group-slot-list');
  if (!list) return;
  updatePublicSlotsPanel(slots);
  if (!slots.length) {
    list.innerHTML = '<div class="loading-state loading-state--compact">No public slots yet.</div>';
    return;
  }

  list.innerHTML = slots
    .map((slot) => {
      const isActive = slot.status === 'active';
      const toggleStatus = isActive ? 'paused' : 'active';
      const toggleLabel = isActive ? 'pause' : 'activate';
      const two = reducedLessonCount(slot.sessions_total, 2, slot.minimum_students);
      const one = reducedLessonCount(slot.sessions_total, 1, slot.minimum_students);
      const reduced =
        slot.allow_reduced_lessons && two && one
          ? ` · reduced: 2 people ${two}, 1 person ${one} lessons`
          : '';
      const requestSummary = slotRequestSummary(slot.pending_bookings || []);
      const accessText = slot.access_code
        ? `protected: ${slot.access_label ? slot.access_label + ' · ' : ''}${slot.access_code}`
        : 'public';
      return `
        <div class="group-slot-row" id="group-slot-${esc(slot.id)}">
          <div>
            <p class="group-slot-title">
              ${esc(slot.subject || slot.course_type || 'Group course')} ${slot.level ? '· ' + esc(slot.level) : ''}
            </p>
            <p class="detail-muted">
              ${esc(slotSchedule(slot))} · ${esc(formatCourseAddress(slot) || slot.location || '—')}
            </p>
            <p class="detail-muted">
              ${esc(String(slot.pending_booking_count || 0))}/${esc(String(slot.minimum_students || 3))} interested ·
              ${esc(String(slot.sessions_total || '—'))} lessons ·
              ${formatMoney(slot.price_per_person_per_60min, slot.currency)} / person / 60min${esc(reduced)}
            </p>
            <p class="detail-muted">visibility: ${esc(accessText)}</p>
            ${requestSummary ? `<p class="detail-muted">requests: ${esc(requestSummary)}</p>` : ''}
            ${slotRequestRows(slot)}
          </div>
          <div class="group-slot-actions">
            <span class="enq-status ${esc(slot.status || '')}">${esc(slot.status || '—')}</span>
            <button class="save-btn secondary-btn" data-action="setGroupSlotStatus" data-args="${esc(slot.id)},${esc(toggleStatus)}">${toggleLabel}</button>
            <button class="save-btn secondary-btn" data-action="openEditGroupSlotModal" data-args="${esc(slot.id)}">edit</button>
            <button class="delete-btn" data-action="deleteGroupSlot" data-args="${esc(slot.id)}">delete</button>
            <span class="saved-msg" id="group-slot-msg-${esc(slot.id)}">saved</span>
          </div>
        </div>`;
    })
    .join('');
}

export async function loadGroupSlots() {
  const list = document.getElementById('group-slot-list');
  if (!list) return;
  if (!groupSlotsCache.length) {
    list.innerHTML = '<div class="loading-state loading-state--compact">loading slots…</div>';
  }
  try {
    const res = await apiFetch('/api/group-course-slots?status=all');
    if (!res.ok) throw new Error('Failed to load slots');
    groupSlotsCache = await res.json();
    renderGroupSlots(groupSlotsCache);
  } catch {
    list.innerHTML =
      '<div class="loading-state loading-state--compact">Could not load slots.</div>';
  }
}

export function openGroupSlotModal() {
  const modal = document.getElementById('group-slot-modal');
  const msg = document.getElementById('slot-msg');
  if (msg) {
    msg.textContent = '';
    msg.className = 'modal-msg';
  }
  const idInput = document.getElementById('slot-id');
  if (idInput) idInput.value = '';
  const title = modal?.querySelector('h2');
  if (title) title.textContent = 'new group booking slot';
  const submit = document.getElementById('slot-submit');
  if (submit) submit.textContent = 'create slot';
  modal?.classList.add('open');
}

export function openEditGroupSlotModal(slotId) {
  const slot = groupSlotsCache.find((s) => String(s.id) === String(slotId));
  if (!slot) {
    alert('Could not find slot.');
    return;
  }

  const modal = document.getElementById('group-slot-modal');
  const msg = document.getElementById('slot-msg');
  if (msg) {
    msg.textContent = '';
    msg.className = 'modal-msg';
  }

  document.getElementById('slot-id').value = slot.id;
  document.getElementById('slot-course-type').value = slot.course_type || 'language course';
  document.getElementById('slot-subject').value = slot.subject || 'German';
  document.getElementById('slot-level').value = slot.level || '';
  document.getElementById('slot-weekday').value = String(slot.weekday || 1);
  document.getElementById('slot-start-time').value = slotTime(slot.start_time);
  document.getElementById('slot-end-time').value = slotTime(slot.end_time);
  document.getElementById('slot-sessions-total').value = slot.sessions_total ?? '';
  document.getElementById('slot-session-length').value = slot.session_length_minutes ?? '';
  document.getElementById('slot-price-person').value = slot.price_per_person_per_60min ?? '';
  document.getElementById('slot-capacity').value = slot.capacity ?? '';
  document.getElementById('slot-minimum-students').value = slot.minimum_students ?? '';
  document.getElementById('slot-location').value = slot.location || '';
  document.getElementById('slot-loc-company').value = slot.location_company || '';
  document.getElementById('slot-loc-street').value = slot.location_street || '';
  document.getElementById('slot-loc-number').value = slot.location_street_number || '';
  document.getElementById('slot-loc-postal').value = slot.location_postal_code || '';
  document.getElementById('slot-loc-city').value = slot.location_city || '';
  document.getElementById('slot-allow-reduced').checked = !!slot.allow_reduced_lessons;
  document.getElementById('slot-access-code').value = slot.access_code || '';
  document.getElementById('slot-access-label').value = slot.access_label || '';
  document.getElementById('slot-notes').value = slot.notes || '';

  const title = modal?.querySelector('h2');
  if (title) title.textContent = 'edit group booking slot';
  const submit = document.getElementById('slot-submit');
  if (submit) submit.textContent = 'save changes';

  modal?.classList.add('open');
}

export function closeGroupSlotModal() {
  document.getElementById('group-slot-modal')?.classList.remove('open');
}

function slotVal(id) {
  return document.getElementById(id)?.value?.trim() || '';
}

function groupSlotPayload() {
  return {
    course_type: slotVal('slot-course-type') || null,
    subject: slotVal('slot-subject') || null,
    level: slotVal('slot-level') || null,
    weekday: parseInt(slotVal('slot-weekday'), 10),
    start_time: slotVal('slot-start-time'),
    end_time: slotVal('slot-end-time'),
    sessions_total: parseInt(slotVal('slot-sessions-total'), 10),
    session_length_minutes: parseInt(slotVal('slot-session-length'), 10),
    price_per_person_per_60min: slotVal('slot-price-person')
      ? parseFloat(slotVal('slot-price-person'))
      : null,
    capacity: parseInt(slotVal('slot-capacity'), 10),
    minimum_students: parseInt(slotVal('slot-minimum-students'), 10),
    location: slotVal('slot-location') || null,
    location_company: slotVal('slot-loc-company') || null,
    location_street: slotVal('slot-loc-street') || null,
    location_street_number: slotVal('slot-loc-number') || null,
    location_postal_code: slotVal('slot-loc-postal') || null,
    location_city: slotVal('slot-loc-city') || null,
    allow_reduced_lessons: document.getElementById('slot-allow-reduced')?.checked === true,
    access_code: slotVal('slot-access-code') || null,
    access_label: slotVal('slot-access-label') || null,
    notes: slotVal('slot-notes') || null,
  };
}

export async function submitGroupSlot(btn) {
  const submit = btn || document.getElementById('slot-submit');
  const msg = document.getElementById('slot-msg');
  if (msg) {
    msg.textContent = '';
    msg.className = 'modal-msg';
  }

  const slotId = document.getElementById('slot-id')?.value?.trim();
  const isEdit = !!slotId;

  submit.disabled = true;
  submit.dataset.loading = '';
  submit.textContent = isEdit ? 'saving…' : 'creating…';

  try {
    const payload = isEdit ? { id: slotId, ...groupSlotPayload() } : groupSlotPayload();
    const res = await apiFetch('/api/group-course-slots', {
      method: isEdit ? 'PATCH' : 'POST',
      body: payload,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok)
      throw new Error(body.error || (isEdit ? 'Could not update slot' : 'Could not create slot'));
    if (msg) {
      msg.textContent = isEdit ? 'saved' : 'created';
      msg.className = 'modal-msg success';
      msg.classList.add('is-visible-block');
    }
    closeGroupSlotModal();
    await loadGroupSlots();
  } catch (err) {
    if (msg) {
      msg.textContent = err.message || (isEdit ? 'Could not update slot' : 'Could not create slot');
      msg.className = 'modal-msg err';
      msg.classList.add('is-visible-block');
    }
  } finally {
    delete submit.dataset.loading;
    submit.disabled = false;
    submit.textContent = isEdit ? 'save changes' : 'create slot';
  }
}

export async function deleteGroupSlot(slotId) {
  if (!confirm('Delete this slot? This cannot be undone.')) return;
  const msg = document.getElementById('group-slot-msg-' + slotId);
  try {
    const res = await apiFetch('/api/group-course-slots', {
      method: 'DELETE',
      body: { id: slotId },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Could not delete slot');
    await loadGroupSlots();
  } catch (err) {
    if (msg) showErrorMessage(msg, 'Error: ' + err.message);
  }
}

export async function setGroupSlotStatus(slotId, status) {
  const msg = document.getElementById('group-slot-msg-' + slotId);
  try {
    const res = await apiFetch('/api/group-course-slots', {
      method: 'PATCH',
      body: { id: slotId, status },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Could not update slot');
    showMessage(msg, 'saved');
    await loadGroupSlots();
  } catch (err) {
    if (msg) showErrorMessage(msg, 'Error: ' + err.message);
  }
}

function renderCourses(courses) {
  const list = document.getElementById('course-list');
  if (!courses.length) {
    list.innerHTML = '<div class="loading-state loading-state--spacious">No courses found.</div>';
    return;
  }

  list.innerHTML = courses
    .map((c) => {
      const enrolledNames = (c.students || [])
        .map((s) => [s.first_name, s.last_name].filter(Boolean).join(' ') || s.email)
        .filter(Boolean);
      const names =
        (enrolledNames.length ? enrolledNames : c.participant_names || [])
          .map((n) => esc(n))
          .join(', ') || '—';
      const done = c.sessions_completed || 0;
      const total = c.sessions_total;
      const remaining = total ? total - done : null;
      const sessLine = total ? `${done} / ${total} sessions` : `${done} sessions completed`;

      const rebookFlag =
        total && remaining !== null && remaining > 0 && remaining <= 3
          ? `<span class="rebook-flag">${remaining + ' session' + (remaining === 1 ? '' : 's') + ' left'}</span>`
          : '';

      const dropItems =
        ['active', 'paused', 'completed', 'cancelled']
          .filter((s) => s !== c.status)
          .map(
            (s) =>
              `<li><button class="status-opt-btn status-opt-btn--${s}" data-action="setCourseStatus" data-args="${c.id},${esc(c.course_code)},${s}">${s}</button></li>`
          )
          .join('') +
        `<li class="status-dropdown-divider"></li><li><button class="status-opt-btn status-opt-btn--delete" data-action="setCourseStatus" data-args="${c.id},${esc(c.course_code)},delete">delete</button></li>`;

      const sessions = (c.sessions || [])
        .filter((s) => s.status !== 'cancelled')
        .slice()
        .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))
        .map(
          (s, idx) => `
      <div class="session-row" id="sess-${s.id}">
        <div class="session-number">${idx + 1}.</div>
        <div class="session-status-dot ${s.status}"></div>
        <div class="session-date">${fmtDateWithEnd(s.scheduled_at, s.duration_minutes)}</div>
        <div class="session-status-label">${s.status}</div>
        <button class="action-btn" data-action="openAttendanceModal" data-args="${s.id},${c.id},${fmtDate(s.scheduled_at)}">attendance</button>
        ${
          s.status === 'scheduled'
            ? `
          <button class="cancel-btn" data-action="cancelSession" data-args="${s.id},${c.id}">cancel</button>
        `
            : ''
        }
      </div>
    `
        )
        .join('');

      const studentBlocks =
        (c.students || [])
          .map((s) => {
            const openInvoices = (s.open_invoices || [])
              .map((inv) => {
                const amount =
                  inv.total_amount !== null && inv.total_amount !== undefined
                    ? `${Number(inv.total_amount).toFixed(2)} ${esc(inv.currency || 'CHF')}`
                    : '—';
                const num = esc(inv.invoice_number || '—');
                const status = esc(inv.status || 'open');
                return `<li class="course-invoice-row"><span><span class="course-invoice-number">${num}</span> <span class="detail-muted">${amount} · ${status}</span></span><button class="inline-link-btn" data-action="markInvoicePaid" data-args="${inv.id},${c.id}">mark paid</button></li>`;
              })
              .join('');
            const invoiceBlock = openInvoices
              ? `<div class="course-invoice-list"><p class="detail-muted course-invoice-list-label">open invoices</p><ul>${openInvoices}</ul></div>`
              : '';
            const paidInvoiceTags = (s.paid_invoices || [])
              .slice()
              .sort((a, b) =>
                String(b.issued_date || '').localeCompare(String(a.issued_date || ''))
              )
              .map((inv) => {
                const label = inv.invoice_number
                  ? `invoice paid · ${esc(inv.invoice_number)}`
                  : inv.issued_date
                    ? `invoice paid · ${esc(fmtDate(inv.issued_date))}`
                    : 'invoice paid';
                return `<span class="sent-tag paid-tag">${label}</span>`;
              })
              .join('');
            const sentTags = [
              s.schedule_sent_at
                ? `<span class="sent-tag">schedule sent · ${esc(fmtDate(s.schedule_sent_at))}</span>`
                : '',
              s.certificate_sent_at
                ? `<span class="sent-tag">certificate sent · ${esc(fmtDate(s.certificate_sent_at))}</span>`
                : '',
              paidInvoiceTags,
            ]
              .filter(Boolean)
              .join('');
            const joinedInputId = `joined-${c.id}-${s.id}`;
            const removeAction =
              c.status === 'completed'
                ? '<span class="detail-muted remove-enrolment-note">retained for completed course</span>'
                : `<button class="remove-enrolment-btn" data-action="removeStudentFromCourse"
            data-args="${c.id},${s.id}" data-student-name="${esc([s.first_name, s.last_name].filter(Boolean).join(' ') || s.email || 'this student')}">remove from course</button>`;
            return `
      <div class="progress-block">
        <div class="progress-main">
          <p class="progress-name">
            <button class="student-link" data-action="selectStudentFromCourse"
              data-args="${s.id},${c.id},${esc(c.course_code || '')}">
              ${esc([s.first_name, s.last_name].filter(Boolean).join(' ')) || '—'}
            </button>
            ${s.current_level ? '<span class="detail-muted"> · ' + esc(s.current_level) + '</span>' : ''}
          </p>
          <div class="progress-row participant-controls">
            <label class="participant-inline-field">
              <span>level</span>
              <input id="level-${s.id}" type="text" value="${esc(s.current_level || '')}"
                class="level-input" placeholder="level" data-autosave-level
                data-course-id="${c.id}" data-student-id="${s.id}"
                data-last-value="${esc(s.current_level || '')}" />
            </label>
            <label class="participant-inline-field participant-inline-field--date" for="${joinedInputId}">
              <span>joined</span>
              <input id="${joinedInputId}" type="date" value="${esc(dateInputValue(s.joined_at))}"
                data-autosave-joined data-course-id="${c.id}" data-student-id="${s.id}"
                data-last-value="${esc(dateInputValue(s.joined_at))}">
            </label>
            ${removeAction}
            <span class="saved-msg autosave-msg" id="student-saved-${c.id}-${s.id}">saved</span>
            <span class="saved-msg autosave-msg" id="enrolment-saved-${c.id}-${s.id}">saved</span>
          </div>
        </div>
        <div class="progress-communication">
          ${sentTags ? `<div class="sent-tag-row">${sentTags}</div>` : '<p class="detail-muted">no course emails sent yet</p>'}
        </div>
        <div class="progress-invoices">
          ${invoiceBlock || '<p class="detail-muted">no open invoices</p>'}
        </div>
      </div>
    `;
          })
          .join('') || '<p class="detail-muted">No student records yet.</p>';

      const noSessions = !c.sessions?.length
        ? `<div class="sync-row">
           <p class="detail-muted">No sessions synced yet.</p>
           <button class="save-btn" data-action="syncCalendar" data-args="${c.id}">sync calendar</button>
           <span class="saved-msg" id="sync-msg-${c.id}">synced</span>
         </div>`
        : `<div class="sync-row sync-row--right">
           <button class="save-btn sync-btn" data-action="syncCalendar" data-args="${c.id}">sync</button>
           <span class="saved-msg" id="sync-msg-${c.id}">synced</span>
         </div>`;

      return `
      <div class="course-row" id="course-${c.id}">
        <div class="course-summary" data-action="toggleCourse" data-args="${c.id}">
          <span class="course-code">${esc(c.course_code) || '—'}</span>
          <span class="course-participants">${names}</span>
          <div class="course-summary-actions">
            <span class="course-sessions">${sessLine}${rebookFlag}</span>
            <div class="course-status-wrap"><button class="course-status ${esc(c.status)}" data-action="toggleStatusDropdown" data-args="${c.id}">${esc(c.status)}</button><ul class="status-dropdown is-hidden" id="status-drop-${c.id}">${dropItems}</ul></div>
            <a class="edit-course-btn" href="/admin/pages/course-edit.html?id=${c.id}">edit</a>
          </div>
        </div>
        <div class="course-detail" id="course-detail-${c.id}">
          <div class="detail-grid detail-grid--gap-lg">
            <div>
              <p class="detail-meta">details</p>
              <p class="detail-body">
                Course type: ${esc(c.course_type) || '—'}<br>
                Subject: ${esc(c.subject) || '—'}<br>
                Level: ${esc(c.level) || '—'}<br>
                Group size: ${esc(c.group_type) || '—'}<br>
                Sessions: ${total ? total + ' sessions' : 'open-ended'}<br>
                Session length: ${c.session_length_minutes ? esc(String(c.session_length_minutes)) + ' min' : '—'}<br>
                Price/session: ${formatMoney(c.price_per_session, c.currency)}<br>
                Price/person/60min: ${formatMoney(c.price_per_person_per_60min, c.currency)}<br>
                Public booking:
                <label class="course-inline-check">
                  <input type="checkbox" id="public-booking-${c.id}"
                    ${c.public_booking_enabled ? 'checked' : ''}
                    data-action-change="togglePublicBooking" data-args="${c.id}">
                  <span>show on public booking page</span>
                </label>
                <span class="saved-msg" id="public-booking-msg-${c.id}">saved</span><br>
                Company code booking:
                <label class="course-inline-check">
                  <input type="checkbox" id="company-code-booking-${c.id}"
                    ${c.company_code_booking_enabled ? 'checked' : ''}
                    data-action-change="toggleCompanyCodeBooking" data-args="${c.id}">
                  <span>show after company booking code</span>
                </label>
                <span class="saved-msg" id="company-code-booking-msg-${c.id}">saved</span><br>
                ${
                  c.company_name
                    ? `Company: ${esc(c.company_name)}${c.access_code ? ' · ' + esc(c.access_code) : ''}`
                    : c.access_code
                      ? `Custom booking code: ${esc(c.access_code)}${c.access_label ? ' · ' + esc(c.access_label) : ''}`
                      : 'Booking: —'
                }<br>
                Location: ${locationSummaryHtml(c)}
              </p>
              ${locationEditorHtml(c)}
            </div>
            <div>
              <p class="detail-meta">actions</p>
              <div class="detail-action-stack">
                <button class="save-btn"
                  data-action="openAddParticipantModal" data-args="${c.id}">+ add participant</button>
                <div class="detail-action-row">
                  <button class="save-btn"
                    data-action="sendCourseConfirmation" data-args="${c.id}">send confirmation</button>
                  <span class="saved-msg" id="confirm-msg-${c.id}">sent</span>
                </div>
                <div class="detail-action-row">
                  <button class="save-btn"
                    data-action="openScheduleModal" data-args="${c.id}">send schedule</button>
                  <span class="saved-msg" id="schedule-msg-${c.id}">sent</span>
                </div>
                <div class="detail-action-row">
                  <button class="save-btn"
                    data-action="openCertificateModal" data-args="${c.id}">send certificates</button>
                  <span class="saved-msg" id="cert-row-msg-${c.id}">sent</span>
                </div>
                <div class="detail-action-row">
                  <button class="save-btn"
                    data-action="openBulkInvoiceModal" data-args="${c.id}">send invoices</button>
                  <span class="saved-msg" id="bulk-invoice-msg-${c.id}">sent</span>
                </div>
              </div>
              ${sentCommunicationsBlock(c)}
            </div>
          </div>
          <p class="detail-meta mb-medium">students & progress</p>
          ${pendingBookingBlocks(c)}
          ${studentBlocks}
          <p class="sessions-heading">sessions</p>
          ${noSessions}
          ${sessions}
        </div>
      </div>`;
    })
    .join('');
}

export function toggleCourse(id) {
  const isNowOpen = document.getElementById('course-detail-' + id).classList.toggle('open');
  if (isNowOpen) history.pushState({}, '', '#courses/' + id);
  else history.replaceState({}, '', '#courses');
}

export async function syncCalendar(courseId) {
  const msg = document.getElementById('sync-msg-' + courseId);
  try {
    const res = await apiFetch('/api/sync-calendar', {
      method: 'POST',
      body: { course_id: courseId },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const reason = body.error || `HTTP ${res.status}`;
      console.error('Sync failed:', reason, body);
      alert('Calendar sync failed: ' + reason);
      return;
    }
    if (msg) {
      const parts = [];
      if (typeof body.events_found === 'number') parts.push(`${body.events_found} events`);
      if (typeof body.completed === 'number') parts.push(`${body.completed} completed`);
      showMessage(msg, parts.length ? 'synced · ' + parts.join(', ') : 'synced');
    }
    loadCourses(currentCourseFilter);
  } catch (err) {
    console.error('Sync error:', err);
    alert('Calendar sync failed: ' + (err.message || err));
  }
}

export async function cancelSession(sessionId, courseId) {
  if (!confirm('Cancel this session? The Google Calendar event and invite will be removed.'))
    return;
  try {
    const res = await apiFetch('/api/cancel-session', {
      method: 'DELETE',
      body: { session_id: sessionId },
    });
    if (!res.ok) throw new Error();
    const row = document.getElementById('sess-' + sessionId);
    if (row) row.remove();
    const courseRow = document.getElementById('course-' + courseId);
    if (courseRow) {
      const countEl = courseRow.querySelector('.course-sessions');
      if (countEl) {
        const match = countEl.textContent.match(/(\d+) \/ (\d+)/);
        if (match) {
          const total = parseInt(match[2]);
          const newDone = parseInt(match[1]);
          countEl.firstChild.textContent = newDone + ' / ' + (total - 1) + ' sessions';
        }
      }
    }
  } catch {
    alert('Could not cancel session. Please try again.');
  }
}

export async function saveStudent(studentId, sourceEl) {
  const levelInput = sourceEl?.matches?.('[data-autosave-level]')
    ? sourceEl
    : document.getElementById('level-' + studentId);
  const level = levelInput?.value || '';
  const courseId = levelInput?.dataset.courseId;
  const msg =
    (courseId && document.getElementById(`student-saved-${courseId}-${studentId}`)) ||
    document.getElementById('student-saved-' + studentId);
  if (msg) showAutosaveMessage(msg, 'saving...', { hold: true });
  try {
    const res = await apiFetch('/api/update-student', {
      method: 'PATCH',
      body: { student_id: studentId, current_level: level },
    });
    if (!res.ok) throw new Error('Could not save student.');
    if (msg) showMessage(msg, 'saved');
    return true;
  } catch (err) {
    console.error('Save student error:', err);
    if (msg) showAutosaveMessage(msg, 'Error: ' + err.message, { error: true });
    return false;
  }
}

export async function saveEnrolmentSettings(courseId, studentId, btn) {
  const joinedEl = document.getElementById(`joined-${courseId}-${studentId}`);
  const msg = document.getElementById(`enrolment-saved-${courseId}-${studentId}`);
  const joinedAt = joinedEl?.value || null;

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'saving...';
  } else if (msg) {
    showAutosaveMessage(msg, 'saving...', { hold: true });
  }

  try {
    const res = await apiFetch('/api/update-enrolment', {
      method: 'PATCH',
      body: {
        course_id: courseId,
        student_id: studentId,
        joined_at: joinedAt,
      },
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(result.error || 'Could not save enrolment.');
    await loadCourses(currentCourseFilter);
    document.getElementById('course-detail-' + courseId)?.classList.add('open');
    const updatedMsg = document.getElementById(`enrolment-saved-${courseId}-${studentId}`);
    if (updatedMsg) showMessage(updatedMsg, 'saved');
    return true;
  } catch (err) {
    if (msg) showErrorMessage(msg, 'Error: ' + err.message);
    return false;
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'save';
    }
  }
}

async function autosaveParticipantField(input) {
  if (!input || input.dataset.saving === 'true') return;
  const value = input.value || '';
  if (value === (input.dataset.lastValue || '')) return;

  input.dataset.saving = 'true';
  input.disabled = true;
  try {
    let saved = false;
    if (input.matches('[data-autosave-level]')) {
      saved = await saveStudent(input.dataset.studentId, input);
    } else if (input.matches('[data-autosave-joined]')) {
      saved = await saveEnrolmentSettings(input.dataset.courseId, input.dataset.studentId);
    }
    if (saved) input.dataset.lastValue = value;
  } finally {
    input.disabled = false;
    delete input.dataset.saving;
  }
}

document.addEventListener(
  'blur',
  (e) => {
    const input = e.target.closest('[data-autosave-level], [data-autosave-joined]');
    if (input) autosaveParticipantField(input);
  },
  true
);

document.addEventListener('change', (e) => {
  const input = e.target.closest('[data-autosave-joined]');
  if (input) autosaveParticipantField(input);
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const input = e.target.closest('[data-autosave-level], [data-autosave-joined]');
  if (!input) return;
  e.preventDefault();
  autosaveParticipantField(input);
});

export async function logSession(sessionId, courseId) {
  try {
    const res = await apiFetch('/api/log-session', {
      method: 'PATCH',
      body: { session_id: sessionId },
    });
    if (!res.ok) throw new Error();
    const result = await res.json();
    markSessionCompletedInList(sessionId, courseId, result.newly_completed);
  } catch {
    alert('Could not log session. Please try again.');
  }
}

function markSessionCompletedInList(sessionId, courseId, shouldIncrementCount) {
  const row = document.getElementById('sess-' + sessionId);
  if (row) {
    const dot = row.querySelector('.session-status-dot');
    if (dot) dot.className = 'session-status-dot completed';
    const label = row.querySelector('.session-status-label');
    if (label) label.textContent = 'completed';
    const btn = row.querySelector('.log-btn');
    if (btn) btn.remove();
    const cancelBtn = row.querySelector('.cancel-btn');
    if (cancelBtn) cancelBtn.remove();
  }

  if (!shouldIncrementCount) return;

  const courseRow = document.getElementById('course-' + courseId);
  if (!courseRow) return;

  const countEl = courseRow.querySelector('.course-sessions');
  if (!countEl) return;

  const slashMatch = countEl.textContent.match(/(\d+) \/ (\d+)/);
  if (slashMatch) {
    const newDone = parseInt(slashMatch[1], 10) + 1;
    const total = parseInt(slashMatch[2], 10);
    countEl.firstChild.textContent = newDone + ' / ' + total + ' sessions';
    return;
  }

  const openEndedMatch = countEl.textContent.match(/(\d+) sessions completed/);
  if (openEndedMatch) {
    const newDone = parseInt(openEndedMatch[1], 10) + 1;
    countEl.firstChild.textContent = newDone + ' sessions completed';
  }
}

/* ── Participant block helpers ──────────────────────────────────── */
function renderParticipantBlock(i, { showRemove = false } = {}) {
  const extraClass = i > 0 ? ' participant-block--additional' : '';
  return `
    <div class="participant-block modal-grid${extraClass}" id="nc-p-${i}" data-selected-student-id="">
      ${
        showRemove
          ? `<div class="participant-block-header">
               <span class="detail-meta detail-meta--flush">Participant ${i + 1}</span>
               <button class="remove-participant-btn" data-action="removeParticipantBlock">remove</button>
             </div>`
          : ''
      }
      <div class="modal-field full">
        <label>Search existing student <span class="label-hint">(optional)</span></label>
        <div class="modal-field--relative">
          <input type="text" id="nc-p${i}-search" class="participant-search"
            placeholder="Type name or email…" autocomplete="off"
            role="combobox" aria-expanded="false" aria-haspopup="listbox"
            aria-controls="nc-p${i}-dropdown">
          <ul id="nc-p${i}-dropdown" class="search-dropdown is-hidden" role="listbox"></ul>
        </div>
      </div>
      <div class="modal-field"><label>First name</label><input type="text" id="nc-p${i}-first" placeholder="First name"></div>
      <div class="modal-field"><label>Last name</label><input type="text" id="nc-p${i}-last" placeholder="Last name"></div>
      <div class="modal-field"><label>Email</label><input type="email" id="nc-p${i}-email" placeholder="email@example.com"></div>
      <div class="modal-field"><label>Phone</label><input type="tel" id="nc-p${i}-phone" placeholder="+41…"></div>
    </div>`;
}

function hideDropdown(i) {
  const dropdown = document.getElementById(`nc-p${i}-dropdown`);
  const search = document.getElementById(`nc-p${i}-search`);
  if (dropdown) dropdown.classList.add('is-hidden');
  if (search) search.setAttribute('aria-expanded', 'false');
}

/* ── Shared student search autocomplete ────────────────────────── */
function buildStudentSearch(inputEl, dropdownEl, onSelect) {
  function hide() {
    dropdownEl.classList.add('is-hidden');
    inputEl.setAttribute('aria-expanded', 'false');
  }

  inputEl.addEventListener('input', () => {
    const q = inputEl.value.trim().toLowerCase();
    if (!q) {
      hide();
      return;
    }
    const matches = studentCache
      .filter((s) => {
        const name = `${s.first_name || ''} ${s.last_name || ''}`.trim().toLowerCase();
        return name.includes(q) || (s.email || '').toLowerCase().includes(q);
      })
      .slice(0, 8);

    if (!matches.length) {
      hide();
      return;
    }

    dropdownEl.innerHTML = matches
      .map((s) => {
        const fullName = esc([s.first_name, s.last_name].filter(Boolean).join(' '));
        const email = esc(s.email || '');
        return `<li role="option" class="search-result"
          data-first="${esc(s.first_name || '')}" data-last="${esc(s.last_name || '')}"
          data-email="${esc(s.email || '')}" data-phone="${esc(s.phone || '')}"
          data-student-id="${esc(s.id || '')}">
          ${fullName} <span class="detail-muted">${email}</span>
        </li>`;
      })
      .join('');

    dropdownEl.classList.remove('is-hidden');
    inputEl.setAttribute('aria-expanded', 'true');
  });

  inputEl.addEventListener('blur', () => {
    setTimeout(() => hide(), 150);
  });

  inputEl.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const first = dropdownEl.querySelector('li');
    if (first && !dropdownEl.classList.contains('is-hidden')) {
      e.preventDefault();
      first.click();
    }
  });

  dropdownEl.addEventListener('click', (e) => {
    const li = e.target.closest('li');
    if (!li) return;
    onSelect(li.dataset);
    inputEl.value = [li.dataset.first, li.dataset.last].filter(Boolean).join(' ');
    hide();
  });
}

function attachSearchListeners(i) {
  const inputEl = document.getElementById(`nc-p${i}-search`);
  const dropdownEl = document.getElementById(`nc-p${i}-dropdown`);
  if (!inputEl || !dropdownEl) return;
  buildStudentSearch(inputEl, dropdownEl, (data) => {
    document.getElementById(`nc-p${i}-first`).value = data.first;
    document.getElementById(`nc-p${i}-last`).value = data.last;
    document.getElementById(`nc-p${i}-email`).value = data.email;
    document.getElementById(`nc-p${i}-phone`).value = data.phone;
    const block = document.getElementById(`nc-p-${i}`);
    if (block) block.dataset.selectedStudentId = data.studentId;
  });
}

/* ── New course modal ───────────────────────────────────────────── */
export function openNewCourseModal() {
  [
    'nc-teacher',
    'nc-course-type',
    'nc-subject',
    'nc-level',
    'nc-group',
    'nc-sessions',
    'nc-session-length',
    'nc-price',
    'nc-price-person',
    'nc-location',
    'nc-datetime',
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.tagName === 'SELECT') el.value = el.options[0]?.value;
    else if (id === 'nc-session-length') el.value = '50';
    else el.value = '';
  });
  participantCount = 1;
  const container = document.getElementById('nc-participants');
  container.innerHTML = renderParticipantBlock(0);
  attachSearchListeners(0);

  const sel = document.getElementById('nc-teacher');
  loadTeachers().then((teachers) => {
    sel.innerHTML = teachers
      .map(
        (t) =>
          `<option value="${t.id}"${!t.authorised ? ' disabled' : ''}>${esc(t.name)}${!t.authorised ? ' (not authorised)' : ''}</option>`
      )
      .join('');
  });
  const msgEl = document.getElementById('nc-msg');
  if (msgEl) {
    msgEl.classList.remove('is-visible-block');
    msgEl.textContent = '';
  }
  const btn = document.getElementById('nc-submit');
  if (btn) {
    btn.textContent = 'create course & calendar event';
    btn.disabled = false;
  }
  document.getElementById('new-course-modal').classList.add('open');

  // Fetch students for search (fire-and-forget, safe fallback on failure)
  apiFetch('/api/get-students?status=all')
    .then((res) => {
      if (res.ok) return res.json();
      throw new Error();
    })
    .then((data) => {
      studentCache = data;
    })
    .catch(() => {
      studentCache = [];
    });

  // Click-away handler: close any open dropdown when clicking outside participants
  if (clickAwayHandler) document.removeEventListener('click', clickAwayHandler);
  clickAwayHandler = (e) => {
    if (!e.target.closest('#nc-participants')) {
      document.querySelectorAll('#nc-participants .participant-block').forEach((block) => {
        const idx = block.id.replace('nc-p-', '');
        hideDropdown(parseInt(idx, 10));
      });
    }
  };
  document.addEventListener('click', clickAwayHandler);
}

export function closeNewCourseModal() {
  document.getElementById('new-course-modal').classList.remove('open');
  if (clickAwayHandler) {
    document.removeEventListener('click', clickAwayHandler);
    clickAwayHandler = null;
  }
}

export function removeParticipantBlock(el) {
  const block = el.closest('.participant-block');
  if (block) block.remove();
}

export function addParticipantBlock() {
  const container = document.getElementById('nc-participants');
  const i = participantCount++;
  const wrapper = document.createElement('div');
  wrapper.innerHTML = renderParticipantBlock(i, { showRemove: true });
  container.appendChild(wrapper.firstElementChild);
  attachSearchListeners(i);
}

export async function submitNewCourse() {
  const btn = document.getElementById('nc-submit');
  const msgEl = document.getElementById('nc-msg');
  msgEl.classList.remove('is-visible-block');

  const teacherId = document.getElementById('nc-teacher').value;
  const courseType = document.getElementById('nc-course-type').value;
  const subject = document.getElementById('nc-subject').value;
  const level = document.getElementById('nc-level').value;
  const groupType = document.getElementById('nc-group').value;
  const sessions = document.getElementById('nc-sessions').value;
  const sessionLength = document.getElementById('nc-session-length').value;
  const price = document.getElementById('nc-price').value;
  const pricePerson = document.getElementById('nc-price-person')?.value || '';
  const location = document.getElementById('nc-location').value;
  const datetime = document.getElementById('nc-datetime').value;

  if (!teacherId || !datetime) {
    msgEl.textContent = 'Please select a teacher and set a first session date.';
    msgEl.className = 'modal-msg err';
    msgEl.classList.add('is-visible-block');
    return;
  }

  const participants = [];
  document.querySelectorAll('#nc-participants .participant-block').forEach((block) => {
    const idx = block.id.replace('nc-p-', '');
    const first = document.getElementById(`nc-p${idx}-first`)?.value?.trim();
    const last = document.getElementById(`nc-p${idx}-last`)?.value?.trim();
    const email = document.getElementById(`nc-p${idx}-email`)?.value?.trim();
    const phone = document.getElementById(`nc-p${idx}-phone`)?.value?.trim();
    const selectedStudentId = block.dataset.selectedStudentId || '';
    // New students only require a first name; existing selections need no input here.
    if (selectedStudentId || first) {
      participants.push({
        firstName: first || '',
        lastName: last || '',
        email: email || '',
        phone: phone || '',
        studentId: selectedStudentId || '',
      });
    }
  });

  btn.textContent = 'creating…';
  btn.disabled = true;

  try {
    const durationMinutes = parseInt(sessionLength) || 50;
    const res = await apiFetch('/api/confirm-booking', {
      method: 'POST',
      body: {
        teacher_id: teacherId,
        sessions_total: sessions ? parseInt(sessions) : null,
        first_session_at: new Date(datetime).toISOString(),
        duration_minutes: durationMinutes,
        session_length_minutes: durationMinutes,
        price_per_session: price ? parseFloat(price) : null,
        price_per_person_per_60min: pricePerson ? parseFloat(pricePerson) : null,
        location: location || null,
        booking_data: { course_type: courseType, subject, level, group: groupType },
        contact_data: { participants },
      },
    });

    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Unknown error');

    msgEl.textContent = `Created. Course: ${result.course_code}`;
    msgEl.className = 'modal-msg success';
    btn.textContent = 'created';

    setTimeout(() => {
      closeNewCourseModal();
      loadCourses(currentCourseFilter);
    }, MESSAGE_TIMEOUT_MS);
  } catch (err) {
    msgEl.textContent = 'Error: ' + err.message;
    msgEl.className = 'modal-msg err';
    msgEl.classList.add('is-visible-block');
    btn.textContent = 'create course & calendar event';
    btn.disabled = false;
  }
}

export async function cancelCourse(courseId, courseCode) {
  if (
    !confirm(
      `Cancel course ${courseCode || courseId}?\n\nAll upcoming sessions and calendar events will be cancelled. The course record will be kept.`
    )
  )
    return;
  try {
    const res = await apiFetch('/api/cancel-course', {
      method: 'PATCH',
      body: { course_id: courseId },
    });
    if (!res.ok) throw new Error();
    await loadCourses(currentCourseFilter);
  } catch {
    alert('Could not cancel course. Please try again.');
  }
}

export async function completeCourse(courseId, courseCode) {
  if (
    !confirm(
      `Mark course ${courseCode || courseId} as completed?\n\nThe course record will be kept and moved to the completed view.`
    )
  )
    return;
  try {
    const res = await apiFetch('/api/update-course', {
      method: 'PATCH',
      body: { course_id: courseId, status: 'completed' },
    });
    if (!res.ok) throw new Error();
    await loadCourses(currentCourseFilter);
  } catch {
    alert('Could not mark course as completed. Please try again.');
  }
}

export function toggleStatusDropdown(courseId) {
  const drop = document.getElementById('status-drop-' + courseId);
  if (!drop) return;
  const isOpen = !drop.classList.contains('is-hidden');
  document.querySelectorAll('.status-dropdown').forEach((d) => {
    d.classList.add('is-hidden');
  });
  if (!isOpen) drop.classList.remove('is-hidden');
}

export async function setCourseStatus(courseId, courseCode, newStatus) {
  document.querySelectorAll('.status-dropdown').forEach((d) => {
    d.classList.add('is-hidden');
  });

  if (newStatus === 'delete') return deleteCourse(courseId, courseCode);
  if (newStatus === 'cancelled') return cancelCourse(courseId, courseCode);
  if (newStatus === 'completed') return completeCourse(courseId, courseCode);

  const course = coursesCache.find((c) => String(c.id) === String(courseId));
  if (
    newStatus === 'active' &&
    course?.status === 'cancelled' &&
    !confirm(
      `Reactivate course ${courseCode || courseId}?\n\nSessions cancelled with the course will not be restored. Use "sync calendar" to pull in upcoming sessions.`
    )
  )
    return;

  try {
    const res = await apiFetch('/api/update-course', {
      method: 'PATCH',
      body: { course_id: courseId, status: newStatus },
    });
    if (!res.ok) throw new Error();
    await loadCourses(currentCourseFilter);
  } catch {
    alert('Could not update course status. Please try again.');
  }
}

export async function deleteCourse(courseId, courseCode) {
  const course = coursesCache.find((c) => String(c.id) === String(courseId));
  const hasStudents = (course?.students || []).length > 0;
  const enrolmentWarning = hasStudents
    ? '\n\nThis course has enrolled students. Consider using "cancel" instead to keep the record.'
    : '';
  if (
    !confirm(
      `Delete course ${courseCode || courseId}?\n\nThis will cancel all upcoming calendar events and remove the course and all its sessions permanently.${enrolmentWarning}`
    )
  )
    return;
  try {
    const res = await apiFetch('/api/delete-course', {
      method: 'DELETE',
      body: { course_id: courseId },
    });
    if (!res.ok) throw new Error();
    const row = document.getElementById('course-' + courseId);
    if (row) row.remove();
  } catch {
    alert('Could not delete course. Please try again.');
  }
}

export async function removeStudentFromCourse(courseId, studentId, btn) {
  const studentName = btn?.dataset.studentName || 'this student';
  if (
    !confirm(
      `Remove ${studentName} from this course? Attendance records for this course will also be removed.`
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
    if (!res.ok) throw new Error(result.error || 'Could not remove student.');

    await loadCourses(currentCourseFilter);
    const detail = document.getElementById('course-detail-' + courseId);
    if (detail) detail.classList.add('open');
  } catch (err) {
    alert(err.message || 'Could not remove student from course.');
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'remove from course';
    }
  }
}

export async function handleCourseBooking(enquiryId, action, courseId, btn) {
  const verb = action === 'approve' ? 'approve' : 'decline';
  if (!confirm(`${verb[0].toUpperCase() + verb.slice(1)} this direct booking request?`)) return;

  const msg = document.getElementById('booking-msg-' + enquiryId);
  const row = document.getElementById('pending-booking-' + enquiryId);
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

    if (msg) showMessage(msg, action === 'approve' ? 'approved' : 'declined');
    await loadCourses(currentCourseFilter);
    const detail = document.getElementById('course-detail-' + courseId);
    if (detail) detail.classList.add('open');
  } catch (err) {
    if (msg) {
      showErrorMessage(msg, 'Error: ' + err.message);
    } else {
      alert('Could not update booking request: ' + err.message);
    }
    buttons.forEach((button) => {
      button.disabled = false;
    });
    if (btn) btn.textContent = action === 'approve' ? 'approve' : 'decline';
  }
}

/* ── Attendance modal ───────────────────────────────────────────── */
export async function openAttendanceModal(sessionId, courseId, dateLabel) {
  document.getElementById('att-session-id').value = sessionId;
  document.getElementById('att-course-id').value = courseId;
  document.getElementById('att-title').textContent = 'attendance — ' + (dateLabel || '');
  const container = document.getElementById('att-students');
  container.innerHTML = '<p class="loading-state loading-state--compact">loading students…</p>';
  const msg = document.getElementById('att-msg');
  msg.classList.remove('is-visible-block');
  msg.textContent = '';
  const btn = document.getElementById('att-submit');
  btn.textContent = 'save attendance';
  btn.disabled = false;
  document.getElementById('attendance-modal').classList.add('open');

  try {
    const coursesRes = await apiFetch('/api/get-courses?status=all');
    const courses = await coursesRes.json();
    const course = courses.find((c) => c.id === courseId);
    const session = course?.sessions?.find((s) => String(s.id) === String(sessionId));
    attendanceStudents = (course?.students || []).filter((student) =>
      studentStartsBySession(student, session)
    );

    let existingAttendance = [];
    try {
      const attRes = await apiFetch('/api/get-attendance?session_id=' + sessionId);
      if (attRes.ok) existingAttendance = await attRes.json();
    } catch {
      /* ok, no existing attendance */
    }

    const attMap = {};
    existingAttendance.forEach((a) => {
      attMap[a.student_id] = a;
    });

    if (!attendanceStudents.length) {
      container.innerHTML =
        '<p class="attendance-empty-note">No students enrolled in this course.</p>';
      return;
    }

    container.innerHTML = attendanceStudents
      .map((s) => {
        const name = esc([s.first_name, s.last_name].filter(Boolean).join(' ') || s.email || '—');
        const existing = attMap[s.id];
        const checked = existing ? existing.present : true;
        const statusLabel = existing
          ? existing.present
            ? '<span class="att-status present">present</span>'
            : '<span class="att-status absent">absent</span>'
          : '';

        return `
      <div class="att-row">
        <label>
          <input type="checkbox" data-student-id="${s.id}" ${checked ? 'checked' : ''}>
          ${name}
        </label>
        ${statusLabel}
      </div>`;
      })
      .join('');
  } catch {
    container.innerHTML = '<p class="attendance-error-note">Could not load students.</p>';
  }
}

export function closeAttendanceModal() {
  document.getElementById('attendance-modal').classList.remove('open');
}

export async function submitAttendance() {
  const btn = document.getElementById('att-submit');
  const msgEl = document.getElementById('att-msg');
  const sessionId = document.getElementById('att-session-id').value;
  const courseId = document.getElementById('att-course-id').value;
  msgEl.classList.remove('is-visible-block');

  const records = [];
  document.querySelectorAll('#att-students input[type="checkbox"]').forEach((cb) => {
    records.push({
      student_id: cb.dataset.studentId,
      present: cb.checked,
    });
  });

  if (!records.length) {
    msgEl.textContent = 'No students to record attendance for.';
    msgEl.className = 'modal-msg err';
    msgEl.classList.add('is-visible-block');
    return;
  }

  btn.textContent = 'saving…';
  btn.disabled = true;

  try {
    const res = await apiFetch('/api/save-attendance', {
      method: 'POST',
      body: { session_id: sessionId, records },
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Unknown error');

    markSessionCompletedInList(sessionId, courseId, result.newly_completed);

    msgEl.textContent = `Saved attendance for ${result.saved_count} student(s). Session marked completed.`;
    msgEl.className = 'modal-msg success';
    btn.textContent = 'saved';

    setTimeout(() => closeAttendanceModal(), MESSAGE_TIMEOUT_MS);
  } catch (err) {
    msgEl.textContent = 'Error: ' + err.message;
    msgEl.className = 'modal-msg err';
    msgEl.classList.add('is-visible-block');
    btn.textContent = 'save attendance';
    btn.disabled = false;
  }
}

/* ── Add participant to existing course ─────────────────────────── */

export function initAddParticipantSearch() {
  if (apSearchListenersAttached) return;
  apSearchListenersAttached = true;

  const inputEl = document.getElementById('ap-search');
  const dropdownEl = document.getElementById('ap-dropdown');
  if (!inputEl || !dropdownEl) return;

  buildStudentSearch(inputEl, dropdownEl, (data) => {
    document.getElementById('ap-selected-id').value = data.studentId;
    document.getElementById('ap-first').value = data.first;
    document.getElementById('ap-last').value = data.last;
    document.getElementById('ap-email').value = data.email;
    document.getElementById('ap-phone').value = data.phone;
  });
}

export function openAddParticipantModal(courseId) {
  addParticipantCourseId = courseId;
  document.getElementById('ap-search').value = '';
  document.getElementById('ap-selected-id').value = '';
  document.getElementById('ap-first').value = '';
  document.getElementById('ap-last').value = '';
  document.getElementById('ap-email').value = '';
  document.getElementById('ap-phone').value = '';
  document.getElementById('ap-joined-at').value = todayInputValue();
  const msgEl = document.getElementById('ap-msg');
  msgEl.classList.remove('is-visible-block');
  msgEl.textContent = '';
  const btn = document.getElementById('ap-submit');
  btn.textContent = 'add';
  btn.disabled = false;
  const dropdown = document.getElementById('ap-dropdown');
  if (dropdown) dropdown.classList.add('is-hidden');
  document.getElementById('add-participant-modal').classList.add('open');

  // Ensure studentCache is populated
  if (!studentCache.length) {
    apiFetch('/api/get-students?status=all')
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => {
        studentCache = d;
      })
      .catch(() => {});
  }
}

export function closeAddParticipantModal() {
  document.getElementById('add-participant-modal').classList.remove('open');
  addParticipantCourseId = null;
}

/* ── Edit course modal ──────────────────────────────────────────── */

export function openEditCourseModal(courseId) {
  const course = coursesCache.find((c) => c.id === courseId);
  if (!course) {
    alert('Could not find course.');
    return;
  }

  document.getElementById('ec-id').value = course.id;
  document.getElementById('ec-code-label').textContent = course.course_code
    ? 'Course code: ' + course.course_code
    : '';
  document.getElementById('ec-course-type').value = course.course_type || 'language course';
  document.getElementById('ec-subject').value = course.subject || 'German';
  document.getElementById('ec-level').value = course.level || '';
  document.getElementById('ec-group').value = course.group_type || 'private';
  document.getElementById('ec-status').value = course.status || 'active';
  document.getElementById('ec-sessions').value =
    course.sessions_total !== null && course.sessions_total !== undefined
      ? course.sessions_total
      : '';
  document.getElementById('ec-session-length').value = course.session_length_minutes || '';
  document.getElementById('ec-price').value =
    course.price_per_session !== null && course.price_per_session !== undefined
      ? course.price_per_session
      : '';
  const pricePersonEl = document.getElementById('ec-price-person');
  if (pricePersonEl) {
    pricePersonEl.value =
      course.price_per_person_per_60min !== null && course.price_per_person_per_60min !== undefined
        ? course.price_per_person_per_60min
        : '';
  }
  document.getElementById('ec-currency').value = course.currency || 'CHF';
  document.getElementById('ec-location').value = course.location || '';

  const msg = document.getElementById('ec-msg');
  msg.classList.remove('is-visible-block');
  msg.textContent = '';
  const btn = document.getElementById('ec-submit');
  btn.textContent = 'save changes';
  btn.disabled = false;

  document.getElementById('edit-course-modal').classList.add('open');
}

export function closeEditCourseModal() {
  document.getElementById('edit-course-modal').classList.remove('open');
}

export async function submitEditCourse() {
  const btn = document.getElementById('ec-submit');
  const msg = document.getElementById('ec-msg');
  msg.classList.remove('is-visible-block');

  const courseId = document.getElementById('ec-id').value;
  if (!courseId) return;

  const sessionsVal = document.getElementById('ec-sessions').value;
  const lengthVal = document.getElementById('ec-session-length').value;
  const priceVal = document.getElementById('ec-price').value;
  const pricePersonVal = document.getElementById('ec-price-person')?.value || '';

  const body = {
    course_id: courseId,
    course_type: document.getElementById('ec-course-type').value,
    subject: document.getElementById('ec-subject').value,
    level: document.getElementById('ec-level').value || null,
    group_type: document.getElementById('ec-group').value,
    status: document.getElementById('ec-status').value,
    sessions_total: sessionsVal === '' ? null : parseInt(sessionsVal, 10),
    session_length_minutes: lengthVal === '' ? null : parseInt(lengthVal, 10),
    price_per_session: priceVal === '' ? null : parseFloat(priceVal),
    price_per_person_per_60min: pricePersonVal === '' ? null : parseFloat(pricePersonVal),
    currency: document.getElementById('ec-currency').value || 'CHF',
    location: document.getElementById('ec-location').value || null,
  };

  btn.textContent = 'saving…';
  btn.disabled = true;

  try {
    const res = await apiFetch('/api/update-course', { method: 'PATCH', body });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Unknown error');

    msg.textContent = 'Course updated.';
    msg.className = 'modal-msg success';
    btn.textContent = 'saved';

    setTimeout(() => {
      closeEditCourseModal();
      loadCourses(currentCourseFilter);
    }, MESSAGE_TIMEOUT_MS);
  } catch (err) {
    msg.textContent = 'Error: ' + err.message;
    msg.className = 'modal-msg err';
    msg.classList.add('is-visible-block');
    btn.textContent = 'save changes';
    btn.disabled = false;
  }
}

export async function submitAddParticipant() {
  const btn = document.getElementById('ap-submit');
  const msgEl = document.getElementById('ap-msg');
  msgEl.classList.remove('is-visible-block');
  btn.disabled = true;
  btn.textContent = 'adding…';

  const studentId = document.getElementById('ap-selected-id').value;
  const body = studentId
    ? { course_id: addParticipantCourseId, student_id: studentId }
    : {
        course_id: addParticipantCourseId,
        first_name: document.getElementById('ap-first').value.trim() || null,
        last_name: document.getElementById('ap-last').value.trim() || null,
        email: document.getElementById('ap-email').value.trim() || null,
        phone: document.getElementById('ap-phone').value.trim() || null,
      };
  body.joined_at = document.getElementById('ap-joined-at')?.value || null;

  try {
    const res = await apiFetch('/api/add-enrolment', { method: 'POST', body });
    if (!res.ok) {
      const e = await res.json();
      throw new Error(e.error || 'Failed');
    }
    btn.textContent = 'added';
    const courseId = addParticipantCourseId;
    closeAddParticipantModal();
    await loadCourses(currentCourseFilter);
    document.getElementById('course-detail-' + courseId)?.classList.add('open');
  } catch (err) {
    msgEl.textContent = 'Error: ' + err.message;
    msgEl.classList.add('is-visible-block');
    btn.textContent = 'add';
    btn.disabled = false;
  }
}

/* ── Email: course confirmation + schedule updates ───────────────── */
function studentDisplayName(s) {
  return [s.first_name, s.last_name].filter(Boolean).join(' ') || '—';
}

async function refreshCourseInCache(courseId) {
  const res = await apiFetch('/api/get-courses?status=all');
  if (!res.ok) throw new Error('Could not refresh course data.');
  const courses = await res.json();
  const fresh = courses.find((c) => String(c.id) === String(courseId));
  if (!fresh) throw new Error('Course not found. Please reload and try again.');
  const idx = coursesCache.findIndex((c) => String(c.id) === String(courseId));
  if (idx >= 0) coursesCache[idx] = fresh;
  else coursesCache.push(fresh);
  return fresh;
}

function upcomingSessions(course) {
  return (course.sessions || [])
    .filter((s) => s.status !== 'cancelled')
    .slice()
    .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
}

function fmtScheduleSession(session, course) {
  const duration = session.duration_minutes ?? course.session_length_minutes ?? null;
  const label = fmtDateWithEnd(session.scheduled_at, duration);
  return duration ? `${label} (${duration} min)` : label;
}

export async function sendCourseConfirmation(courseId) {
  let course = coursesCache.find((c) => String(c.id) === String(courseId));
  if (!course) {
    alert('Course not found. Please reload and try again.');
    return;
  }
  try {
    course = await refreshCourseInCache(courseId);
  } catch (err) {
    alert(err.message || 'Could not refresh course data.');
    return;
  }
  const recipients = (course.students || [])
    .filter((s) => s.email)
    .map((s) => ({
      student_id: s.id,
      name: studentDisplayName(s),
      email: s.email,
      selected: true,
    }));
  if (!recipients.length) {
    alert('No enrolled students with an email address.');
    return;
  }

  const sessions = upcomingSessions(course);
  const sessionListHtml = sessions.length
    ? `<ol class="cs-session-list">${sessions
        .map((s) => `<li>${esc(fmtScheduleSession(s, course))}</li>`)
        .join('')}</ol>`
    : '<p class="cs-empty">No lessons scheduled yet.</p>';

  const contentHtml = `
    <p class="cs-section-label">course overview</p>
    <ul class="cs-detail-list">
      <li>Code: ${esc(course.course_code || '—')}</li>
      <li>Course type: ${esc(course.course_type || '—')}</li>
      <li>Subject: ${esc(course.subject || '—')}</li>
      <li>Level: ${esc(course.level || '—')}</li>
      <li>Sessions: ${course.sessions_total ? esc(String(course.sessions_total)) : 'open-ended'}</li>
      <li>Lesson duration: ${course.session_length_minutes ? esc(`${course.session_length_minutes} min`) : '—'}</li>
      <li>Location: ${esc(course.location || '—')}</li>
    </ul>
    <p class="cs-section-label">scheduled lessons (${sessions.length})</p>
    ${sessionListHtml}
    <p class="cs-section-label">also included</p>
    <ul class="cs-detail-list">
      <li>24-hour cancellation policy</li>
      <li>AGB / terms &amp; conditions</li>
      <li>English confirmations include both English and German AGB</li>
    </ul>
  `;

  openConfirmSend({
    title: 'send course confirmation',
    recipients,
    subject: `Kursbestätigung / Course confirmation - ${course.course_code || 'course'} · learning with gioia`,
    contentHtml,
    languageOptions: [
      { value: 'de', label: 'Deutsch' },
      { value: 'en', label: 'English' },
    ],
    defaultLanguage: 'de',
    selectableRecipients: true,
    onConfirm: async ({ language, recipients: selectedRecipients }) => {
      if (!selectedRecipients.length) throw new Error('Select at least one recipient.');
      const msg = document.getElementById('confirm-msg-' + courseId);
      const res = await apiFetch('/api/send-course-confirmation', {
        method: 'POST',
        body: {
          course_id: courseId,
          student_ids: selectedRecipients.map((r) => r.student_id),
          language,
        },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      const label = `sent to ${body.sent || 0}` + (body.failed ? ` · ${body.failed} failed` : '');
      if (msg) showMessage(msg, label);
    },
  });
}

export function openCertificateModal(courseId) {
  return openCertificates(courseId, coursesCache);
}

export async function openScheduleModal(courseId) {
  let course = coursesCache.find((c) => String(c.id) === String(courseId));
  if (!course) {
    alert('Course not found. Please reload and try again.');
    return;
  }
  try {
    course = await refreshCourseInCache(courseId);
  } catch (err) {
    alert(err.message || 'Could not refresh course data.');
    return;
  }
  const recipients = (course.students || [])
    .filter((s) => s.email)
    .map((s) => ({
      student_id: s.id,
      name: studentDisplayName(s),
      email: s.email,
      selected: true,
    }));
  if (!recipients.length) {
    alert('No enrolled students with an email address.');
    return;
  }

  const sessions = upcomingSessions(course);
  const sessionListHtml = sessions.length
    ? `<ol class="cs-session-list">${sessions
        .map((s) => `<li>${esc(fmtScheduleSession(s, course))}</li>`)
        .join('')}</ol>`
    : '<p class="cs-empty">No upcoming lessons currently scheduled.</p>';

  const contentHtml = `
    <p class="cs-section-label">updated schedule for ${esc(course.course_code || 'course')} (${sessions.length})</p>
    ${sessionListHtml}
  `;

  openConfirmSend({
    title: 'send schedule update',
    recipients,
    subject: `Aktualisierter Lektionsplan / Updated lesson plan${course.course_code ? ' (' + course.course_code + ')' : ''} — learning with gioia`,
    contentHtml,
    languageOptions: [
      { value: 'de', label: 'Deutsch' },
      { value: 'en', label: 'English' },
    ],
    defaultLanguage: 'de',
    selectableRecipients: true,
    onConfirm: async ({ language, recipients: selectedRecipients }) => {
      if (!selectedRecipients.length) throw new Error('Select at least one recipient.');
      const msg = document.getElementById('schedule-msg-' + courseId);
      const res = await apiFetch('/api/send-session-schedule', {
        method: 'POST',
        body: {
          course_id: courseId,
          student_ids: selectedRecipients.map((r) => r.student_id),
          language,
        },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      const label = `sent to ${body.sent || 0}` + (body.failed ? ` · ${body.failed} failed` : '');
      if (msg) showMessage(msg, label);
    },
  });
}
