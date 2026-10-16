/* ── Attendance modal ─────────────────────────────────────────────────
   Per-session attendance capture: who was there, whether they joined
   online, and whether they only attended half the lesson. Saving
   attendance is the one thing that marks a session completed, so the
   course list is reloaded afterwards to pick up the new status, the
   inline attendance line and the updated counters.                    */
import { apiFetch } from '../core/api.js';
import { esc, studentStartsBySession } from '../core/helpers.js';
import { MESSAGE_TIMEOUT_MS } from '../core/constants.js';
import { coursesCache, loadCourses, getCurrentCourseFilter } from './courses.js';

let attendanceStudents = [];
let optionListenerAttached = false;

// The online / half toggles only mean something for a student who was there,
// so they follow the present checkbox.
function syncRowOptions(row) {
  const present = row.querySelector('.att-present')?.checked ?? true;
  row.querySelectorAll('.att-opt').forEach((label) => {
    const input = label.querySelector('input');
    if (input) input.disabled = !present;
    label.classList.toggle('is-disabled', !present);
  });
}

function attachOptionListener() {
  if (optionListenerAttached) return;
  const container = document.getElementById('att-students');
  if (!container) return;
  container.addEventListener('change', (e) => {
    if (!e.target.matches('.att-present')) return;
    const row = e.target.closest('.att-row');
    if (row) syncRowOptions(row);
  });
  optionListenerAttached = true;
}

async function findCourse(courseId) {
  const cached = coursesCache.find((c) => c.id === courseId);
  if (cached) return cached;
  const res = await apiFetch('/api/get-courses?status=all');
  const courses = await res.json();
  return courses.find((c) => c.id === courseId);
}

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
  attachOptionListener();

  try {
    const course = await findCourse(courseId);
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
        const present = existing ? existing.present : true;
        const online = existing?.mode === 'online';
        const half = existing?.portion === 'half';

        return `
      <div class="att-row">
        <label>
          <input type="checkbox" class="att-present" data-student-id="${s.id}" ${present ? 'checked' : ''}>
          ${name}
        </label>
        <span class="att-opts">
          <label class="att-opt">
            <input type="checkbox" class="att-mode" ${online ? 'checked' : ''}> online
          </label>
          <label class="att-opt">
            <input type="checkbox" class="att-portion" ${half ? 'checked' : ''}> half
          </label>
        </span>
      </div>`;
      })
      .join('');
    container.querySelectorAll('.att-row').forEach(syncRowOptions);
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
  msgEl.classList.remove('is-visible-block');

  const records = [];
  document.querySelectorAll('#att-students .att-row').forEach((row) => {
    const presentBox = row.querySelector('.att-present');
    if (!presentBox) return;
    const present = presentBox.checked;
    records.push({
      student_id: presentBox.dataset.studentId,
      present,
      mode: present && row.querySelector('.att-mode')?.checked ? 'online' : 'in_person',
      portion: present && row.querySelector('.att-portion')?.checked ? 'half' : 'full',
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

    msgEl.textContent = `Saved attendance for ${result.saved_count} student(s). Session marked completed.`;
    msgEl.className = 'modal-msg success';
    btn.textContent = 'saved';

    await loadCourses(getCurrentCourseFilter());
    setTimeout(() => closeAttendanceModal(), MESSAGE_TIMEOUT_MS);
  } catch (err) {
    msgEl.textContent = 'Error: ' + err.message;
    msgEl.className = 'modal-msg err';
    msgEl.classList.add('is-visible-block');
    btn.textContent = 'save attendance';
    btn.disabled = false;
  }
}
