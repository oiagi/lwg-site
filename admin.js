/* ── Admin password ──────────────────────────────────────────────── */
let adminPassword = '';
let currentFilter = 'all';

document.getElementById('admin-pwd').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('login-btn').click();
});

document.getElementById('login-btn').addEventListener('click', async () => {
  const pwd = document.getElementById('admin-pwd').value;
  if (!pwd) return;
  // Quick probe: try to load enquiries with this password
  const ok = await loadEnquiries(pwd, 'all', true);
  if (ok) {
    adminPassword = pwd;
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('dashboard').style.display    = 'block';
    /* Now load and render enquiries properly */
    loadEnquiries(adminPassword, 'all');
  } else {
    document.getElementById('pwd-error').style.display = 'block';
  }
});

/* ── Filter buttons ─────────────────────────────────────────────── */
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.status;
    loadEnquiries(adminPassword, currentFilter);
  });
});

/* ── Load enquiries ─────────────────────────────────────────────── */
async function loadEnquiries(pwd, status, probe = false) {
  const qs = status && status !== 'all' ? `?status=${status}` : '';
  try {
    const res = await fetch(`/api/get-enquiries${qs}`, {
      headers: { 'x-admin-password': pwd }
    });
    if (res.status === 401) return false;
    if (!res.ok) return false;
    const data = await res.json();
    if (!probe) renderEnquiries(data);
    return true;
  } catch {
    return false;
  }
}

/* ── Render enquiries ───────────────────────────────────────────── */
function fmt(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'2-digit' });
}

function dl(key, val) {
  if (!val) return '';
  const v = Array.isArray(val) ? val.join(', ') : val;
  return `<div class="detail-row"><span class="detail-key">${key}</span><span class="detail-val">${v}</span></div>`;
}

function renderBookingDetails(b) {
  if (!b) return '';
  const rows = [];
  const labelMap = {
    language:'Language', background:'Background', level:'Level',
    exam:'Exam', examDate:'Exam date', frequency:'Frequency',
    format:'Format', location:'Location', group:'Group size',
    grades:'School year', subjects:'Subjects',
  };
  for (const [k, lbl] of Object.entries(labelMap)) {
    const v = b[k];
    if (v) rows.push(dl(lbl, v));
  }
  return rows.join('');
}

function renderContactDetails(c) {
  if (!c) return '';
  const lead = c.lead || {};
  let html = `
    ${dl('Name',    [lead.firstName, lead.lastName].filter(Boolean).join(' '))}
    ${dl('Email',   lead.email)}
    ${dl('Phone',   lead.phone)}
    ${dl('Postcode',lead.postcode)}
    ${dl('For',     c.ageGroup + (c.ageRange ? ' (' + c.ageRange + ')' : ''))}
    ${dl('Days',    c.days)}
    ${dl('Time',    c.timeOfDay)}
    ${dl('Notes',   c.notes)}`;

  if (c.participants && c.participants.length > 0) {
    html += `<div style="margin-top:0.6rem;font-size:0.68rem;letter-spacing:0.14em;text-transform:uppercase;color:#aaa;">Participants</div>`;
    c.participants.forEach((p, i) => {
      const name = [p.firstName, p.lastName].filter(Boolean).join(' ');
      html += `<div style="margin-top:0.4rem;font-size:0.72rem;color:#555;">
        ${i+1}. ${name || '—'}${p.email ? ' — ' + p.email : ''}${p.phone ? ' · ' + p.phone : ''}
      </div>`;
    });
  }
  return html;
}

function renderEnquiries(rows) {
  const list = document.getElementById('enquiry-list');
  if (!rows || rows.length === 0) {
    list.innerHTML = '<div class="empty-state">no enquiries found</div>';
    return;
  }

  list.innerHTML = rows.map(row => {
    const status = row.status || 'new';
    const name   = [row.lead_first, row.lead_last].filter(Boolean).join(' ') || '—';
    const svc    = row.service || '—';
    const b      = row.booking_data || {};
    const c      = row.contact_data || {};

    return `
    <div class="enquiry-row" id="row-${row.id}">
      <div class="enquiry-summary" onclick="toggleDetail('${row.id}')">
        <span class="dot ${status}"></span>
        <div>
          <div class="enq-name">${name}</div>
          <div class="enq-svc">${svc}</div>
        </div>
        <div class="enq-date">${fmt(row.created_at)}</div>
        <div class="enq-status ${status}">${status}</div>
      </div>
      <div class="enquiry-detail" id="detail-${row.id}">
        <div class="detail-section">
          <div class="detail-label">booking</div>
          ${renderBookingDetails(b)}
        </div>
        <div class="detail-section">
          <div class="detail-label">contact</div>
          ${renderContactDetails(c)}
          <div class="detail-actions">
            <select class="status-select" id="status-${row.id}">
              <option value="new"       ${status==='new'       ?'selected':''}>new</option>
              <option value="contacted" ${status==='contacted' ?'selected':''}>contacted</option>
              <option value="confirmed" ${status==='confirmed' ?'selected':''}>confirmed</option>
              <option value="cancelled" ${status==='cancelled' ?'selected':''}>cancelled</option>
            </select>
            <button class="save-btn" onclick="saveStatus('${row.id}')">save</button>
            <span class="saved-msg" id="saved-${row.id}">saved</span>
            <button class="delete-btn" onclick="deleteEnquiry('${row.id}')">delete</button>
          </div>
          <textarea class="notes-input" id="notes-${row.id}"
            placeholder="internal notes…">${row.notes || ''}</textarea>
          <div style="margin-top:0.4rem;">
            <button class="save-btn" onclick="saveNotes('${row.id}')">save notes</button>
            <span class="saved-msg" id="notes-saved-${row.id}">saved</span>
          </div>

          ${status !== 'confirmed' && status !== 'cancelled' ? `
          <div class="confirm-panel" id="confirm-panel-${row.id}">
            <p class="confirm-panel-title">confirm &amp; schedule</p>

            <div class="confirm-field">
              <label>Assign teacher</label>
              <select id="confirm-teacher-${row.id}">
                <option value="">loading teachers…</option>
              </select>
            </div>

            <div class="confirm-field">
              <label>First session date &amp; time</label>
              <input type="datetime-local" id="confirm-datetime-${row.id}" />
            </div>

            <div class="confirm-field">
              <label>Sessions in block <span style="font-size:0.65rem;color:#aaa;text-transform:none;">(leave blank for open-ended)</span></label>
              <input type="number" id="confirm-sessions-${row.id}" min="1" placeholder="e.g. 20" />
            </div>

            <button class="confirm-btn" onclick="confirmBooking('${row.id}')">confirm booking &amp; create calendar event</button>
            <p class="confirm-msg" id="confirm-msg-${row.id}"></p>
          </div>
          ` : ''}
        </div>
      </div>
    </div>`;
  }).join('');
  /* Populate teacher selects now that DOM is updated */
  populateTeacherSelects();
}

/* ── Toggle detail ──────────────────────────────────────────────── */
function toggleDetail(id) {
  const el = document.getElementById(`detail-${id}`);
  el.classList.toggle('open');
}

/* ── Save status ────────────────────────────────────────────────── */
async function saveStatus(id) {
  const status = document.getElementById(`status-${id}`).value;
  try {
    const res = await fetch('/api/update-enquiry', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-password': adminPassword,
      },
      body: JSON.stringify({ id, status }),
    });
    if (res.ok) {
      const msg = document.getElementById(`saved-${id}`);
      msg.style.display = 'inline';
      setTimeout(() => msg.style.display = 'none', 2000);
      // Update dot colour
      const dot = document.querySelector(`#row-${id} .dot`);
      if (dot) { dot.className = `dot ${status}`; }
      const statusEl = document.querySelector(`#row-${id} .enq-status`);
      if (statusEl) { statusEl.className = `enq-status ${status}`; statusEl.textContent = status; }
    }
  } catch (e) { console.error(e); }
}

/* ── Save notes ─────────────────────────────────────────────────── */
async function saveNotes(id) {
  const notes = document.getElementById(`notes-${id}`).value;
  try {
    const res = await fetch('/api/update-enquiry', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-password': adminPassword,
      },
      body: JSON.stringify({ id, notes }),
    });
    if (res.ok) {
      const msg = document.getElementById(`notes-saved-${id}`);
      msg.style.display = 'inline';
      setTimeout(() => msg.style.display = 'none', 2000);
    }
  } catch (e) { console.error(e); }
}

/* ── Main tab switching ─────────────────────────────────────────── */
let currentTab = 'enquiries';

function switchTab(tab) {
  currentTab = tab;
  document.getElementById('panel-enquiries').style.display = tab === 'enquiries' ? 'block' : 'none';
  document.getElementById('panel-courses').style.display   = tab === 'courses'   ? 'block' : 'none';
  document.getElementById('panel-companies').style.display  = tab === 'companies' ? 'block' : 'none';
  document.getElementById('panel-billing').style.display    = tab === 'billing'   ? 'block' : 'none';
  document.getElementById('tab-enquiries').classList.toggle('active', tab === 'enquiries');
  document.getElementById('tab-courses').classList.toggle('active',   tab === 'courses');
  document.getElementById('tab-companies').classList.toggle('active',  tab === 'companies');
  document.getElementById('tab-billing').classList.toggle('active',    tab === 'billing');
  if (tab === 'courses') loadCourses(currentCourseFilter);
  if (tab === 'companies') loadCompanies(currentCompanyFilter);
  if (tab === 'billing') loadInvoices(currentInvoiceFilter);
}

/* ── Courses ─────────────────────────────────────────────────────── */
let currentCourseFilter = 'active';

function filterCourses(status) {
  currentCourseFilter = status;
  document.querySelectorAll('[data-course-status]').forEach(b => {
    b.classList.toggle('active', b.dataset.courseStatus === status);
  });
  loadCourses(status);
}

async function loadCourses(status = 'active') {
  const list = document.getElementById('course-list');

  /* Remember which courses are currently open so we can restore them */
  const openIds = new Set(
    Array.from(document.querySelectorAll('.course-detail.open'))
      .map(el => el.id.replace('course-detail-', ''))
  );

  /* Only show loading spinner on first load (list is empty) */
  if (!list.querySelector('.course-row')) {
    list.innerHTML = '<div class="loading-state">loading…</div>';
  }

  try {
    const res = await fetch('/api/get-courses?status=' + status, {
      headers: { 'x-admin-password': adminPassword },
    });
    if (!res.ok) throw new Error('Failed to load courses');
    const courses = await res.json();
    renderCourses(courses);

    /* Re-open any courses that were open before the reload */
    openIds.forEach(id => {
      const detail = document.getElementById('course-detail-' + id);
      if (detail) detail.classList.add('open');
    });
  } catch (err) {
    list.innerHTML = '<div class="loading-state">Could not load courses.</div>';
  }
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('de-CH', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
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

    /* Rebooking flag — show when 3 or fewer sessions remain */
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
        <button class="action-btn" onclick="event.stopPropagation();openAttendanceModal('${s.id}','${c.id}','${fmtDate(s.scheduled_at)}')">attendance</button>
        ${s.status === 'scheduled' ? `
          <button class="log-btn" onclick="logSession('${s.id}', '${c.id}')">mark completed</button>
          <button class="cancel-btn" onclick="cancelSession('${s.id}', '${c.id}')">cancel</button>
        ` : ''}
      </div>
    `).join('');

    /* Student records with progress notes and session page link */
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
          <button class="save-btn" onclick="saveStudent('${s.id}')">save</button>
          <span class="saved-msg" id="student-saved-${s.id}">saved</span>
        </div>
      </div>
    `).join('') || '<p style="font-size:0.78rem;color:#aaa;">No student records yet.</p>';

    const noSessions = !c.sessions?.length
      ? `<div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap;">
           <p style="font-size:0.78rem;color:#aaa;">No sessions synced yet.</p>
           <button class="save-btn" onclick="syncCalendar('${c.id}')">sync calendar</button>
           <span class="saved-msg" id="sync-msg-${c.id}">synced</span>
           <button class="action-btn" onclick="openRecurringModal('${c.id}')">+ recurring sessions</button>
         </div>`
      : `<div style="text-align:right;margin-bottom:0.4rem;display:flex;gap:0.5rem;justify-content:flex-end;align-items:center;">
           <button class="action-btn" onclick="openRecurringModal('${c.id}')">+ recurring</button>
           <button class="save-btn" style="font-size:0.65rem;" onclick="syncCalendar('${c.id}')">↻ sync</button>
           <span class="saved-msg" id="sync-msg-${c.id}">synced</span>
         </div>`;

    return `
      <div class="course-row" id="course-${c.id}">
        <div class="course-summary" onclick="toggleCourse('${c.id}')">
          <span class="course-code">${c.course_code || '—'}</span>
          <span class="course-participants">${names}</span>
          <span class="course-sessions">${sessLine}${rebookFlag}</span>
          <span class="course-status ${c.status}">${c.status}</span>
          <button class="delete-course-btn" onclick="event.stopPropagation();deleteCourse('${c.id}','${c.course_code}')">delete</button>
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

function toggleCourse(id) {
  /* Simply toggle open/close — no reload triggered */
  document.getElementById('course-detail-' + id).classList.toggle('open');
}

/* ── On-demand calendar sync ─────────────────────────────────────── */
/* Only called when the user explicitly clicks the sync button.
   Does NOT reload the full list — updates only the affected course
   row so the open/closed state is preserved.                       */
async function syncCalendar(courseId) {
  const msg = document.getElementById('sync-msg-' + courseId);
  try {
    const res = await fetch('/api/sync-calendar', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': adminPassword },
      body:    JSON.stringify({ course_id: courseId }),
    });
    if (res.ok) {
      if (msg) { msg.style.display = 'inline'; setTimeout(() => msg.style.display = 'none', 2000); }
      /* Reload full list after sync — user clicked explicitly so flash is acceptable */
      loadCourses(currentCourseFilter);
    }
  } catch (err) { console.error('Sync error:', err); }
}

/* ── Cancel session & Google Calendar event ─────────────────────── */
async function cancelSession(sessionId, courseId) {
  if (!confirm('Cancel this session? The Google Calendar event and invite will be removed.')) return;
  try {
    const res = await fetch('/api/cancel-session', {
      method:  'DELETE',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': adminPassword },
      body:    JSON.stringify({ session_id: sessionId }),
    });
    if (!res.ok) throw new Error();
    /* Remove the session row from the DOM */
    const row = document.getElementById('sess-' + sessionId);
    if (row) row.remove();
    /* Update the session count label */
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

/* ── Save student progress notes and level ───────────────────────── */
async function saveStudent(studentId) {
  const notes = document.getElementById('notes-'  + studentId)?.value || '';
  const level = document.getElementById('level-'  + studentId)?.value || '';
  try {
    const res = await fetch('/api/update-student', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': adminPassword },
      body:    JSON.stringify({ student_id: studentId, progress_notes: notes, current_level: level }),
    });
    if (res.ok) {
      const msg = document.getElementById('student-saved-' + studentId);
      if (msg) { msg.style.display = 'inline'; setTimeout(() => msg.style.display = 'none', 2000); }
    }
  } catch (err) { console.error('Save student error:', err); }
}

async function logSession(sessionId, courseId) {
  const notes = prompt('Add a note for this session (optional):') || '';
  try {
    const res = await fetch('/api/log-session', {
      method:  'PATCH',
      headers: {
        'Content-Type':     'application/json',
        'x-admin-password': adminPassword,
      },
      body: JSON.stringify({ session_id: sessionId, notes }),
    });
    if (!res.ok) throw new Error();
    /* Update the session row in place rather than reloading the full list,
       so the course stays open */
    const row = document.getElementById('sess-' + sessionId);
    if (row) {
      row.querySelector('.session-status-dot').className = 'session-status-dot completed';
      row.querySelector('[style*=uppercase]').textContent = 'completed';
      const btn = row.querySelector('.log-btn');
      if (btn) btn.remove();
    }
    /* Update the session count label */
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
let participantCount = 1;

function openNewCourseModal() {
  /* Reset form */
  ['nc-teacher','nc-service','nc-level','nc-group','nc-sessions','nc-datetime'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = el.tagName === 'SELECT' ? el.options[0]?.value : '';
  });
  /* Reset participants to just one block */
  participantCount = 1;
  const container = document.getElementById('nc-participants');
  container.innerHTML = `
    <div class="participant-block" id="nc-p-0">
      <div class="modal-field"><label>First name</label><input type="text" id="nc-p0-first" placeholder="First name"></div>
      <div class="modal-field"><label>Last name</label><input type="text" id="nc-p0-last" placeholder="Last name"></div>
      <div class="modal-field"><label>Email</label><input type="email" id="nc-p0-email" placeholder="email@example.com"></div>
      <div class="modal-field"><label>Phone</label><input type="tel" id="nc-p0-phone" placeholder="+41…"></div>
    </div>`;
  /* Populate teacher select */
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

function closeNewCourseModal() {
  document.getElementById('new-course-modal').classList.remove('open');
}

function addParticipantBlock() {
  const container = document.getElementById('nc-participants');
  const i = participantCount++;
  const block = document.createElement('div');
  block.className = 'participant-block';
  block.id = `nc-p-${i}`;
  block.style.cssText = 'margin-top:1rem;padding-top:1rem;border-top:1px solid #eee;';
  block.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.6rem;">
      <span style="font-size:0.68rem;letter-spacing:0.14em;text-transform:uppercase;color:#aaa;">Participant ${i + 1}</span>
      <button onclick="this.parentElement.parentElement.remove()" style="background:none;border:none;cursor:pointer;font-size:0.75rem;color:#c0392b;">remove</button>
    </div>
    <div class="modal-field"><label>First name</label><input type="text" id="nc-p${i}-first" placeholder="First name"></div>
    <div class="modal-field"><label>Last name</label><input type="text" id="nc-p${i}-last" placeholder="Last name"></div>
    <div class="modal-field"><label>Email</label><input type="email" id="nc-p${i}-email" placeholder="email@example.com"></div>
    <div class="modal-field"><label>Phone</label><input type="tel" id="nc-p${i}-phone" placeholder="+41…"></div>`;
  container.appendChild(block);
}

async function submitNewCourse() {
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

  /* Collect participants */
  const participants = [];
  document.querySelectorAll('#nc-participants .participant-block').forEach((block, i) => {
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
    const res = await fetch('/api/confirm-booking', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': adminPassword },
      body: JSON.stringify({
        teacher_id:       teacherId,
        sessions_total:   sessions ? parseInt(sessions) : null,
        first_session_at: new Date(datetime).toISOString(),
        duration_minutes: 50,
        /* Pass booking and contact data manually */
        booking_data: { service, level, group: groupType },
        contact_data: { participants },
      }),
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

/* ── Delete course ───────────────────────────────────────────────── */
async function deleteCourse(courseId, courseCode) {
  if (!confirm(`Delete course ${courseCode || courseId}?\n\nThis will cancel all upcoming calendar events and remove the course and all its sessions permanently.`)) return;
  try {
    const res = await fetch('/api/delete-course', {
      method:  'DELETE',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': adminPassword },
      body:    JSON.stringify({ course_id: courseId }),
    });
    if (!res.ok) throw new Error();
    const row = document.getElementById('course-' + courseId);
    if (row) row.remove();
  } catch {
    alert('Could not delete course. Please try again.');
  }
}

/* ── Delete enquiry ─────────────────────────────────────────────── */
async function deleteEnquiry(id) {
  if (!confirm('Permanently delete this enquiry? This cannot be undone.')) return;
  try {
    const res = await fetch('/api/delete-enquiry', {
      method:  'DELETE',
      headers: {
        'Content-Type':     'application/json',
        'x-admin-password': adminPassword,
      },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) throw new Error();
    const row = document.getElementById('row-' + id);
    if (row) row.remove();
  } catch {
    alert('Could not delete enquiry. Please try again.');
  }
}

/* ── Teachers cache ──────────────────────────────────────────────── */
let teachersCache = null;

async function loadTeachers() {
  if (teachersCache) return teachersCache;
  try {
    const res = await fetch('/api/get-teachers', {
      headers: { 'x-admin-password': adminPassword },
    });
    if (!res.ok) return [];
    teachersCache = await res.json();
    return teachersCache;
  } catch {
    return [];
  }
}

/* ── Populate teacher selects in all confirm panels ─────────────── */
async function populateTeacherSelects() {
  const teachers = await loadTeachers();
  document.querySelectorAll('[id^="confirm-teacher-"]').forEach(sel => {
    const enquiryId = sel.id.replace('confirm-teacher-', '');
    sel.innerHTML = teachers.map(t => {
      const label = t.authorised ? t.name : t.name + ' (not authorised)';
      return `<option value="${t.id}"${!t.authorised ? ' disabled' : ''}>${label}</option>`;
    }).join('');
    /* Show auth prompt if teacher not authorised */
    if (teachers.length > 0 && !teachers[0].authorised) {
      const panel = document.getElementById('confirm-panel-' + enquiryId);
      if (panel && !panel.querySelector('.auth-note')) {
        const note = document.createElement('p');
        note.className = 'auth-note';
        note.style.cssText = 'font-size:0.72rem;color:#c0392b;margin-bottom:0.6rem;';
        /* Use data attribute + addEventListener so adminPassword is read at click time */
        note.innerHTML = 'Teacher has not authorised calendar access. ' +
          '<a class="auth-link" href="#" data-teacher-id="' + teachers[0].id + '">Authorise now</a>';
        note.querySelector('.auth-link').addEventListener('click', function(e) {
          e.preventDefault();
          authoriseTeacher(this.dataset.teacherId);
        });
        panel.insertBefore(note, panel.querySelector('.confirm-btn'));
      }
    }
  });
}

/* ── Open Google auth in popup ───────────────────────────────────── */
function authoriseTeacher(teacherId) {
  /* adminPassword may not be set if this is called before login completes,
     so read it from the stored variable first, falling back to the input field */
  const pwd = adminPassword || document.getElementById('admin-pwd')?.value || '';
  const popup = window.open(
    '/api/auth-login?teacher_id=' + teacherId + '&pwd=' + encodeURIComponent(pwd),
    'gcal-auth', 'width=600,height=700,left=200,top=100'
  );
  const poll = setInterval(() => {
    if (popup.closed) {
      clearInterval(poll);
      teachersCache = null;
      populateTeacherSelects();
    }
  }, 500);
}

/* ── Handle auth success redirect ────────────────────────────────── */
(function() {
  const p = new URLSearchParams(window.location.search);
  if (p.get('auth') === 'success') {
    history.replaceState({}, '', '/admin.html');
  }
})();

/* ════════════════════════════════════════════════════════════════════
   COMPANIES
   ════════════════════════════════════════════════════════════════════ */
let currentCompanyFilter = 'true';

function filterCompanies(active) {
  currentCompanyFilter = active;
  document.querySelectorAll('[data-company-status]').forEach(b => {
    b.classList.toggle('active', b.dataset.companyStatus === active);
  });
  loadCompanies(active);
}

async function loadCompanies(active = 'true') {
  const list = document.getElementById('company-list');
  if (!list.querySelector('.company-row')) {
    list.innerHTML = '<div class="loading-state">loading…</div>';
  }
  try {
    const qs = active !== 'all' ? `?active=${active}` : '';
    const res = await fetch('/api/get-companies' + qs, {
      headers: { 'x-admin-password': adminPassword },
    });
    if (!res.ok) throw new Error();
    const companies = await res.json();
    renderCompanies(companies);
  } catch {
    list.innerHTML = '<div class="loading-state">Could not load companies.</div>';
  }
}

function renderCompanies(companies) {
  const list = document.getElementById('company-list');
  if (!companies.length) {
    list.innerHTML = '<div class="empty-state">no companies found</div>';
    return;
  }

  list.innerHTML = companies.map(c => {
    const stats = [
      c.active_courses_count ? c.active_courses_count + ' course' + (c.active_courses_count !== 1 ? 's' : '') : null,
      c.active_students_count ? c.active_students_count + ' student' + (c.active_students_count !== 1 ? 's' : '') : null,
    ].filter(Boolean).join(' · ') || 'no active courses';

    return `
    <div class="company-row" id="company-${c.id}">
      <div class="company-summary" onclick="toggleCompany('${c.id}')">
        <span class="company-name">${c.name}</span>
        <span class="company-contact">${c.contact_name || '—'}</span>
        <span class="company-stats">${stats}</span>
      </div>
      <div class="company-detail" id="company-detail-${c.id}">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem;">
          <div>
            <p style="font-size:0.68rem;letter-spacing:0.14em;text-transform:uppercase;color:#aaa;margin-bottom:0.4rem;">contact</p>
            <p style="font-size:0.82rem;color:#555;line-height:1.8;">
              ${c.contact_name || '—'}<br>
              ${c.contact_email ? '<span style="color:#aaa;">' + c.contact_email + '</span><br>' : ''}
              ${c.contact_phone ? '<span style="color:#aaa;">' + c.contact_phone + '</span>' : ''}
            </p>
          </div>
          <div>
            <p style="font-size:0.68rem;letter-spacing:0.14em;text-transform:uppercase;color:#aaa;margin-bottom:0.4rem;">billing</p>
            <p style="font-size:0.82rem;color:#555;line-height:1.8;">
              ${c.billing_address || '—'}<br>
              ${c.billing_email ? '<span style="color:#aaa;">' + c.billing_email + '</span><br>' : ''}
              ${c.vat_number ? 'VAT: ' + c.vat_number + '<br>' : ''}
              ${c.rate_per_session ? '<strong>' + c.rate_per_session + ' ' + (c.currency || 'CHF') + '</strong> per session' : ''}
            </p>
          </div>
        </div>
        ${c.notes ? '<p style="font-size:0.78rem;color:#888;margin-bottom:1rem;">' + c.notes + '</p>' : ''}
        <div style="display:flex;gap:0.5rem;">
          <button class="save-btn" onclick="event.stopPropagation();editCompany('${c.id}')">edit</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function toggleCompany(id) {
  document.getElementById('company-detail-' + id).classList.toggle('open');
}

/* ── Company modal ───────────────────────────────────────────────── */
function openCompanyModal(existingData) {
  const fields = ['cm-id','cm-name','cm-contact-name','cm-contact-email','cm-contact-phone',
                   'cm-billing-address','cm-billing-email','cm-vat','cm-rate','cm-notes'];
  fields.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('company-modal-title').textContent = 'new company';
  const btn = document.getElementById('cm-submit');
  btn.textContent = 'save company'; btn.disabled = false;
  const msg = document.getElementById('cm-msg');
  msg.style.display = 'none'; msg.textContent = '';

  if (existingData) {
    document.getElementById('company-modal-title').textContent = 'edit company';
    document.getElementById('cm-id').value             = existingData.id || '';
    document.getElementById('cm-name').value           = existingData.name || '';
    document.getElementById('cm-contact-name').value   = existingData.contact_name || '';
    document.getElementById('cm-contact-email').value  = existingData.contact_email || '';
    document.getElementById('cm-contact-phone').value  = existingData.contact_phone || '';
    document.getElementById('cm-billing-address').value= existingData.billing_address || '';
    document.getElementById('cm-billing-email').value  = existingData.billing_email || '';
    document.getElementById('cm-vat').value            = existingData.vat_number || '';
    document.getElementById('cm-rate').value           = existingData.rate_per_session || '';
    document.getElementById('cm-notes').value          = existingData.notes || '';
  }
  document.getElementById('company-modal').classList.add('open');
}

function closeCompanyModal() {
  document.getElementById('company-modal').classList.remove('open');
}

async function editCompany(companyId) {
  try {
    const res = await fetch('/api/get-company-detail?id=' + companyId, {
      headers: { 'x-admin-password': adminPassword },
    });
    if (!res.ok) throw new Error();
    const data = await res.json();
    openCompanyModal(data);
  } catch {
    alert('Could not load company details.');
  }
}

async function submitCompany() {
  const btn   = document.getElementById('cm-submit');
  const msgEl = document.getElementById('cm-msg');
  msgEl.style.display = 'none';

  const name = document.getElementById('cm-name').value.trim();
  if (!name) {
    msgEl.textContent = 'Company name is required.';
    msgEl.className = 'modal-msg err'; msgEl.style.display = 'block';
    return;
  }

  btn.textContent = 'saving…'; btn.disabled = true;

  const body = {
    name,
    contact_name:    document.getElementById('cm-contact-name').value.trim() || null,
    contact_email:   document.getElementById('cm-contact-email').value.trim() || null,
    contact_phone:   document.getElementById('cm-contact-phone').value.trim() || null,
    billing_address: document.getElementById('cm-billing-address').value.trim() || null,
    billing_email:   document.getElementById('cm-billing-email').value.trim() || null,
    vat_number:      document.getElementById('cm-vat').value.trim() || null,
    rate_per_session:document.getElementById('cm-rate').value ? parseFloat(document.getElementById('cm-rate').value) : null,
    notes:           document.getElementById('cm-notes').value.trim() || null,
  };
  const id = document.getElementById('cm-id').value;
  if (id) body.id = id;

  try {
    const res = await fetch('/api/save-company', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': adminPassword },
      body: JSON.stringify(body),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Unknown error');

    msgEl.textContent = id ? 'Company updated.' : 'Company created.';
    msgEl.className = 'modal-msg'; msgEl.style.cssText = 'display:block;color:#27ae60;font-size:0.75rem;margin-top:0.8rem;';
    btn.textContent = 'saved ✓';

    setTimeout(() => {
      closeCompanyModal();
      loadCompanies(currentCompanyFilter);
    }, 1200);
  } catch (err) {
    msgEl.textContent = 'Error: ' + err.message;
    msgEl.className = 'modal-msg err'; msgEl.style.display = 'block';
    btn.textContent = 'save company'; btn.disabled = false;
  }
}

/* ════════════════════════════════════════════════════════════════════
   RECURRING SESSIONS
   ════════════════════════════════════════════════════════════════════ */
function openRecurringModal(courseId) {
  document.getElementById('rs-course-id').value = courseId;
  document.getElementById('rs-start-date').value = '';
  document.getElementById('rs-time').value = '09:00';
  document.getElementById('rs-count').value = '20';
  document.getElementById('rs-duration').value = '50';
  document.getElementById('rs-skip').value = '';
  const msg = document.getElementById('rs-msg');
  msg.style.display = 'none'; msg.textContent = '';
  const btn = document.getElementById('rs-submit');
  btn.textContent = 'create sessions'; btn.disabled = false;
  document.getElementById('recurring-modal').classList.add('open');
}

function closeRecurringModal() {
  document.getElementById('recurring-modal').classList.remove('open');
}

async function submitRecurringSessions() {
  const btn   = document.getElementById('rs-submit');
  const msgEl = document.getElementById('rs-msg');
  msgEl.style.display = 'none';

  const courseId  = document.getElementById('rs-course-id').value;
  const startDate = document.getElementById('rs-start-date').value;
  const time      = document.getElementById('rs-time').value;
  const count     = parseInt(document.getElementById('rs-count').value);
  const duration  = parseInt(document.getElementById('rs-duration').value) || 50;
  const skipRaw   = document.getElementById('rs-skip').value.trim();
  const skipDates = skipRaw ? skipRaw.split(',').map(s => s.trim()).filter(Boolean) : [];

  if (!startDate || !time || !count) {
    msgEl.textContent = 'Please fill in start date, time, and number of sessions.';
    msgEl.className = 'modal-msg err'; msgEl.style.display = 'block';
    return;
  }

  btn.textContent = 'creating…'; btn.disabled = true;

  try {
    const res = await fetch('/api/create-recurring-sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': adminPassword },
      body: JSON.stringify({
        course_id: courseId,
        start_date: startDate,
        time,
        count,
        duration_minutes: duration,
        skip_dates: skipDates,
      }),
    });

    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Unknown error');

    const errCount = result.errors ? result.errors.length : 0;
    msgEl.textContent = `Created ${result.sessions_created} sessions.` +
      (errCount ? ` ${errCount} error(s).` : '');
    msgEl.className = errCount ? 'modal-msg err' : 'modal-msg';
    msgEl.style.cssText = `display:block;color:${errCount ? '#e67e22' : '#27ae60'};font-size:0.75rem;margin-top:0.8rem;`;
    btn.textContent = 'done ✓';

    setTimeout(() => {
      closeRecurringModal();
      loadCourses(currentCourseFilter);
    }, 1500);
  } catch (err) {
    msgEl.textContent = 'Error: ' + err.message;
    msgEl.className = 'modal-msg err'; msgEl.style.display = 'block';
    btn.textContent = 'create sessions'; btn.disabled = false;
  }
}

/* ════════════════════════════════════════════════════════════════════
   ATTENDANCE
   ════════════════════════════════════════════════════════════════════ */
let attendanceStudents = []; /* cached student list for current modal */

async function openAttendanceModal(sessionId, courseId, dateLabel) {
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

  /* Load enrolled students for this course */
  try {
    const coursesRes = await fetch('/api/get-courses?status=all', {
      headers: { 'x-admin-password': adminPassword },
    });
    const courses = await coursesRes.json();
    const course = courses.find(c => c.id === courseId);
    attendanceStudents = course?.students || [];

    /* Load existing attendance for this session */
    let existingAttendance = [];
    try {
      const attRes = await fetch('/api/get-attendance?session_id=' + sessionId, {
        headers: { 'x-admin-password': adminPassword },
      });
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
      const checked  = existing ? existing.present : true; /* default to present */
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

function closeAttendanceModal() {
  document.getElementById('attendance-modal').classList.remove('open');
}

async function submitAttendance() {
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
    const res = await fetch('/api/save-attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': adminPassword },
      body: JSON.stringify({ session_id: sessionId, records }),
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

/* ── Confirm booking & create calendar event ─────────────────────── */
async function confirmBooking(enquiryId) {
  const teacherId   = document.getElementById('confirm-teacher-'  + enquiryId)?.value;
  const datetimeVal = document.getElementById('confirm-datetime-'  + enquiryId)?.value;
  const sessionsVal = document.getElementById('confirm-sessions-'  + enquiryId)?.value;
  const msgEl       = document.getElementById('confirm-msg-'       + enquiryId);
  const btn         = document.querySelector('#confirm-panel-' + enquiryId + ' .confirm-btn');

  if (!teacherId || !datetimeVal) {
    msgEl.textContent   = 'Please select a teacher and set a date and time.';
    msgEl.className     = 'confirm-msg err';
    msgEl.style.display = 'block';
    return;
  }

  btn.textContent = 'confirming…';
  btn.disabled    = true;
  msgEl.style.display = 'none';

  try {
    const res = await fetch('/api/confirm-booking', {
      method:  'POST',
      headers: {
        'Content-Type':     'application/json',
        'x-admin-password': adminPassword,
      },
      body: JSON.stringify({
        enquiry_id:       enquiryId,
        teacher_id:       teacherId,
        sessions_total:   sessionsVal ? parseInt(sessionsVal) : null,
        first_session_at: new Date(datetimeVal).toISOString(),
        duration_minutes: 50,
      }),
    });

    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Unknown error');

    msgEl.textContent   = 'Confirmed. Course: ' + result.course_code + '. Calendar event created.';
    msgEl.className     = 'confirm-msg ok';
    msgEl.style.display = 'block';
    btn.textContent     = 'confirmed ✓';

    /* Update status pill */
    const statusEl = document.querySelector('#row-' + enquiryId + ' .enq-status');
    if (statusEl) { statusEl.textContent = 'confirmed'; statusEl.className = 'enq-status confirmed'; }

    /* Reload enquiries after short delay to reflect confirmed status from DB */
    setTimeout(() => {
      loadEnquiries(adminPassword, currentFilter);
    }, 2000);

  } catch (err) {
    msgEl.textContent   = 'Error: ' + err.message;
    msgEl.className     = 'confirm-msg err';
    msgEl.style.display = 'block';
    btn.textContent     = 'confirm booking & create calendar event';
    btn.disabled        = false;
  }
}

/* ════════════════════════════════════════════════════════════════════
   BILLING / INVOICES
   ════════════════════════════════════════════════════════════════════ */
let currentInvoiceFilter = 'all';

function filterInvoices(status) {
  currentInvoiceFilter = status;
  document.querySelectorAll('[data-inv-status]').forEach(b => {
    b.classList.toggle('active', b.dataset.invStatus === status);
  });
  loadInvoices(status);
}

async function loadInvoices(status = 'all') {
  const list = document.getElementById('invoice-list');
  if (!list.querySelector('.invoice-row')) {
    list.innerHTML = '<div class="loading-state">loading…</div>';
  }
  try {
    const qs = status !== 'all' ? `?status=${status}` : '';
    const res = await fetch('/api/get-invoices' + qs, {
      headers: { 'x-admin-password': adminPassword },
    });
    if (!res.ok) throw new Error();
    const invoices = await res.json();
    renderInvoices(invoices);
  } catch {
    list.innerHTML = '<div class="loading-state">Could not load invoices.</div>';
  }
}

function renderInvoices(invoices) {
  const list = document.getElementById('invoice-list');
  if (!invoices.length) {
    list.innerHTML = '<div class="empty-state">no invoices found</div>';
    return;
  }

  list.innerHTML = invoices.map(inv => `
    <div class="invoice-row" onclick="openInvoiceDetail('${inv.id}')">
      <div class="invoice-summary">
        <span class="inv-number">${inv.invoice_number}</span>
        <span class="inv-company">${inv.company_name || '—'}</span>
        <span class="inv-amount">${inv.currency} ${parseFloat(inv.total_amount).toFixed(2)}</span>
        <span class="inv-date">${inv.issued_date || '—'}</span>
        <span class="inv-status ${inv.status}">${inv.status}</span>
      </div>
    </div>
  `).join('');
}

/* ── Invoice detail modal ──────────────────────────────────────────── */
async function openInvoiceDetail(invoiceId) {
  document.getElementById('inv-detail-title').textContent = 'loading…';
  document.getElementById('inv-detail-content').innerHTML = '<div class="loading-state">loading…</div>';
  document.getElementById('invoice-detail-modal').classList.add('open');

  try {
    const res = await fetch('/api/get-invoice-detail?id=' + invoiceId, {
      headers: { 'x-admin-password': adminPassword },
    });
    if (!res.ok) throw new Error();
    const inv = await res.json();

    document.getElementById('inv-detail-title').textContent = inv.invoice_number;

    const linesHtml = (inv.lines || []).map(l => `
      <div style="display:grid;grid-template-columns:1fr 40px 70px 70px;gap:0.5rem;padding:0.3rem 0;border-bottom:1px solid #f0f0f0;font-size:0.78rem;">
        <span style="color:#555;">${l.description}</span>
        <span style="color:#888;text-align:right;">${l.quantity}</span>
        <span style="color:#888;text-align:right;">${parseFloat(l.unit_price).toFixed(2)}</span>
        <span style="color:#1a1a1a;text-align:right;">${parseFloat(l.line_total).toFixed(2)}</span>
      </div>
    `).join('');

    const company = inv.company || {};
    const netAmt   = parseFloat(inv.net_amount).toFixed(2);
    const vatAmt   = parseFloat(inv.vat_amount).toFixed(2);
    const totalAmt = parseFloat(inv.total_amount).toFixed(2);

    document.getElementById('inv-detail-content').innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1.2rem;">
        <div>
          <p style="font-size:0.68rem;letter-spacing:0.14em;text-transform:uppercase;color:#aaa;margin-bottom:0.4rem;">details</p>
          <p style="font-size:0.82rem;color:#555;line-height:1.8;">
            Company: ${company.name || '—'}<br>
            Date: ${inv.issued_date}<br>
            Due: ${inv.due_date}<br>
            Status: <strong>${inv.status}</strong>
          </p>
        </div>
        <div>
          <p style="font-size:0.68rem;letter-spacing:0.14em;text-transform:uppercase;color:#aaa;margin-bottom:0.4rem;">payment</p>
          <p style="font-size:0.82rem;color:#555;line-height:1.8;">
            QR-IBAN: ${inv.qr_iban || '—'}<br>
            QR Ref: ${inv.qr_reference_formatted || '—'}<br>
            Currency: ${inv.currency}
          </p>
        </div>
      </div>

      <p style="font-size:0.68rem;letter-spacing:0.14em;text-transform:uppercase;color:#aaa;margin-bottom:0.6rem;">line items</p>
      <div style="display:grid;grid-template-columns:1fr 40px 70px 70px;gap:0.5rem;padding:0.3rem 0;border-bottom:1px solid #ccc;font-size:0.68rem;color:#aaa;text-transform:uppercase;letter-spacing:0.08em;">
        <span>Description</span><span style="text-align:right;">Qty</span><span style="text-align:right;">Price</span><span style="text-align:right;">Total</span>
      </div>
      ${linesHtml}

      <div style="margin-top:0.8rem;text-align:right;font-size:0.85rem;line-height:1.8;">
        <span style="color:#888;">Net: ${inv.currency} ${netAmt}</span><br>
        ${inv.vat_rate ? `<span style="color:#888;">VAT (${inv.vat_rate}%): ${inv.currency} ${vatAmt}</span><br>` : ''}
        <strong>Total: ${inv.currency} ${totalAmt}</strong>
      </div>

      ${inv.notes ? `<p style="font-size:0.78rem;color:#888;margin-top:1rem;">${inv.notes}</p>` : ''}

      <div style="display:flex;gap:0.5rem;margin-top:1.4rem;flex-wrap:wrap;">
        <button class="save-btn" onclick="downloadInvoicePdf('${inv.id}','${inv.invoice_number}')">download PDF</button>
        ${inv.status === 'draft' ? `<button class="action-btn" onclick="updateInvoiceStatus('${inv.id}','sent')">mark sent</button>` : ''}
        ${inv.status === 'sent' ? `<button class="log-btn" onclick="updateInvoiceStatus('${inv.id}','paid')">mark paid</button>` : ''}
        ${inv.status !== 'cancelled' && inv.status !== 'paid' ? `<button class="cancel-btn" onclick="updateInvoiceStatus('${inv.id}','cancelled')">cancel</button>` : ''}
      </div>
    `;
  } catch {
    document.getElementById('inv-detail-content').innerHTML = '<p style="color:#c0392b;">Could not load invoice.</p>';
  }
}

function closeInvoiceDetailModal() {
  document.getElementById('invoice-detail-modal').classList.remove('open');
}

async function updateInvoiceStatus(invoiceId, newStatus) {
  if (newStatus === 'cancelled' && !confirm('Cancel this invoice?')) return;
  try {
    const res = await fetch('/api/update-invoice', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': adminPassword },
      body: JSON.stringify({ id: invoiceId, status: newStatus }),
    });
    if (!res.ok) throw new Error();
    closeInvoiceDetailModal();
    loadInvoices(currentInvoiceFilter);
  } catch {
    alert('Could not update invoice status.');
  }
}

async function downloadInvoicePdf(invoiceId, invoiceNumber) {
  try {
    const res = await fetch('/api/generate-invoice-pdf?id=' + invoiceId, {
      headers: { 'x-admin-password': adminPassword },
    });
    if (!res.ok) throw new Error();
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (invoiceNumber || 'invoice') + '.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch {
    alert('Could not download PDF.');
  }
}

/* ── Create invoice modal ──────────────────────────────────────────── */
let invoiceCompanyCache = null;
let invoiceSessionsCache = [];

async function openCreateInvoiceModal() {
  const sel = document.getElementById('inv-company');
  const sessDiv = document.getElementById('inv-sessions');
  const msg = document.getElementById('inv-msg');
  const btn = document.getElementById('inv-submit');

  msg.style.display = 'none'; msg.textContent = '';
  btn.textContent = 'create invoice'; btn.disabled = false;
  document.getElementById('inv-vat-rate').value = '';
  document.getElementById('inv-notes').value = '';
  document.getElementById('inv-total-preview').textContent = 'Total: —';
  sessDiv.innerHTML = '<p style="font-size:0.78rem;color:#aaa;">Select a company first.</p>';

  // Load companies for dropdown
  try {
    const res = await fetch('/api/get-companies', {
      headers: { 'x-admin-password': adminPassword },
    });
    if (res.ok) {
      invoiceCompanyCache = await res.json();
      sel.innerHTML = '<option value="">select company…</option>' +
        invoiceCompanyCache.map(c =>
          `<option value="${c.id}">${c.name}${c.rate_per_session ? ' (' + c.rate_per_session + ' ' + (c.currency || 'CHF') + '/session)' : ''}</option>`
        ).join('');
    }
  } catch { /* keep default */ }

  // Listen for company change
  sel.onchange = () => loadCompanySessions(sel.value);

  document.getElementById('create-invoice-modal').classList.add('open');
}

function closeCreateInvoiceModal() {
  document.getElementById('create-invoice-modal').classList.remove('open');
}

async function loadCompanySessions(companyId) {
  const sessDiv = document.getElementById('inv-sessions');
  if (!companyId) {
    sessDiv.innerHTML = '<p style="font-size:0.78rem;color:#aaa;">Select a company first.</p>';
    return;
  }

  sessDiv.innerHTML = '<p class="loading-state" style="padding:0.5rem 0;">loading sessions…</p>';

  try {
    // Load all courses for this company
    const res = await fetch('/api/get-courses?status=all', {
      headers: { 'x-admin-password': adminPassword },
    });
    if (!res.ok) throw new Error();
    const allCourses = await res.json();
    const companyCourses = allCourses.filter(c => c.company_id === companyId);

    // Collect completed sessions
    invoiceSessionsCache = [];
    for (const course of companyCourses) {
      for (const s of (course.sessions || [])) {
        if (s.status === 'completed') {
          invoiceSessionsCache.push({
            id: s.id,
            course_code: course.course_code,
            scheduled_at: s.scheduled_at,
          });
        }
      }
    }

    if (!invoiceSessionsCache.length) {
      sessDiv.innerHTML = '<p style="font-size:0.78rem;color:#aaa;">No completed sessions to invoice.</p>';
      return;
    }

    // Sort by date
    invoiceSessionsCache.sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));

    sessDiv.innerHTML = `
      <div style="margin-bottom:0.5rem;">
        <button class="add-participant-btn" onclick="toggleAllInvSessions(true)">select all</button>
        <button class="add-participant-btn" style="margin-left:0.8rem;" onclick="toggleAllInvSessions(false)">deselect all</button>
      </div>
    ` + invoiceSessionsCache.map(s => {
      const date = s.scheduled_at
        ? new Date(s.scheduled_at).toLocaleDateString('de-CH', { day:'2-digit', month:'2-digit', year:'numeric' })
        : '—';
      return `
        <div class="inv-session-check">
          <label>
            <input type="checkbox" value="${s.id}" checked onchange="updateInvTotalPreview()">
            ${s.course_code || '—'} — ${date}
          </label>
        </div>`;
    }).join('');

    updateInvTotalPreview();
  } catch {
    sessDiv.innerHTML = '<p style="font-size:0.78rem;color:#c0392b;">Could not load sessions.</p>';
  }
}

function toggleAllInvSessions(checked) {
  document.querySelectorAll('#inv-sessions input[type="checkbox"]').forEach(cb => {
    cb.checked = checked;
  });
  updateInvTotalPreview();
}

function updateInvTotalPreview() {
  const companyId = document.getElementById('inv-company').value;
  const company = invoiceCompanyCache?.find(c => c.id === companyId);
  const rate = company ? parseFloat(company.rate_per_session) || 0 : 0;
  const currency = company?.currency || 'CHF';
  const count = document.querySelectorAll('#inv-sessions input[type="checkbox"]:checked').length;
  const vatRate = parseFloat(document.getElementById('inv-vat-rate').value) || 0;

  const net = count * rate;
  const vat = Math.round(net * vatRate / 100 * 100) / 100;
  const total = net + vat;

  document.getElementById('inv-total-preview').textContent =
    `${count} session${count !== 1 ? 's' : ''} × ${rate.toFixed(2)} = ${currency} ${net.toFixed(2)}` +
    (vatRate ? ` + VAT ${vatRate}% = ${currency} ${total.toFixed(2)}` : '');
}

async function submitCreateInvoice() {
  const btn   = document.getElementById('inv-submit');
  const msgEl = document.getElementById('inv-msg');
  msgEl.style.display = 'none';

  const companyId = document.getElementById('inv-company').value;
  if (!companyId) {
    msgEl.textContent = 'Please select a company.';
    msgEl.className = 'modal-msg err'; msgEl.style.display = 'block';
    return;
  }

  const sessionIds = [];
  document.querySelectorAll('#inv-sessions input[type="checkbox"]:checked').forEach(cb => {
    sessionIds.push(cb.value);
  });

  if (!sessionIds.length) {
    msgEl.textContent = 'Please select at least one session.';
    msgEl.className = 'modal-msg err'; msgEl.style.display = 'block';
    return;
  }

  btn.textContent = 'creating…'; btn.disabled = true;

  const vatRate = document.getElementById('inv-vat-rate').value;
  const notes   = document.getElementById('inv-notes').value.trim();

  try {
    const res = await fetch('/api/create-invoice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': adminPassword },
      body: JSON.stringify({
        company_id: companyId,
        session_ids: sessionIds,
        vat_rate: vatRate ? parseFloat(vatRate) : undefined,
        notes: notes || undefined,
      }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Unknown error');

    msgEl.textContent = `Created ${result.invoice_number}`;
    msgEl.className = 'modal-msg';
    msgEl.style.cssText = 'display:block;color:#27ae60;font-size:0.75rem;margin-top:0.8rem;';
    btn.textContent = 'created ✓';

    setTimeout(() => {
      closeCreateInvoiceModal();
      loadInvoices(currentInvoiceFilter);
    }, 1200);
  } catch (err) {
    msgEl.textContent = 'Error: ' + err.message;
    msgEl.className = 'modal-msg err'; msgEl.style.display = 'block';
    btn.textContent = 'create invoice'; btn.disabled = false;
  }
}

// Hook VAT rate input to update preview
document.getElementById('inv-vat-rate')?.addEventListener('input', updateInvTotalPreview);

