/* ── Teacher availability tab ─────────────────────────────────────── */
import { apiFetch } from './api.js';
import { authoriseTeacher, clearTeachersCache, loadTeachers } from './teachers.js';

export async function loadAvailability() {
  const container = document.getElementById('availability-content');
  const sel = document.getElementById('avail-teacher');
  const prev = sel.value;

  // Always reload teacher list so auth status stays current
  try {
    const teachers = await loadTeachers();
    sel.innerHTML = '<option value="">select teacher…</option>' +
      teachers.map(t => {
        const suffix = t.authorised ? '' : ' (not authorised)';
        return `<option value="${t.id}">${t.name}${suffix}</option>`;
      }).join('');
    // Restore previous selection if still valid
    if (prev && teachers.some(t => t.id === prev)) sel.value = prev;
  } catch {
    sel.innerHTML = '<option value="">could not load teachers</option>';
  }

  // If a teacher is already selected, reload their schedule
  if (sel.value) {
    updateAuthStatus(sel.value);
    loadTeacherSchedule(sel.value);
  } else {
    updateAuthStatus(null);
    container.innerHTML = '<div class="empty-state">select a teacher to view their schedule</div>';
  }
}

export function onTeacherSelect() {
  const teacherId = document.getElementById('avail-teacher').value;
  updateAuthStatus(teacherId || null);
  if (teacherId) {
    loadTeacherSchedule(teacherId);
  } else {
    document.getElementById('availability-content').innerHTML =
      '<div class="empty-state">select a teacher to view their schedule</div>';
  }
}

async function updateAuthStatus(teacherId) {
  const statusEl = document.getElementById('avail-auth-status');
  const btn = document.getElementById('avail-auth-btn');
  if (!teacherId) {
    statusEl.textContent = '';
    btn.style.display = 'none';
    return;
  }
  const teachers = await loadTeachers();
  const teacher = teachers.find(t => t.id === teacherId);
  if (!teacher) {
    statusEl.textContent = '';
    btn.style.display = 'none';
    return;
  }
  if (teacher.authorised) {
    statusEl.textContent = 'calendar connected';
    statusEl.style.color = '#27ae60';
    btn.textContent = 're-authorise calendar';
    btn.style.display = '';
  } else {
    statusEl.textContent = 'not authorised';
    statusEl.style.color = '#c0392b';
    btn.textContent = 'authorise calendar';
    btn.style.display = '';
  }
}

export async function authoriseSelectedTeacher() {
  const teacherId = document.getElementById('avail-teacher').value;
  if (!teacherId) return;

  authoriseTeacher(teacherId);

  // authoriseTeacher opens a popup and clears the teacher cache on close.
  // Poll until re-auth completes so we can refresh the UI.
  const poll = setInterval(async () => {
    clearTeachersCache();
    const teachers = await loadTeachers();
    const teacher = teachers.find(t => t.id === teacherId);
    if (teacher && teacher.authorised) {
      clearInterval(poll);
      updateAuthStatus(teacherId);
    }
  }, 2000);
  setTimeout(() => clearInterval(poll), 120000);
}

async function loadTeacherSchedule(teacherId) {
  const container = document.getElementById('availability-content');
  container.innerHTML = '<div class="loading-state">loading…</div>';

  try {
    const res = await apiFetch(`/api/get-teacher-availability?teacher_id=${teacherId}&days=14`);
    if (!res.ok) throw new Error();
    const data = await res.json();
    renderSchedule(data, container);
  } catch {
    container.innerHTML = '<div class="loading-state">Could not load schedule.</div>';
  }
}

function renderSchedule(data, el) {
  const days = data.days || [];

  if (!days.length) {
    el.innerHTML = '<div class="empty-state">no upcoming sessions</div>';
    return;
  }

  // Split into weeks (rows of 7)
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  el.innerHTML = weeks.map(week => `
    <div class="avail-week">
      ${week.map(day => {
        const isToday = day.date === new Date().toISOString().slice(0, 10);
        const isWeekend = ['Sat', 'Sun'].includes(day.weekday);
        return `
          <div class="avail-day${isToday ? ' today' : ''}${isWeekend ? ' weekend' : ''}">
            <div class="avail-day-header">
              <span class="avail-weekday">${day.weekday}</span>
              <span class="avail-date">${formatDayDate(day.date)}</span>
            </div>
            <div class="avail-slots">
              ${day.sessions.length
                ? day.sessions.map(s => `
                    <div class="avail-slot ${s.status}">
                      <span class="avail-time">${formatTime(s.time)}</span>
                      <span class="avail-code">${s.course_code}</span>
                      <span class="avail-dur">${s.duration_minutes}m</span>
                    </div>
                  `).join('')
                : '<span class="avail-free">free</span>'
              }
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `).join('');
}

function formatDayDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function formatTime(isoStr) {
  const d = new Date(isoStr);
  return d.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' });
}
