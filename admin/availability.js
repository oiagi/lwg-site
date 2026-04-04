/* ── Teacher availability tab ─────────────────────────────────────── */
import { apiFetch } from './api.js';
import { esc } from './helpers.js';
import { loadTeachers } from './teachers.js';

let availabilityTeachers = null;

export async function loadAvailability() {
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
  if (sel.value) {
    loadTeacherSchedule(sel.value);
  } else {
    container.innerHTML = '<div class="empty-state">select a teacher to view their schedule</div>';
  }
}

export function onTeacherSelect() {
  const teacherId = document.getElementById('avail-teacher').value;
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

  // Fetch schedule and teacher auth status in parallel.
  // loadTeachers() never throws — returns [] on error.
  let scheduleRes, teachers;
  try {
    [scheduleRes, teachers] = await Promise.all([
      apiFetch(`/api/get-teacher-availability?teacher_id=${teacherId}&days=14`),
      loadTeachers(),
    ]);
  } catch {
    container.innerHTML = '<div class="loading-state">Could not load schedule.</div>';
    return;
  }

  // Always render the auth banner, even if the schedule failed.
  const teacher = teachers.find((t) => t.id === teacherId);
  const authorised = teacher ? teacher.authorised : false;
  const bannerHtml = authorised
    ? '<p style="font-size:0.75rem;color:#27ae60;margin-bottom:0.8rem;">Calendar: authorised ✓</p>'
    : `<p style="font-size:0.75rem;color:#c0392b;margin-bottom:0.8rem;">Calendar: not authorised — <button class="action-btn" data-action="authoriseTeacher" data-args="${esc(teacherId)}">Authorise now</button></p>`;
  container.innerHTML = bannerHtml;

  if (!scheduleRes.ok) {
    container.insertAdjacentHTML(
      'beforeend',
      '<div class="loading-state">Could not load schedule.</div>'
    );
    return;
  }

  try {
    const data = await scheduleRes.json();
    renderSchedule(data, container);
  } catch {
    container.insertAdjacentHTML(
      'beforeend',
      '<div class="loading-state">Could not load schedule.</div>'
    );
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
          return `
          <div class="avail-day${isToday ? ' today' : ''}${isWeekend ? ' weekend' : ''}">
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
