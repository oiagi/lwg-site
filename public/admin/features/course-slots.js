/* ── Public group-course booking slots ────────────────────────────────
   Admin panel for the "forming course" slots shown on the public booking
   page: list + collapse panel, create/edit modal, status toggles and the
   per-slot booking requests. Extracted from courses.js; loadCourses()
   still triggers loadGroupSlots() on every course reload.              */
import { apiFetch } from '../core/api.js';
import { esc, fmtDate, showMessage } from '../core/helpers.js';
import { formatCourseAddress, formatMoney, showErrorMessage } from './courses.js';

let groupSlotsCache = [];
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
