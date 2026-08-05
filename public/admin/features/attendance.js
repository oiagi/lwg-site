/* ── Attendance modal ─────────────────────────────────────────────────
   Per-session attendance capture. Saving attendance also marks the
   session completed, so the course row's session counter is updated via
   markSessionCompletedInList from courses.js.                          */
import { apiFetch } from '../core/api.js';
import { esc } from '../core/helpers.js';
import { MESSAGE_TIMEOUT_MS } from '../core/constants.js';
import { markSessionCompletedInList } from './courses.js';

let attendanceStudents = [];

function studentStartsBySession(student, session) {
  if (!student?.joined_at || !session?.scheduled_at) return true;
  const joined = new Date(student.joined_at + 'T00:00:00');
  const scheduled = new Date(session.scheduled_at);
  if (Number.isNaN(joined.getTime()) || Number.isNaN(scheduled.getTime())) return true;
  return scheduled >= joined;
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
