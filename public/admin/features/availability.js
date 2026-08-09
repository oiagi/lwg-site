/* ── Teacher availability tab ─────────────────────────────────────── */
import { apiFetch } from '../core/api.js';
import { esc } from '../core/helpers.js';
import { loadTeachers } from './teachers.js';
import { loadCallAvailability, loadCallBookings } from './call-availability.js';

let availabilityTeachers = null;
let blockedPeriods = null;

export async function loadAvailability() {
  loadBlockedDates();
  loadCallBookings();
  const container = document.getElementById('availability-content');
  const sel = document.getElementById('avail-teacher');

  // Load teachers into selector if not cached
  if (!availabilityTeachers) {
    try {
      const res = await apiFetch('/api/get-teacher-availability');
      if (!res.ok) throw new Error();
      availabilityTeachers = await res.json();
      sel.innerHTML =
        '<option value="">select teacher…</option>' +
        availabilityTeachers.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join('');
    } catch {
      sel.innerHTML = '<option value="">could not load teachers</option>';
    }
  }

  // If a teacher is already selected, reload their schedule
  loadCallAvailability(sel.value);
  if (sel.value) {
    loadTeacherSchedule(sel.value);
  } else {
    container.innerHTML = '<div class="empty-state">select a teacher to view their schedule</div>';
  }
}

export function onTeacherSelect() {
  const teacherId = document.getElementById('avail-teacher').value;
  loadCallAvailability(teacherId);
  if (teacherId) {
    loadTeacherSchedule(teacherId);
  } else {
    document.getElementById('availability-content').innerHTML =
      '<div class="empty-state">select a teacher to view their schedule</div>';
  }
}

async function loadTeacherSchedule(teacherId) {
  const container = document.getElementById('availability-content');
  container.innerHTML = '<div class="loading-state">loading…</div>';

  try {
    const [scheduleRes, teachers] = await Promise.all([
      apiFetch(`/api/get-teacher-availability?teacher_id=${teacherId}&days=14`),
      loadTeachers(),
      ensureBlockedPeriods().catch(() => {}),
    ]);
    if (!scheduleRes.ok) throw new Error();
    const data = await scheduleRes.json();

    const teacher = teachers.find((t) => t.id === teacherId);
    const authorised = teacher ? teacher.authorised : false;
    const bannerHtml = authorised
      ? '<p class="calendar-auth-note calendar-auth-note--ok">Calendar: authorised</p>'
      : `<p class="calendar-auth-note calendar-auth-note--error">Calendar: not authorised — <button class="action-btn" data-action="authoriseTeacher" data-args="${esc(teacherId)}">Authorise now</button></p>`;

    container.innerHTML = bannerHtml;
    renderSchedule(data, container);
  } catch {
    container.innerHTML = '<div class="loading-state">Could not load schedule.</div>';
  }
}

function renderSchedule(data, el) {
  const days = data.days || [];

  if (!days.length) {
    el.insertAdjacentHTML('beforeend', '<div class="empty-state">no upcoming sessions</div>');
    return;
  }

  // Split into weeks (rows of 7)
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  el.insertAdjacentHTML(
    'beforeend',
    weeks
      .map(
        (week) => `
    <div class="avail-week">
      ${week
        .map((day) => {
          const isToday = day.date === new Date().toISOString().slice(0, 10);
          const isWeekend = ['Sat', 'Sun'].includes(day.weekday);
          const isBlocked = isDateBlocked(day.date);
          return `
          <div class="avail-day${isToday ? ' today' : ''}${isWeekend ? ' weekend' : ''}${isBlocked ? ' blocked' : ''}">
            <div class="avail-day-header">
              <span class="avail-weekday">${day.weekday}</span>
              <span class="avail-date">${formatDayDate(day.date)}</span>
            </div>
            <div class="avail-slots">
              ${
                day.sessions.length
                  ? day.sessions
                      .map(
                        (s) => `
                    <div class="avail-slot ${s.status}">
                      <span class="avail-time">${formatTime(s.time)}</span>
                      <span class="avail-code">${esc(s.course_code)}</span>
                      <span class="avail-dur">${s.duration_minutes}m</span>
                    </div>
                  `
                      )
                      .join('')
                  : isBlocked
                    ? '<span class="avail-blocked-tag">blocked</span>'
                    : '<span class="avail-free">free</span>'
              }
            </div>
          </div>
        `;
        })
        .join('')}
    </div>
  `
      )
      .join('')
  );
}

function formatDayDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function formatTime(isoStr) {
  const d = new Date(isoStr);
  return d.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' });
}

/* ── Blocked dates ────────────────────────────────────────────────── */

function isDateBlocked(dateStr) {
  return (blockedPeriods || []).some((p) => dateStr >= p.start_date && dateStr <= p.end_date);
}

async function ensureBlockedPeriods(force = false) {
  if (blockedPeriods && !force) return blockedPeriods;
  const res = await apiFetch('/api/blocked-dates');
  if (!res.ok) throw new Error();
  blockedPeriods = await res.json();
  return blockedPeriods;
}

export async function loadBlockedDates(force = false) {
  const list = document.getElementById('blocked-dates-list');
  if (!list) return;
  try {
    renderBlockedDates(await ensureBlockedPeriods(force), list);
  } catch {
    list.innerHTML = '<div class="loading-state">Could not load blocked dates.</div>';
  }
}

function formatBlockedDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function renderBlockedDates(periods, el) {
  if (!periods.length) {
    el.innerHTML = '<div class="empty-state">no blocked dates</div>';
    return;
  }
  el.innerHTML = periods
    .map((p) => {
      const range =
        p.start_date === p.end_date
          ? formatBlockedDate(p.start_date)
          : `${formatBlockedDate(p.start_date)} – ${formatBlockedDate(p.end_date)}`;
      return `
      <div class="blocked-dates-row">
        <span class="blocked-dates-range">${range}</span>
        <span class="blocked-dates-label">${esc(p.label || '')}</span>
        <button class="delete-btn" data-action="deleteBlockedDate" data-args="${esc(p.id)}">remove</button>
      </div>`;
    })
    .join('');
}

function showBlockedDatesError(message) {
  const err = document.getElementById('blocked-dates-error');
  if (!err) return;
  err.textContent = message || '';
  err.classList.toggle('is-hidden', !message);
}

export async function addBlockedDate() {
  const start = document.getElementById('blocked-start').value;
  const end = document.getElementById('blocked-end').value;
  const label = document.getElementById('blocked-label').value.trim();
  if (!start) {
    showBlockedDatesError('Pick a start date.');
    return;
  }
  if (end && end < start) {
    showBlockedDatesError('End date cannot be before start date.');
    return;
  }
  showBlockedDatesError('');
  try {
    const res = await apiFetch('/api/blocked-dates', {
      method: 'POST',
      body: { start_date: start, end_date: end || start, label: label || null },
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showBlockedDatesError(data.error || 'Could not add blocked period.');
      return;
    }
    document.getElementById('blocked-start').value = '';
    document.getElementById('blocked-end').value = '';
    document.getElementById('blocked-label').value = '';
    await loadBlockedDates(true);
    onTeacherSelect();
  } catch {
    showBlockedDatesError('Could not add blocked period.');
  }
}

export async function deleteBlockedDate(id) {
  if (
    !confirm('Remove this blocked period? Newly synced courses may schedule sessions on it again.')
  )
    return;
  try {
    const res = await apiFetch('/api/blocked-dates', { method: 'DELETE', body: { id } });
    if (!res.ok) throw new Error();
    await loadBlockedDates(true);
    onTeacherSelect();
  } catch {
    showBlockedDatesError('Could not remove blocked period.');
  }
}
