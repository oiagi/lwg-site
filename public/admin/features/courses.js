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
import { MESSAGE_TIMEOUT_MS } from '../core/constants.js';
import { loadGroupSlots } from './course-slots.js';

let currentCourseFilter = 'active';
const courseListState = { search: '', sort: 'created_at', direction: 'desc' };
let studentCache = [];
let addParticipantCourseId = null;
let apSearchListenersAttached = false;
let courseControlsAttached = false;

// Owned here, shared with course-communications.js (which mutates entries
// in place but never reassigns).
export let coursesCache = [];

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

export function showErrorMessage(el, text) {
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

export function formatMoney(amount, currency = 'CHF') {
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

function sentCommunicationsBlock(course) {
  const students = course.students || [];
  const total = students.length;

  const confirmedAt = course.course_confirmation_sent_at;
  const confirmationSent = students.filter((s) => s.confirmation_sent_at);
  const scheduleSent = students.filter((s) => s.schedule_sent_at);
  const certSent = students.filter((s) => s.certificate_sent_at);
  const contractSent = students.filter((s) => s.contract_sent_at);
  const contractSigned = students.filter((s) => s.contract_signed_at);
  const invoiceSent = students.filter((s) => s.invoice_sent_at);
  // Keyed off the list, not invoice_cancelled_at: a database without the
  // cancelled_at column still reports the cancellation, just without a date.
  const invoiceCancelled = students.filter((s) => s.cancelled_invoices?.length);

  if (
    !confirmedAt &&
    !confirmationSent.length &&
    !scheduleSent.length &&
    !certSent.length &&
    !contractSent.length &&
    !invoiceSent.length &&
    !invoiceCancelled.length
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
  if (contractSent.length) {
    const last = latest(contractSent, 'contract_sent_at');
    const signedNote = contractSigned.length ? ` · ${contractSigned.length} signed` : '';
    items.push(
      `<li>contract sent to ${contractSent.length} of ${total}${signedNote} · <span class="detail-muted">last ${esc(
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
  if (invoiceCancelled.length) {
    const count = invoiceCancelled.reduce((sum, s) => sum + s.cancelled_invoices.length, 0);
    const last = latest(invoiceCancelled, 'invoice_cancelled_at');
    const when = last ? ` · <span class="detail-muted">last ${esc(fmtDate(last))}</span>` : '';
    items.push(
      `<li class="sent-status-cancelled">${count} invoice${count === 1 ? '' : 's'} cancelled (storno)${when}</li>`
    );
  }

  return `
    <div class="sent-status">
      <p class="detail-meta">communications</p>
      <ul class="sent-status-list">${items.join('')}</ul>
    </div>`;
}

/* Summary only — the responses themselves are fetched on demand by
   loadCourseFeedback in features/feedback.js, so the course list stays lean. */
function feedbackBlock(course) {
  const summary = course.feedback_summary;
  if (!summary?.requested) return '';

  const nps =
    summary.nps?.score !== null && summary.nps?.score !== undefined
      ? `<li>NPS ${esc(String(summary.nps.score))} · <span class="detail-muted">${esc(String(summary.nps.average))}/10 from ${summary.nps.responses}</span></li>`
      : '';
  const averageItems = (summary.averages || [])
    .filter((a) => a.value !== null && a.value !== undefined)
    .map(
      (a) =>
        `<li>${esc(a.label)} · <span class="detail-muted">${esc(String(a.value))}/5</span></li>`
    )
    .join('');

  const viewButton = summary.submitted
    ? `<button class="save-btn feedback-view-btn" data-action="loadCourseFeedback"
         data-args="${course.id}">view responses</button>`
    : '';

  return `
    <div class="sent-status">
      <p class="detail-meta">feedback</p>
      <ul class="sent-status-list">
        <li>${summary.submitted} of ${summary.requested} responded</li>
        ${nps}
        ${averageItems}
      </ul>
      ${viewButton}
      <div class="course-feedback-responses" id="course-feedback-${course.id}"></div>
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

// Completed minutes are summed from actual session durations; the total is the
// nominal contract amount (booked sessions × default session length), which stays
// fixed even when the time is redistributed across a different number of
// sessions. Returns null when completed durations can't be determined.
function computeCourseMinutes(course) {
  const defaultLen = course.session_length_minutes || null;
  const sessions = (course.sessions || []).filter((s) => s.status !== 'cancelled');
  let doneMin = 0;
  for (const s of sessions) {
    if (s.status !== 'completed') continue;
    const dur = s.duration_minutes ?? defaultLen;
    if (!dur) return null;
    doneMin += dur;
  }
  const totalMin = course.sessions_total && defaultLen ? course.sessions_total * defaultLen : null;
  return { doneMin, totalMin };
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
      const minutes = computeCourseMinutes(c);
      let minutesLine = '';
      if (minutes) {
        minutesLine =
          minutes.totalMin !== null
            ? ` · ${minutes.doneMin} / ${minutes.totalMin} min`
            : ` · ${minutes.doneMin} min`;
      }
      const sessLine =
        (total ? `${done} / ${total} sessions` : `${done} sessions completed`) + minutesLine;

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
      <div class="session-row" id="sess-${s.id}" data-duration="${s.duration_minutes ?? c.session_length_minutes ?? ''}">
        <div class="session-number">${idx + 1}.</div>
        <div class="session-status-dot ${s.status}"></div>
        <div class="session-date">${fmtDateWithEnd(s.scheduled_at, s.duration_minutes)}</div>
        <div class="session-status-label">${s.status}</div>
        <button class="action-btn" data-action="openAttendanceModal" data-args="${s.id},${c.id},${fmtDate(s.scheduled_at)}">attendance</button>
        ${
          s.status === 'scheduled'
            ? `
          <button class="cancel-btn" data-action="cancelSession" data-args="${s.id}">cancel</button>
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
                return `<li class="course-invoice-row"><span><span class="course-invoice-number">${num}</span> <span class="detail-muted">${amount} · ${status}</span></span></li>`;
              })
              .join('');
            // Cancelled originals carry the storno that voided them, so the pair
            // reads as one line instead of two rows with opposite amounts.
            const cancelledInvoices = (s.cancelled_invoices || [])
              .slice()
              .sort((a, b) =>
                String(b.issued_date || '').localeCompare(String(a.issued_date || ''))
              )
              .map((inv) => {
                const amount =
                  inv.total_amount !== null && inv.total_amount !== undefined
                    ? `${Number(inv.total_amount).toFixed(2)} ${esc(inv.currency || 'CHF')}`
                    : '—';
                const num = esc(inv.invoice_number || '—');
                const storno = inv.storno_invoice_number
                  ? `<span class="course-invoice-storno">storno ${esc(inv.storno_invoice_number)}</span>`
                  : '';
                return `<li class="course-invoice-row course-invoice-row--cancelled"><span><span class="course-invoice-number">${num}</span> <span class="detail-muted">${amount} · cancelled</span> ${storno}</span></li>`;
              })
              .join('');
            const invoiceBlock =
              (openInvoices
                ? `<div class="course-invoice-list"><p class="detail-muted course-invoice-list-label">open invoices</p><ul>${openInvoices}</ul></div>`
                : '') +
              (cancelledInvoices
                ? `<div class="course-invoice-list"><p class="detail-muted course-invoice-list-label">cancelled invoices</p><ul>${cancelledInvoices}</ul></div>`
                : '');
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
              s.contract_signed_at
                ? `<span class="sent-tag paid-tag">contract signed · ${esc(fmtDate(s.contract_signed_at))}</span>
                   <button class="contract-view-btn" data-action="downloadSignedContract"
                     data-args="${s.contract_id}">view signed contract</button>`
                : s.contract_sent_at
                  ? `<span class="sent-tag">contract sent · ${esc(fmtDate(s.contract_sent_at))}</span>`
                  : '',
              s.feedback_submitted_at
                ? `<span class="sent-tag paid-tag">feedback given · ${esc(fmtDate(s.feedback_submitted_at))}</span>`
                : s.feedback_requested_at
                  ? `<span class="sent-tag">feedback requested · ${esc(fmtDate(s.feedback_requested_at))}</span>`
                  : '',
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
          ${paidInvoiceTags ? `<div class="sent-tag-row">${paidInvoiceTags}</div>` : ''}
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
                    data-action="openContractModal" data-args="${c.id}">send contracts</button>
                  <span class="saved-msg" id="contract-row-msg-${c.id}">sent</span>
                </div>
                <div class="detail-action-row">
                  <button class="save-btn"
                    data-action="openBulkInvoiceModal" data-args="${c.id}">send invoices</button>
                  <span class="saved-msg" id="bulk-invoice-msg-${c.id}">sent</span>
                </div>
                <div class="detail-action-row">
                  <button class="save-btn"
                    data-action="openFeedbackRequestModal" data-args="${c.id}">request feedback</button>
                  <span class="saved-msg" id="feedback-msg-${c.id}">sent</span>
                </div>
              </div>
              ${sentCommunicationsBlock(c)}
              ${feedbackBlock(c)}
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
      if (body.blocked_sessions_moved)
        parts.push(`${body.blocked_sessions_moved} moved off blocked dates`);
      if (body.deduplicated) parts.push(`${body.deduplicated} duplicates removed`);
      showMessage(msg, parts.length ? 'synced · ' + parts.join(', ') : 'synced');
    }
    // Sessions the teacher moved by hand onto a blocked date are left exactly
    // where they were put — rewriting them would throw away a deliberate
    // reschedule — so they need deciding on rather than reporting silently.
    const conflicts = body.moved_onto_blocked_dates || [];
    if (conflicts.length) {
      alert(
        'These sessions were moved by hand onto blocked dates and were left ' +
          'untouched:\n\n' +
          conflicts.join('\n') +
          '\n\nMove them in Google Calendar, or remove the blocked period.'
      );
    }
    loadCourses(currentCourseFilter);
  } catch (err) {
    console.error('Sync error:', err);
    alert('Calendar sync failed: ' + (err.message || err));
  }
}

export async function cancelSession(sessionId) {
  if (!confirm('Cancel this session? The Google Calendar event and invite will be removed.'))
    return;
  try {
    const res = await apiFetch('/api/cancel-session', {
      method: 'DELETE',
      body: { session_id: sessionId },
    });
    if (!res.ok) throw new Error();
    // Re-read from the server rather than patching the counter by hand. The
    // old shortcut decremented the booked total, which cancel-session never
    // changes, so the row claimed a lesson had been deducted until the next
    // reload put it back.
    loadCourses(currentCourseFilter);
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

// Shared with attendance.js: saving attendance also completes the session.
export function markSessionCompletedInList(sessionId, courseId, shouldIncrementCount) {
  const row = document.getElementById('sess-' + sessionId);
  const duration = row ? parseInt(row.dataset.duration, 10) : NaN;
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

  const text = countEl.firstChild.textContent;

  const slashMatch = text.match(/(\d+) \/ (\d+) sessions/);
  if (slashMatch) {
    const newDone = parseInt(slashMatch[1], 10) + 1;
    const total = parseInt(slashMatch[2], 10);
    let newText = newDone + ' / ' + total + ' sessions';
    const minMatch = text.match(/(\d+) \/ (\d+) min/);
    const soloMinMatch = text.match(/· (\d+) min/);
    if (minMatch && !isNaN(duration)) {
      newText += ' · ' + (parseInt(minMatch[1], 10) + duration) + ' / ' + minMatch[2] + ' min';
    } else if (soloMinMatch && !isNaN(duration)) {
      newText += ' · ' + (parseInt(soloMinMatch[1], 10) + duration) + ' min';
    }
    countEl.firstChild.textContent = newText;
    return;
  }

  const openEndedMatch = text.match(/(\d+) sessions completed/);
  if (openEndedMatch) {
    const newDone = parseInt(openEndedMatch[1], 10) + 1;
    let newText = newDone + ' sessions completed';
    const minMatch = text.match(/· (\d+) min/);
    if (minMatch && !isNaN(duration)) {
      newText += ' · ' + (parseInt(minMatch[1], 10) + duration) + ' min';
    }
    countEl.firstChild.textContent = newText;
  }
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
