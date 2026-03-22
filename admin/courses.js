/* ── Courses tab ──────────────────────────────────────────────────── */
import { apiFetch } from './api.js';
import { fmtDate } from './helpers.js';
import { loadTeachers } from './teachers.js';

let currentCourseFilter = 'active';
let participantCount = 1;
let attendanceStudents = [];

export function getCurrentCourseFilter() { return currentCourseFilter; }

export function filterCourses(status) {
  currentCourseFilter = status;
  document.querySelectorAll('[data-course-status]').forEach(b => {
    b.classList.toggle('active', b.dataset.courseStatus === status);
  });
  loadCourses(status);
}

export async function loadCourses(status = 'active') {
  const list = document.getElementById('course-list');

  const openIds = new Set(
    Array.from(document.querySelectorAll('.course-detail.open'))
      .map(el => el.id.replace('course-detail-', ''))
  );

  if (!list.querySelector('.course-row')) {
    list.innerHTML = '<div class="loading-state">loading…</div>';
  }

  try {
    const res = await apiFetch('/api/get-courses?status=' + status);
    if (!res.ok) throw new Error('Failed to load courses');
    const courses = await res.json();
    renderCourses(courses);

    openIds.forEach(id => {
      const detail = document.getElementById('course-detail-' + id);
      if (detail) detail.classList.add('open');
    });
  } catch (err) {
    list.innerHTML = '<div class="loading-state">Could not load courses.</div>';
  }
}

function renderCourses(courses) {
  const list = document.getElementById('course-list');
  if (!courses.length) {
    list.innerHTML = '<div class="loading-state" style="padding:2rem 0;">No courses found.</div>';
    return;
  }

  list.innerHTML = courses.map(c => {
    const names    = (c.participant_names || []).join(', ') || '—';
    const done     = c.sessions_completed || 0;
    const total    = c.sessions_total;
    const remaining = total ? total - done : null;
    const sessLine = total
      ? `${done} / ${total} sessions`
      : `${done} sessions completed`;

    const rebookFlag = total && remaining !== null && remaining <= 3
      ? `<span style="font-size:0.68rem;letter-spacing:0.08em;color:#e67e22;margin-left:0.5rem;">
           ⚠ ${remaining === 0 ? 'block complete' : remaining + ' session' + (remaining === 1 ? '' : 's') + ' left'}
         </span>`
      : '';

    const sessions = (c.sessions || []).filter(s => s.status !== 'cancelled').map(s => `
      <div class="session-row" id="sess-${s.id}">
        <div class="session-status-dot ${s.status}"></div>
        <div class="session-date">${fmtDate(s.scheduled_at)}</div>
        <div style="font-size:0.78rem;color:#888;text-transform:uppercase;letter-spacing:0.08em;">${s.status}</div>
        <button class="action-btn" data-action="openAttendanceModal" data-args="${s.id},${c.id},${fmtDate(s.scheduled_at)}">attendance</button>
        ${s.status === 'scheduled' ? `
          <button class="log-btn" data-action="logSession" data-args="${s.id},${c.id}">mark completed</button>
          <button class="cancel-btn" data-action="cancelSession" data-args="${s.id},${c.id}">cancel</button>
        ` : ''}
      </div>
    `).join('');

    const studentBlocks = (c.students || []).map(s => `
      <div style="margin-bottom:1rem;padding-bottom:1rem;border-bottom:1px solid #f0f0f0;">
        <p style="font-size:0.78rem;color:#1a1a1a;margin-bottom:0.3rem;">
          ${[s.first_name, s.last_name].filter(Boolean).join(' ') || '—'}
          ${s.current_level ? '<span style="color:#888;"> · ' + s.current_level + '</span>' : ''}
          ${s.access_token ? `<a href="/sessions.html?token=${s.access_token}" target="_blank"
            style="font-size:0.68rem;letter-spacing:0.1em;text-transform:uppercase;color:#aaa;
            text-decoration:none;margin-left:0.6rem;border-bottom:1px solid #ddd;">session page ↗</a>` : ''}
        </p>
        <textarea id="notes-${s.id}"
          style="width:100%;background:transparent;border:none;border-bottom:1px solid #ddd;
          font-family:inherit;font-size:0.82rem;font-weight:300;color:#555;outline:none;
          resize:none;height:50px;padding:0.2rem 0;margin-top:0.3rem;"
          placeholder="progress notes…">${s.progress_notes || ''}</textarea>
        <div style="margin-top:0.3rem;display:flex;gap:0.5rem;align-items:center;">
          <input id="level-${s.id}" type="text" value="${s.current_level || ''}"
            style="background:transparent;border:none;border-bottom:1px solid #ddd;
            font-family:inherit;font-size:0.75rem;color:#555;outline:none;width:60px;"
            placeholder="level" />
          <button class="save-btn" data-action="saveStudent" data-args="${s.id}">save</button>
          <span class="saved-msg" id="student-saved-${s.id}">saved</span>
        </div>
      </div>
    `).join('') || '<p style="font-size:0.78rem;color:#aaa;">No student records yet.</p>';

    const noSessions = !c.sessions?.length
      ? `<div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap;">
           <p style="font-size:0.78rem;color:#aaa;">No sessions synced yet.</p>
           <button class="save-btn" data-action="syncCalendar" data-args="${c.id}">sync calendar</button>
           <span class="saved-msg" id="sync-msg-${c.id}">synced</span>
         </div>`
      : `<div style="text-align:right;margin-bottom:0.4rem;display:flex;gap:0.5rem;justify-content:flex-end;align-items:center;">
           <button class="save-btn" style="font-size:0.65rem;" data-action="syncCalendar" data-args="${c.id}">↻ sync</button>
           <span class="saved-msg" id="sync-msg-${c.id}">synced</span>
         </div>`;

    return `
      <div class="course-row" id="course-${c.id}">
        <div class="course-summary" data-action="toggleCourse" data-args="${c.id}">
          <span class="course-code">${c.course_code || '—'}</span>
          <span class="course-participants">${names}</span>
          <span class="course-sessions">${sessLine}${rebookFlag}</span>
          <span class="course-status ${c.status}">${c.status}</span>
          <button class="delete-course-btn" data-action="deleteCourse" data-args="${c.id},${c.course_code}">delete</button>
        </div>
        <div class="course-detail" id="course-detail-${c.id}">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1.4rem;">
            <div>
              <p style="font-size:0.68rem;letter-spacing:0.14em;text-transform:uppercase;color:#aaa;margin-bottom:0.4rem;">details</p>
              <p style="font-size:0.82rem;color:#555;line-height:1.8;">
                Service: ${c.service || '—'}<br>
                Level: ${c.level || '—'}<br>
                Group: ${c.group_type || '—'}<br>
                Block: ${total ? total + ' sessions' : 'open-ended'}
              </p>
            </div>
            <div>
              <p style="font-size:0.68rem;letter-spacing:0.14em;text-transform:uppercase;color:#aaa;margin-bottom:0.4rem;">contact</p>
              ${(c.participants || []).map(p => `
                <p style="font-size:0.82rem;color:#555;line-height:1.8;">
                  ${[p.firstName, p.lastName].filter(Boolean).join(' ')}
                  ${p.email ? '<br><span style="color:#aaa;">' + p.email + '</span>' : ''}
                  ${p.phone ? '<br><span style="color:#aaa;">' + p.phone + '</span>' : ''}
                </p>
              `).join('') || '<p style="font-size:0.82rem;color:#aaa;">—</p>'}
            </div>
          </div>
          <p style="font-size:0.68rem;letter-spacing:0.14em;text-transform:uppercase;color:#aaa;margin-bottom:0.8rem;">students & progress</p>
          ${studentBlocks}
          <p style="font-size:0.68rem;letter-spacing:0.14em;text-transform:uppercase;color:#aaa;margin:1rem 0 0.6rem;">sessions</p>
          ${noSessions}
          ${sessions}
        </div>
      </div>`;
  }).join('');
}

export function toggleCourse(id) {
  document.getElementById('course-detail-' + id).classList.toggle('open');
}

export async function syncCalendar(courseId) {
  const msg = document.getElementById('sync-msg-' + courseId);
  try {
    const res = await apiFetch('/api/sync-calendar', {
      method: 'POST',
      body: { course_id: courseId },
    });
    if (res.ok) {
      if (msg) { msg.style.display = 'inline'; setTimeout(() => msg.style.display = 'none', 2000); }
      loadCourses(currentCourseFilter);
    }
  } catch (err) { console.error('Sync error:', err); }
}

export async function cancelSession(sessionId, courseId) {
  if (!confirm('Cancel this session? The Google Calendar event and invite will be removed.')) return;
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
          const total   = parseInt(match[2]);
          const newDone = parseInt(match[1]);
          countEl.firstChild.textContent = newDone + ' / ' + (total - 1) + ' sessions';
        }
      }
    }
  } catch {
    alert('Could not cancel session. Please try again.');
  }
}

export async function saveStudent(studentId) {
  const notes = document.getElementById('notes-'  + studentId)?.value || '';
  const level = document.getElementById('level-'  + studentId)?.value || '';
  try {
    const res = await apiFetch('/api/update-student', {
      method: 'PATCH',
      body: { student_id: studentId, progress_notes: notes, current_level: level },
    });
    if (res.ok) {
      const msg = document.getElementById('student-saved-' + studentId);
      if (msg) { msg.style.display = 'inline'; setTimeout(() => msg.style.display = 'none', 2000); }
    }
  } catch (err) { console.error('Save student error:', err); }
}

export async function logSession(sessionId, courseId) {
  const notes = prompt('Add a note for this session (optional):') || '';
  try {
    const res = await apiFetch('/api/log-session', {
      method: 'PATCH',
      body: { session_id: sessionId, notes },
    });
    if (!res.ok) throw new Error();
    const row = document.getElementById('sess-' + sessionId);
    if (row) {
      row.querySelector('.session-status-dot').className = 'session-status-dot completed';
      row.querySelector('[style*=uppercase]').textContent = 'completed';
      const btn = row.querySelector('.log-btn');
      if (btn) btn.remove();
    }
    const courseRow = document.getElementById('course-' + courseId);
    if (courseRow) {
      const countEl = courseRow.querySelector('.course-sessions');
      if (countEl) {
        const match = countEl.textContent.match(/(\d+) \/ (\d+)/);
        if (match) {
          const newDone = parseInt(match[1]) + 1;
          const total   = parseInt(match[2]);
          countEl.firstChild.textContent = newDone + ' / ' + total + ' sessions';
        }
      }
    }
  } catch {
    alert('Could not log session. Please try again.');
  }
}

/* ── New course modal ───────────────────────────────────────────── */
export function openNewCourseModal() {
  ['nc-teacher','nc-service','nc-level','nc-group','nc-sessions','nc-datetime'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = el.tagName === 'SELECT' ? el.options[0]?.value : '';
  });
  participantCount = 1;
  const container = document.getElementById('nc-participants');
  container.innerHTML = `
    <div class="participant-block" id="nc-p-0">
      <div class="modal-field"><label>First name</label><input type="text" id="nc-p0-first" placeholder="First name"></div>
      <div class="modal-field"><label>Last name</label><input type="text" id="nc-p0-last" placeholder="Last name"></div>
      <div class="modal-field"><label>Email</label><input type="email" id="nc-p0-email" placeholder="email@example.com"></div>
      <div class="modal-field"><label>Phone</label><input type="tel" id="nc-p0-phone" placeholder="+41…"></div>
    </div>`;
  const sel = document.getElementById('nc-teacher');
  loadTeachers().then(teachers => {
    sel.innerHTML = teachers.map(t =>
      `<option value="${t.id}"${!t.authorised ? ' disabled' : ''}>${t.name}${!t.authorised ? ' (not authorised)' : ''}</option>`
    ).join('');
  });
  const msgEl = document.getElementById('nc-msg');
  if (msgEl) { msgEl.style.display = 'none'; msgEl.textContent = ''; }
  const btn = document.getElementById('nc-submit');
  if (btn) { btn.textContent = 'create course & calendar event'; btn.disabled = false; }
  document.getElementById('new-course-modal').classList.add('open');
}

export function closeNewCourseModal() {
  document.getElementById('new-course-modal').classList.remove('open');
}

export function removeParticipantBlock(el) {
  const block = el.closest('.participant-block');
  if (block) block.remove();
}

export function addParticipantBlock() {
  const container = document.getElementById('nc-participants');
  const i = participantCount++;
  const block = document.createElement('div');
  block.className = 'participant-block modal-grid';
  block.id = `nc-p-${i}`;
  block.style.cssText = 'margin-top:1rem;padding-top:1rem;border-top:1px solid #eee;';
  block.innerHTML = `
    <div class="full" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.6rem;">
      <span style="font-size:0.68rem;letter-spacing:0.14em;text-transform:uppercase;color:#aaa;">Participant ${i + 1}</span>
      <button data-action="removeParticipantBlock" style="background:none;border:none;cursor:pointer;font-size:0.75rem;color:#c0392b;">remove</button>
    </div>
    <div class="modal-field"><label>First name</label><input type="text" id="nc-p${i}-first" placeholder="First name"></div>
    <div class="modal-field"><label>Last name</label><input type="text" id="nc-p${i}-last" placeholder="Last name"></div>
    <div class="modal-field"><label>Email</label><input type="email" id="nc-p${i}-email" placeholder="email@example.com"></div>
    <div class="modal-field"><label>Phone</label><input type="tel" id="nc-p${i}-phone" placeholder="+41…"></div>`;
  container.appendChild(block);
}

export async function submitNewCourse() {
  const btn   = document.getElementById('nc-submit');
  const msgEl = document.getElementById('nc-msg');
  msgEl.style.display = 'none';

  const teacherId  = document.getElementById('nc-teacher').value;
  const service    = document.getElementById('nc-service').value;
  const level      = document.getElementById('nc-level').value;
  const groupType  = document.getElementById('nc-group').value;
  const sessions   = document.getElementById('nc-sessions').value;
  const datetime   = document.getElementById('nc-datetime').value;

  if (!teacherId || !datetime) {
    msgEl.textContent   = 'Please select a teacher and set a first session date.';
    msgEl.className     = 'modal-msg err';
    msgEl.style.display = 'block';
    return;
  }

  const participants = [];
  document.querySelectorAll('#nc-participants .participant-block').forEach((block) => {
    const idx = block.id.replace('nc-p-', '');
    const first = document.getElementById(`nc-p${idx}-first`)?.value?.trim();
    const last  = document.getElementById(`nc-p${idx}-last`)?.value?.trim();
    const email = document.getElementById(`nc-p${idx}-email`)?.value?.trim();
    const phone = document.getElementById(`nc-p${idx}-phone`)?.value?.trim();
    if (first || last || email) {
      participants.push({ firstName: first||'', lastName: last||'', email: email||'', phone: phone||'' });
    }
  });

  btn.textContent = 'creating…';
  btn.disabled    = true;

  try {
    const res = await apiFetch('/api/confirm-booking', {
      method: 'POST',
      body: {
        teacher_id:       teacherId,
        sessions_total:   sessions ? parseInt(sessions) : null,
        first_session_at: new Date(datetime).toISOString(),
        duration_minutes: 50,
        booking_data: { service, level, group: groupType },
        contact_data: { participants },
      },
    });

    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Unknown error');

    msgEl.textContent   = `Created. Course: ${result.course_code}`;
    msgEl.className     = 'modal-msg';
    msgEl.style.cssText = 'display:block;color:#27ae60;font-size:0.75rem;margin-top:0.8rem;';
    btn.textContent     = 'created ✓';

    setTimeout(() => {
      closeNewCourseModal();
      loadCourses(currentCourseFilter);
    }, 1500);

  } catch (err) {
    msgEl.textContent   = 'Error: ' + err.message;
    msgEl.className     = 'modal-msg err';
    msgEl.style.display = 'block';
    btn.textContent     = 'create course & calendar event';
    btn.disabled        = false;
  }
}

export async function deleteCourse(courseId, courseCode) {
  if (!confirm(`Delete course ${courseCode || courseId}?\n\nThis will cancel all upcoming calendar events and remove the course and all its sessions permanently.`)) return;
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

/* ── Attendance modal ───────────────────────────────────────────── */
export async function openAttendanceModal(sessionId, courseId, dateLabel) {
  document.getElementById('att-session-id').value = sessionId;
  document.getElementById('att-course-id').value = courseId;
  document.getElementById('att-title').textContent = 'attendance — ' + (dateLabel || '');
  const container = document.getElementById('att-students');
  container.innerHTML = '<p class="loading-state" style="padding:1rem 0;">loading students…</p>';
  const msg = document.getElementById('att-msg');
  msg.style.display = 'none'; msg.textContent = '';
  const btn = document.getElementById('att-submit');
  btn.textContent = 'save attendance'; btn.disabled = false;
  document.getElementById('attendance-modal').classList.add('open');

  try {
    const coursesRes = await apiFetch('/api/get-courses?status=all');
    const courses = await coursesRes.json();
    const course = courses.find(c => c.id === courseId);
    attendanceStudents = course?.students || [];

    let existingAttendance = [];
    try {
      const attRes = await apiFetch('/api/get-attendance?session_id=' + sessionId);
      if (attRes.ok) existingAttendance = await attRes.json();
    } catch { /* ok, no existing attendance */ }

    const attMap = {};
    existingAttendance.forEach(a => { attMap[a.student_id] = a; });

    if (!attendanceStudents.length) {
      container.innerHTML = '<p style="font-size:0.78rem;color:#aaa;padding:1rem 0;">No students enrolled in this course.</p>';
      return;
    }

    container.innerHTML = attendanceStudents.map(s => {
      const name    = [s.first_name, s.last_name].filter(Boolean).join(' ') || s.email || '—';
      const existing = attMap[s.id];
      const checked  = existing ? existing.present : true;
      const statusLabel = existing
        ? (existing.present ? '<span class="att-status present">present</span>' : '<span class="att-status absent">absent</span>')
        : '';

      return `
      <div class="att-row">
        <label>
          <input type="checkbox" data-student-id="${s.id}" ${checked ? 'checked' : ''}>
          ${name}
        </label>
        ${statusLabel}
      </div>`;
    }).join('');
  } catch (err) {
    container.innerHTML = '<p style="font-size:0.78rem;color:#c0392b;">Could not load students.</p>';
  }
}

export function closeAttendanceModal() {
  document.getElementById('attendance-modal').classList.remove('open');
}

export async function submitAttendance() {
  const btn       = document.getElementById('att-submit');
  const msgEl     = document.getElementById('att-msg');
  const sessionId = document.getElementById('att-session-id').value;
  msgEl.style.display = 'none';

  const records = [];
  document.querySelectorAll('#att-students input[type="checkbox"]').forEach(cb => {
    records.push({
      student_id: cb.dataset.studentId,
      present:    cb.checked,
    });
  });

  if (!records.length) {
    msgEl.textContent = 'No students to record attendance for.';
    msgEl.className = 'modal-msg err'; msgEl.style.display = 'block';
    return;
  }

  btn.textContent = 'saving…'; btn.disabled = true;

  try {
    const res = await apiFetch('/api/save-attendance', {
      method: 'POST',
      body: { session_id: sessionId, records },
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Unknown error');

    msgEl.textContent = `Saved attendance for ${result.saved_count} student(s).`;
    msgEl.className = 'modal-msg';
    msgEl.style.cssText = 'display:block;color:#27ae60;font-size:0.75rem;margin-top:0.8rem;';
    btn.textContent = 'saved ✓';

    setTimeout(() => closeAttendanceModal(), 1200);
  } catch (err) {
    msgEl.textContent = 'Error: ' + err.message;
    msgEl.className = 'modal-msg err'; msgEl.style.display = 'block';
    btn.textContent = 'save attendance'; btn.disabled = false;
  }
}
