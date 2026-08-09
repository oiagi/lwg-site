// public/admin/features/call-availability.js
// Weekly windows offered on the public site as bookable 15-minute intro
// calls, plus a read-only list of the calls already booked.
//
// Windows are per teacher and follow the selector at the top of the teachers
// tab. The server subtracts blocked dates, Google Calendar busy times and
// existing bookings when it builds the public slot list — nothing here.

import { apiFetch } from '../core/api.js';
import { esc } from '../core/helpers.js';

const WEEKDAYS = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

let bookings = null;

/** 'HH:MM:SS' → 'HH:MM'. */
function hm(time) {
  return String(time || '').slice(0, 5);
}

function showCallError(message) {
  const err = document.getElementById('call-availability-error');
  if (!err) return;
  err.textContent = message || '';
  err.classList.toggle('is-hidden', !message);
}

// ── Weekly windows ────────────────────────────────────────────────────────

export async function loadCallAvailability(teacherId) {
  const list = document.getElementById('call-availability-list');
  if (!list) return;

  if (!teacherId) {
    list.innerHTML = '<div class="empty-state">select a teacher to edit their call windows</div>';
    return;
  }

  list.innerHTML = '<div class="loading-state">loading…</div>';
  try {
    const res = await apiFetch(
      `/api/call-availability?teacher_id=${encodeURIComponent(teacherId)}`
    );
    if (!res.ok) throw new Error();
    renderCallAvailability(await res.json(), list);
  } catch {
    list.innerHTML =
      '<div class="loading-state">Could not load call windows. Has the call booking migration been run?</div>';
  }
}

function renderCallAvailability(windows, el) {
  if (!windows.length) {
    el.innerHTML =
      '<div class="empty-state">no call windows — the website shows no free times</div>';
    return;
  }
  el.innerHTML = windows
    .map(
      (w) => `
      <div class="blocked-dates-row${w.active ? '' : ' is-inactive'}">
        <span class="blocked-dates-range">${esc(WEEKDAYS[w.weekday] || '')}</span>
        <span class="blocked-dates-label">${esc(hm(w.start_time))} – ${esc(hm(w.end_time))}${
          w.active ? '' : ' (paused)'
        }</span>
        <button class="action-btn" data-action="toggleCallWindow" data-args="${esc(w.id)}" data-active="${
          w.active ? 'true' : 'false'
        }">${w.active ? 'pause' : 'activate'}</button>
        <button class="delete-btn" data-action="deleteCallWindow" data-args="${esc(w.id)}">remove</button>
      </div>`
    )
    .join('');
}

function selectedTeacherId() {
  return document.getElementById('avail-teacher')?.value || '';
}

export async function addCallWindow() {
  const teacherId = selectedTeacherId();
  if (!teacherId) {
    showCallError('Select a teacher first.');
    return;
  }
  const weekday = document.getElementById('call-window-weekday').value;
  const start = document.getElementById('call-window-start').value;
  const end = document.getElementById('call-window-end').value;

  if (!start || !end) {
    showCallError('Pick a start and end time.');
    return;
  }
  if (end <= start) {
    showCallError('The end time must be after the start time.');
    return;
  }
  showCallError('');

  try {
    const res = await apiFetch('/api/call-availability', {
      method: 'POST',
      body: { teacher_id: teacherId, weekday: Number(weekday), start_time: start, end_time: end },
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showCallError(data.error || 'Could not add the call window.');
      return;
    }
    await loadCallAvailability(teacherId);
  } catch {
    showCallError('Could not add the call window.');
  }
}

// Rendered as a button, not a checkbox: the change delegation in main.js does
// not pass the element, and the toggle needs to read its own current state.
export async function toggleCallWindow(id, el) {
  const active = el?.dataset.active === 'true';
  showCallError('');
  try {
    const res = await apiFetch('/api/call-availability', {
      method: 'PATCH',
      body: { id, active: !active },
    });
    if (!res.ok) throw new Error();
    await loadCallAvailability(selectedTeacherId());
  } catch {
    showCallError('Could not update the call window.');
  }
}

export async function deleteCallWindow(id) {
  if (
    !confirm(
      'Remove this call window? Calls already booked inside it stay booked — cancel those in Google Calendar.'
    )
  )
    return;
  showCallError('');
  try {
    const res = await apiFetch('/api/call-availability', { method: 'DELETE', body: { id } });
    if (!res.ok) throw new Error();
    await loadCallAvailability(selectedTeacherId());
  } catch {
    showCallError('Could not remove the call window.');
  }
}

// ── Booked calls ──────────────────────────────────────────────────────────

export async function loadCallBookings(force = false) {
  const list = document.getElementById('call-bookings-list');
  if (!list) return;
  if (bookings && !force) {
    renderCallBookings(bookings, list);
    return;
  }
  list.innerHTML = '<div class="loading-state">loading…</div>';
  try {
    const res = await apiFetch('/api/call-bookings?scope=upcoming');
    if (!res.ok) throw new Error();
    bookings = await res.json();
    renderCallBookings(bookings, list);
  } catch {
    list.innerHTML = '<div class="loading-state">Could not load booked calls.</div>';
  }
}

function formatBookingWhen(iso) {
  return new Date(iso).toLocaleString('de-CH', {
    timeZone: 'Europe/Zurich',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
}

function renderCallBookings(rows, el) {
  if (!rows.length) {
    el.innerHTML = '<div class="empty-state">no upcoming calls</div>';
    return;
  }
  el.innerHTML = rows
    .map((b) => {
      const name = `${b.first_name || ''} ${b.last_name || ''}`.trim();
      // A booking that never made it onto the calendar has to be visible —
      // otherwise a Google failure silently becomes a missed appointment.
      const warning =
        b.delivery === 'calendar'
          ? ''
          : '<span class="call-booking-warning">not on calendar — add manually</span>';
      return `
      <div class="blocked-dates-row">
        <span class="blocked-dates-range">${esc(formatBookingWhen(b.starts_at))}</span>
        <span class="blocked-dates-label">
          ${esc(name)} · <a href="mailto:${esc(b.email)}">${esc(b.email)}</a>
          ${b.phone ? ` · ${esc(b.phone)}` : ''}
          ${b.topic ? `<br /><span class="call-booking-topic">${esc(b.topic)}</span>` : ''}
        </span>
        ${warning}
      </div>`;
    })
    .join('');
}
