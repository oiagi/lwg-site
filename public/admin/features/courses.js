/* ── Courses tab ──────────────────────────────────────────────────── */
import { apiFetch } from '../core/api.js';
import { fmtDate, esc, showMessage } from '../core/helpers.js';
import { loadTeachers } from './teachers.js';
import { MESSAGE_TIMEOUT_MS } from '../core/constants.js';
import { openConfirmSend } from './confirm-send.js';
import { openCertificateModal as openCertificates } from './certificates.js';

let currentCourseFilter = 'active';
let participantCount = 1;
let attendanceStudents = [];
let studentCache = [];
let clickAwayHandler = null;
let addParticipantCourseId = null;
let apSearchListenersAttached = false;
let coursesCache = [];

export function getCurrentCourseFilter() {
  return currentCourseFilter;
}

/* ── Location address helpers ───────────────────────────────────── */
export function formatCourseAddress(course) {
  const street = (course.location_street || '').trim();
  const num = (course.location_street_number || '').trim();
  const postal = (course.location_postal_code || '').trim();
  const city = (course.location_city || '').trim();
  if (!street && !num && !postal && !city) return '';
  const line1 = [street, num].filter(Boolean).join(' ');
  const line2 = [postal, city].filter(Boolean).join(' ');
  return [line1, line2].filter(Boolean).join(', ');
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
    <div class="loc-address-editor" id="loc-editor-${course.id}" style="display:none;">
      <div class="loc-address-grid">
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

export function toggleCourseAddressEditor(courseId) {
  const editor = document.getElementById('loc-editor-' + courseId);
  const line = document.getElementById('loc-line-' + courseId);
  if (!editor || !line) return;
  const open = editor.style.display !== 'none';
  editor.style.display = open ? 'none' : 'block';
  line.style.display = open ? '' : 'none';
}

export async function saveCourseAddress(courseId) {
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
      msg.textContent = 'Error: ' + err.message;
      msg.style.color = '#c33';
      msg.style.display = 'inline';
    }
  }
}

function sentCommunicationsBlock(course) {
  const students = course.students || [];
  const total = students.length;

  const confirmedAt = course.course_confirmation_sent_at;
  const scheduleSent = students.filter((s) => s.schedule_sent_at);
  const certSent = students.filter((s) => s.certificate_sent_at);

  if (!confirmedAt && !scheduleSent.length && !certSent.length) return '';

  const latest = (rows, key) =>
    rows
      .map((s) => s[key])
      .filter(Boolean)
      .sort()
      .pop();

  const items = [];
  if (confirmedAt) {
    items.push(
      `<li>✓ confirmation sent · <span class="detail-muted">${esc(fmtDate(confirmedAt))}</span></li>`
    );
  }
  if (scheduleSent.length) {
    const last = latest(scheduleSent, 'schedule_sent_at');
    items.push(
      `<li>✓ schedule sent to ${scheduleSent.length} of ${total} · <span class="detail-muted">last ${esc(fmtDate(last))}</span></li>`
    );
  }
  if (certSent.length) {
    const last = latest(certSent, 'certificate_sent_at');
    items.push(
      `<li>✓ certificate sent to ${certSent.length} of ${total} · <span class="detail-muted">last ${esc(fmtDate(last))}</span></li>`
    );
  }

  return `
    <div class="sent-status">
      <p class="detail-meta">communications</p>
      <ul class="sent-status-list">${items.join('')}</ul>
    </div>`;
}

export function filterCourses(status) {
  currentCourseFilter = status;
  document.querySelectorAll('[data-course-status]').forEach((b) => {
    b.classList.toggle('active', b.dataset.courseStatus === status);
  });
  loadCourses(status);
}

export async function loadCourses(status = 'active') {
  const list = document.getElementById('course-list');

  const openIds = new Set(
    Array.from(document.querySelectorAll('.course-detail.open')).map((el) =>
      el.id.replace('course-detail-', '')
    )
  );

  if (!list.querySelector('.course-row')) {
    list.innerHTML = '<div class="loading-state">loading…</div>';
  }

  try {
    const res = await apiFetch('/api/get-courses?status=' + status);
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

function renderCourses(courses) {
  const list = document.getElementById('course-list');
  if (!courses.length) {
    list.innerHTML = '<div class="loading-state" style="padding:2rem 0;">No courses found.</div>';
    return;
  }

  list.innerHTML = courses
    .map((c) => {
      const names = (c.participant_names || []).map((n) => esc(n)).join(', ') || '—';
      const done = c.sessions_completed || 0;
      const total = c.sessions_total;
      const remaining = total ? total - done : null;
      const sessLine = total ? `${done} / ${total} sessions` : `${done} sessions completed`;

      const rebookFlag =
        total && remaining !== null && remaining <= 3
          ? `<span class="rebook-flag">⚠ ${remaining === 0 ? 'block complete' : remaining + ' session' + (remaining === 1 ? '' : 's') + ' left'}</span>`
          : '';

      const sessions = (c.sessions || [])
        .filter((s) => s.status !== 'cancelled')
        .slice()
        .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))
        .map(
          (s, idx) => `
      <div class="session-row" id="sess-${s.id}">
        <div class="session-number">${idx + 1}.</div>
        <div class="session-status-dot ${s.status}"></div>
        <div class="session-date">${fmtDate(s.scheduled_at)}</div>
        <div class="session-status-label">${s.status}</div>
        <button class="action-btn" data-action="openAttendanceModal" data-args="${s.id},${c.id},${fmtDate(s.scheduled_at)}">attendance</button>
        ${
          s.status === 'scheduled'
            ? `
          <button class="log-btn" data-action="logSession" data-args="${s.id},${c.id}">mark completed</button>
          <button class="cancel-btn" data-action="cancelSession" data-args="${s.id},${c.id}">cancel</button>
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
                return `<li class="course-invoice-row"><span class="course-invoice-number">${num}</span> <span class="detail-muted">${amount} · ${status}</span></li>`;
              })
              .join('');
            const invoiceBlock = openInvoices
              ? `<div class="course-invoice-list"><p class="detail-muted course-invoice-list-label">open invoices</p><ul>${openInvoices}</ul></div>`
              : '';
            const scheduleBtn = s.email
              ? `<button class="action-btn" data-action="sendStudentSchedule" data-args="${s.id},${c.id}">✉ send schedule</button>
                 <span class="saved-msg" id="schedule-msg-${s.id}">sent</span>`
              : '';
            const sentTags = [
              s.schedule_sent_at
                ? `<span class="sent-tag">schedule sent · ${esc(fmtDate(s.schedule_sent_at))}</span>`
                : '',
              s.certificate_sent_at
                ? `<span class="sent-tag">certificate sent · ${esc(fmtDate(s.certificate_sent_at))}</span>`
                : '',
            ]
              .filter(Boolean)
              .join('');
            return `
      <div class="progress-block">
        <p class="progress-name">
          <button class="student-link" data-action="selectStudentFromCourse"
            data-args="${s.id},${c.id},${esc(c.course_code || '')}">
            ${esc([s.first_name, s.last_name].filter(Boolean).join(' ')) || '—'}
          </button>
          ${s.current_level ? '<span class="detail-muted"> · ' + esc(s.current_level) + '</span>' : ''}
        </p>
        <div class="progress-row">
          <input id="level-${s.id}" type="text" value="${s.current_level || ''}"
            class="level-input" placeholder="level" />
          <button class="save-btn" data-action="saveStudent" data-args="${s.id}">save</button>
          <span class="saved-msg" id="student-saved-${s.id}">saved</span>
          ${scheduleBtn}
        </div>
        ${sentTags ? `<div class="sent-tag-row">${sentTags}</div>` : ''}
        ${invoiceBlock}
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
           <button class="save-btn sync-btn" data-action="syncCalendar" data-args="${c.id}">↻ sync</button>
           <span class="saved-msg" id="sync-msg-${c.id}">synced</span>
         </div>`;

      return `
      <div class="course-row" id="course-${c.id}">
        <div class="course-summary" data-action="toggleCourse" data-args="${c.id}">
          <span class="course-code">${esc(c.course_code) || '—'}</span>
          <span class="course-participants">${names}</span>
          <span class="course-sessions">${sessLine}${rebookFlag}</span>
          <span class="course-status ${esc(c.status)}">${esc(c.status)}</span>
          <a class="edit-course-btn" href="/admin/pages/course-edit.html?id=${c.id}">edit</a>
          <button class="delete-course-btn" data-action="deleteCourse" data-args="${c.id},${esc(c.course_code)}">delete</button>
        </div>
        <div class="course-detail" id="course-detail-${c.id}">
          <div class="detail-grid detail-grid--gap-lg">
            <div>
              <p class="detail-meta">details</p>
              <p class="detail-body">
                Subject: ${esc(c.service) || '—'}<br>
                Level: ${esc(c.level) || '—'}<br>
                Group size: ${esc(c.group_type) || '—'}<br>
                Sessions: ${total ? total + ' sessions' : 'open-ended'}<br>
                Session length: ${c.session_length_minutes ? esc(String(c.session_length_minutes)) + ' min' : '—'}<br>
                Price/session: ${c.price_per_session !== null && c.price_per_session !== undefined ? Number(c.price_per_session).toFixed(2) + ' ' + esc(c.currency || 'CHF') : '—'}<br>
                Location: ${locationSummaryHtml(c)}
              </p>
              ${locationEditorHtml(c)}
            </div>
            <div>
              <p class="detail-meta">contact</p>
              ${
                (c.participants || [])
                  .map(
                    (p) => `
                <p class="detail-body">
                  ${esc([p.firstName, p.lastName].filter(Boolean).join(' '))}
                  ${p.email ? '<br><span class="detail-muted">' + esc(p.email) + '</span>' : ''}
                  ${p.phone ? '<br><span class="detail-muted">' + esc(p.phone) + '</span>' : ''}
                </p>
              `
                  )
                  .join('') || '<p class="detail-body detail-muted">—</p>'
              }
            </div>
          </div>
          <p class="detail-meta" style="margin-bottom:0.8rem;">students & progress</p>
          ${studentBlocks}
          ${sentCommunicationsBlock(c)}
          <div class="course-actions-row" style="margin-top:0.4rem;display:flex;gap:0.4rem;align-items:center;flex-wrap:wrap;">
            <button class="save-btn"
              data-action="openAddParticipantModal" data-args="${c.id}">+ add participant</button>
            <button class="save-btn"
              data-action="sendCourseConfirmation" data-args="${c.id}">✉ send confirmation</button>
            <span class="saved-msg" id="confirm-msg-${c.id}">sent</span>
            <button class="save-btn"
              data-action="openCertificateModal" data-args="${c.id}">✉ send certificates</button>
            <span class="saved-msg" id="cert-row-msg-${c.id}">sent</span>
          </div>
          <p style="font-size:0.68rem;letter-spacing:0.14em;text-transform:uppercase;color:#aaa;margin:1rem 0 0.6rem;">sessions</p>
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
      showMessage(msg, parts.length ? 'synced · ' + parts.join(', ') : 'synced');
    }
    loadCourses(currentCourseFilter);
  } catch (err) {
    console.error('Sync error:', err);
    alert('Calendar sync failed: ' + (err.message || err));
  }
}

export async function cancelSession(sessionId, courseId) {
  if (!confirm('Cancel this session? The Google Calendar event and invite will be removed.'))
    return;
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
          const total = parseInt(match[2]);
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
  const level = document.getElementById('level-' + studentId)?.value || '';
  try {
    const res = await apiFetch('/api/update-student', {
      method: 'PATCH',
      body: { student_id: studentId, current_level: level },
    });
    if (res.ok) {
      const msg = document.getElementById('student-saved-' + studentId);
      if (msg) showMessage(msg, 'saved');
    }
  } catch (err) {
    console.error('Save student error:', err);
  }
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
          const total = parseInt(match[2]);
          countEl.firstChild.textContent = newDone + ' / ' + total + ' sessions';
        }
      }
    }
  } catch {
    alert('Could not log session. Please try again.');
  }
}

/* ── Participant block helpers ──────────────────────────────────── */
function renderParticipantBlock(i, { showRemove = false } = {}) {
  return `
    <div class="participant-block modal-grid" id="nc-p-${i}" data-selected-student-id="" style="${i > 0 ? 'margin-top:1rem;padding-top:1rem;border-top:1px solid #eee;' : ''}">
      ${
        showRemove
          ? `<div class="participant-block-header">
               <span class="detail-meta" style="margin:0;">Participant ${i + 1}</span>
               <button class="remove-participant-btn" data-action="removeParticipantBlock">remove</button>
             </div>`
          : ''
      }
      <div class="modal-field full">
        <label>Search existing student <span class="label-hint">(optional)</span></label>
        <div class="modal-field--relative">
          <input type="text" id="nc-p${i}-search" class="participant-search"
            placeholder="Type name or email…" autocomplete="off"
            role="combobox" aria-expanded="false" aria-haspopup="listbox"
            aria-controls="nc-p${i}-dropdown">
          <ul id="nc-p${i}-dropdown" class="search-dropdown" role="listbox" style="display:none;"></ul>
        </div>
      </div>
      <div class="modal-field"><label>First name</label><input type="text" id="nc-p${i}-first" placeholder="First name"></div>
      <div class="modal-field"><label>Last name</label><input type="text" id="nc-p${i}-last" placeholder="Last name"></div>
      <div class="modal-field"><label>Email</label><input type="email" id="nc-p${i}-email" placeholder="email@example.com"></div>
      <div class="modal-field"><label>Phone</label><input type="tel" id="nc-p${i}-phone" placeholder="+41…"></div>
    </div>`;
}

function hideDropdown(i) {
  const dropdown = document.getElementById(`nc-p${i}-dropdown`);
  const search = document.getElementById(`nc-p${i}-search`);
  if (dropdown) dropdown.style.display = 'none';
  if (search) search.setAttribute('aria-expanded', 'false');
}

/* ── Shared student search autocomplete ────────────────────────── */
function buildStudentSearch(inputEl, dropdownEl, onSelect) {
  function hide() {
    dropdownEl.style.display = 'none';
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

    dropdownEl.style.display = 'block';
    inputEl.setAttribute('aria-expanded', 'true');

    dropdownEl.querySelectorAll('li').forEach((li) => {
      li.addEventListener('mouseover', () => (li.style.background = '#f5f5f5'));
      li.addEventListener('mouseout', () => (li.style.background = ''));
    });
  });

  inputEl.addEventListener('blur', () => {
    setTimeout(() => hide(), 150);
  });

  inputEl.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const first = dropdownEl.querySelector('li');
    if (first && dropdownEl.style.display !== 'none') {
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

function attachSearchListeners(i) {
  const inputEl = document.getElementById(`nc-p${i}-search`);
  const dropdownEl = document.getElementById(`nc-p${i}-dropdown`);
  if (!inputEl || !dropdownEl) return;
  buildStudentSearch(inputEl, dropdownEl, (data) => {
    document.getElementById(`nc-p${i}-first`).value = data.first;
    document.getElementById(`nc-p${i}-last`).value = data.last;
    document.getElementById(`nc-p${i}-email`).value = data.email;
    document.getElementById(`nc-p${i}-phone`).value = data.phone;
    const block = document.getElementById(`nc-p-${i}`);
    if (block) block.dataset.selectedStudentId = data.studentId;
  });
}

/* ── New course modal ───────────────────────────────────────────── */
export function openNewCourseModal() {
  [
    'nc-teacher',
    'nc-service',
    'nc-level',
    'nc-group',
    'nc-sessions',
    'nc-session-length',
    'nc-price',
    'nc-location',
    'nc-datetime',
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.tagName === 'SELECT') el.value = el.options[0]?.value;
    else if (id === 'nc-session-length') el.value = '50';
    else el.value = '';
  });
  participantCount = 1;
  const container = document.getElementById('nc-participants');
  container.innerHTML = renderParticipantBlock(0);
  attachSearchListeners(0);

  const sel = document.getElementById('nc-teacher');
  loadTeachers().then((teachers) => {
    sel.innerHTML = teachers
      .map(
        (t) =>
          `<option value="${t.id}"${!t.authorised ? ' disabled' : ''}>${esc(t.name)}${!t.authorised ? ' (not authorised)' : ''}</option>`
      )
      .join('');
  });
  const msgEl = document.getElementById('nc-msg');
  if (msgEl) {
    msgEl.style.display = 'none';
    msgEl.textContent = '';
  }
  const btn = document.getElementById('nc-submit');
  if (btn) {
    btn.textContent = 'create course & calendar event';
    btn.disabled = false;
  }
  document.getElementById('new-course-modal').classList.add('open');

  // Fetch students for search (fire-and-forget, safe fallback on failure)
  apiFetch('/api/get-students?status=all')
    .then((res) => {
      if (res.ok) return res.json();
      throw new Error();
    })
    .then((data) => {
      studentCache = data;
    })
    .catch(() => {
      studentCache = [];
    });

  // Click-away handler: close any open dropdown when clicking outside participants
  if (clickAwayHandler) document.removeEventListener('click', clickAwayHandler);
  clickAwayHandler = (e) => {
    if (!e.target.closest('#nc-participants')) {
      document.querySelectorAll('#nc-participants .participant-block').forEach((block) => {
        const idx = block.id.replace('nc-p-', '');
        hideDropdown(parseInt(idx, 10));
      });
    }
  };
  document.addEventListener('click', clickAwayHandler);
}

export function closeNewCourseModal() {
  document.getElementById('new-course-modal').classList.remove('open');
  if (clickAwayHandler) {
    document.removeEventListener('click', clickAwayHandler);
    clickAwayHandler = null;
  }
}

export function removeParticipantBlock(el) {
  const block = el.closest('.participant-block');
  if (block) block.remove();
}

export function addParticipantBlock() {
  const container = document.getElementById('nc-participants');
  const i = participantCount++;
  const wrapper = document.createElement('div');
  wrapper.innerHTML = renderParticipantBlock(i, { showRemove: true });
  container.appendChild(wrapper.firstElementChild);
  attachSearchListeners(i);
}

export async function submitNewCourse() {
  const btn = document.getElementById('nc-submit');
  const msgEl = document.getElementById('nc-msg');
  msgEl.style.display = 'none';

  const teacherId = document.getElementById('nc-teacher').value;
  const service = document.getElementById('nc-service').value;
  const level = document.getElementById('nc-level').value;
  const groupType = document.getElementById('nc-group').value;
  const sessions = document.getElementById('nc-sessions').value;
  const sessionLength = document.getElementById('nc-session-length').value;
  const price = document.getElementById('nc-price').value;
  const location = document.getElementById('nc-location').value;
  const datetime = document.getElementById('nc-datetime').value;

  if (!teacherId || !datetime) {
    msgEl.textContent = 'Please select a teacher and set a first session date.';
    msgEl.className = 'modal-msg err';
    msgEl.style.display = 'block';
    return;
  }

  const participants = [];
  document.querySelectorAll('#nc-participants .participant-block').forEach((block) => {
    const idx = block.id.replace('nc-p-', '');
    const first = document.getElementById(`nc-p${idx}-first`)?.value?.trim();
    const last = document.getElementById(`nc-p${idx}-last`)?.value?.trim();
    const email = document.getElementById(`nc-p${idx}-email`)?.value?.trim();
    const phone = document.getElementById(`nc-p${idx}-phone`)?.value?.trim();
    const selectedStudentId = block.dataset.selectedStudentId || '';
    // New students only require a first name; existing selections need no input here.
    if (selectedStudentId || first) {
      participants.push({
        firstName: first || '',
        lastName: last || '',
        email: email || '',
        phone: phone || '',
        studentId: selectedStudentId || '',
      });
    }
  });

  btn.textContent = 'creating…';
  btn.disabled = true;

  try {
    const durationMinutes = parseInt(sessionLength) || 50;
    const res = await apiFetch('/api/confirm-booking', {
      method: 'POST',
      body: {
        teacher_id: teacherId,
        sessions_total: sessions ? parseInt(sessions) : null,
        first_session_at: new Date(datetime).toISOString(),
        duration_minutes: durationMinutes,
        session_length_minutes: durationMinutes,
        price_per_session: price ? parseFloat(price) : null,
        location: location || null,
        booking_data: { service, level, group: groupType },
        contact_data: { participants },
      },
    });

    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Unknown error');

    msgEl.textContent = `Created. Course: ${result.course_code}`;
    msgEl.className = 'modal-msg success';
    btn.textContent = 'created ✓';

    setTimeout(() => {
      closeNewCourseModal();
      loadCourses(currentCourseFilter);
    }, MESSAGE_TIMEOUT_MS);
  } catch (err) {
    msgEl.textContent = 'Error: ' + err.message;
    msgEl.className = 'modal-msg err';
    msgEl.style.display = 'block';
    btn.textContent = 'create course & calendar event';
    btn.disabled = false;
  }
}

export async function deleteCourse(courseId, courseCode) {
  if (
    !confirm(
      `Delete course ${courseCode || courseId}?\n\nThis will cancel all upcoming calendar events and remove the course and all its sessions permanently.`
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

/* ── Attendance modal ───────────────────────────────────────────── */
export async function openAttendanceModal(sessionId, courseId, dateLabel) {
  document.getElementById('att-session-id').value = sessionId;
  document.getElementById('att-course-id').value = courseId;
  document.getElementById('att-title').textContent = 'attendance — ' + (dateLabel || '');
  const container = document.getElementById('att-students');
  container.innerHTML = '<p class="loading-state" style="padding:1rem 0;">loading students…</p>';
  const msg = document.getElementById('att-msg');
  msg.style.display = 'none';
  msg.textContent = '';
  const btn = document.getElementById('att-submit');
  btn.textContent = 'save attendance';
  btn.disabled = false;
  document.getElementById('attendance-modal').classList.add('open');

  try {
    const coursesRes = await apiFetch('/api/get-courses?status=all');
    const courses = await coursesRes.json();
    const course = courses.find((c) => c.id === courseId);
    attendanceStudents = course?.students || [];

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
        '<p style="font-size:0.78rem;color:#aaa;padding:1rem 0;">No students enrolled in this course.</p>';
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
    container.innerHTML =
      '<p style="font-size:0.78rem;color:#c0392b;">Could not load students.</p>';
  }
}

export function closeAttendanceModal() {
  document.getElementById('attendance-modal').classList.remove('open');
}

export async function submitAttendance() {
  const btn = document.getElementById('att-submit');
  const msgEl = document.getElementById('att-msg');
  const sessionId = document.getElementById('att-session-id').value;
  msgEl.style.display = 'none';

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
    msgEl.style.display = 'block';
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

    msgEl.textContent = `Saved attendance for ${result.saved_count} student(s).`;
    msgEl.className = 'modal-msg success';
    btn.textContent = 'saved ✓';

    setTimeout(() => closeAttendanceModal(), MESSAGE_TIMEOUT_MS);
  } catch (err) {
    msgEl.textContent = 'Error: ' + err.message;
    msgEl.className = 'modal-msg err';
    msgEl.style.display = 'block';
    btn.textContent = 'save attendance';
    btn.disabled = false;
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
  const msgEl = document.getElementById('ap-msg');
  msgEl.style.display = 'none';
  msgEl.textContent = '';
  const btn = document.getElementById('ap-submit');
  btn.textContent = 'add';
  btn.disabled = false;
  const dropdown = document.getElementById('ap-dropdown');
  if (dropdown) dropdown.style.display = 'none';
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

/* ── Edit course modal ──────────────────────────────────────────── */

export function openEditCourseModal(courseId) {
  const course = coursesCache.find((c) => c.id === courseId);
  if (!course) {
    alert('Could not find course.');
    return;
  }

  document.getElementById('ec-id').value = course.id;
  document.getElementById('ec-code-label').textContent = course.course_code
    ? 'Course code: ' + course.course_code
    : '';
  document.getElementById('ec-service').value = course.service || 'language course';
  document.getElementById('ec-level').value = course.level || '';
  document.getElementById('ec-group').value = course.group_type || 'private';
  document.getElementById('ec-status').value = course.status || 'active';
  document.getElementById('ec-sessions').value =
    course.sessions_total !== null && course.sessions_total !== undefined
      ? course.sessions_total
      : '';
  document.getElementById('ec-session-length').value = course.session_length_minutes || '';
  document.getElementById('ec-price').value =
    course.price_per_session !== null && course.price_per_session !== undefined
      ? course.price_per_session
      : '';
  document.getElementById('ec-currency').value = course.currency || 'CHF';
  document.getElementById('ec-location').value = course.location || '';

  const msg = document.getElementById('ec-msg');
  msg.style.display = 'none';
  msg.textContent = '';
  const btn = document.getElementById('ec-submit');
  btn.textContent = 'save changes';
  btn.disabled = false;

  document.getElementById('edit-course-modal').classList.add('open');
}

export function closeEditCourseModal() {
  document.getElementById('edit-course-modal').classList.remove('open');
}

export async function submitEditCourse() {
  const btn = document.getElementById('ec-submit');
  const msg = document.getElementById('ec-msg');
  msg.style.display = 'none';

  const courseId = document.getElementById('ec-id').value;
  if (!courseId) return;

  const sessionsVal = document.getElementById('ec-sessions').value;
  const lengthVal = document.getElementById('ec-session-length').value;
  const priceVal = document.getElementById('ec-price').value;

  const body = {
    course_id: courseId,
    service: document.getElementById('ec-service').value,
    level: document.getElementById('ec-level').value || null,
    group_type: document.getElementById('ec-group').value,
    status: document.getElementById('ec-status').value,
    sessions_total: sessionsVal === '' ? null : parseInt(sessionsVal, 10),
    session_length_minutes: lengthVal === '' ? null : parseInt(lengthVal, 10),
    price_per_session: priceVal === '' ? null : parseFloat(priceVal),
    currency: document.getElementById('ec-currency').value || 'CHF',
    location: document.getElementById('ec-location').value || null,
  };

  btn.textContent = 'saving…';
  btn.disabled = true;

  try {
    const res = await apiFetch('/api/update-course', { method: 'PATCH', body });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Unknown error');

    msg.textContent = 'Course updated.';
    msg.className = 'modal-msg success';
    btn.textContent = 'saved ✓';

    setTimeout(() => {
      closeEditCourseModal();
      loadCourses(currentCourseFilter);
    }, MESSAGE_TIMEOUT_MS);
  } catch (err) {
    msg.textContent = 'Error: ' + err.message;
    msg.className = 'modal-msg err';
    msg.style.display = 'block';
    btn.textContent = 'save changes';
    btn.disabled = false;
  }
}

export async function submitAddParticipant() {
  const btn = document.getElementById('ap-submit');
  const msgEl = document.getElementById('ap-msg');
  msgEl.style.display = 'none';
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

  try {
    const res = await apiFetch('/api/add-enrollment', { method: 'POST', body });
    if (!res.ok) {
      const e = await res.json();
      throw new Error(e.error || 'Failed');
    }
    btn.textContent = 'added ✓';
    setTimeout(() => {
      closeAddParticipantModal();
      loadCourses(currentCourseFilter);
    }, 1000);
  } catch (err) {
    msgEl.textContent = 'Error: ' + err.message;
    msgEl.style.display = 'block';
    btn.textContent = 'add';
    btn.disabled = false;
  }
}

/* ── Email: course confirmation + schedule updates ───────────────── */
function studentDisplayName(s) {
  return [s.first_name, s.last_name].filter(Boolean).join(' ') || '—';
}

function upcomingSessions(course) {
  return (course.sessions || [])
    .filter((s) => s.status !== 'cancelled')
    .slice()
    .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
}

export async function sendCourseConfirmation(courseId) {
  const course = coursesCache.find((c) => String(c.id) === String(courseId));
  if (!course) {
    alert('Course not found. Please reload and try again.');
    return;
  }
  const recipients = (course.students || [])
    .filter((s) => s.email)
    .map((s) => ({ name: studentDisplayName(s), email: s.email }));
  if (!recipients.length) {
    alert('No enrolled students with an email address.');
    return;
  }

  const sessions = upcomingSessions(course);
  const sessionListHtml = sessions.length
    ? `<ol class="cs-session-list">${sessions
        .map((s) => `<li>${esc(fmtDate(s.scheduled_at))}</li>`)
        .join('')}</ol>`
    : '<p class="cs-empty">No lessons scheduled yet.</p>';

  const contentHtml = `
    <p class="cs-section-label">course overview</p>
    <ul class="cs-detail-list">
      <li>Code: ${esc(course.course_code || '—')}</li>
      <li>Subject: ${esc(course.service || '—')}</li>
      <li>Level: ${esc(course.level || '—')}</li>
      <li>Sessions: ${course.sessions_total ? esc(String(course.sessions_total)) : 'open-ended'}</li>
      <li>Location: ${esc(course.location || '—')}</li>
    </ul>
    <p class="cs-section-label">scheduled lessons (${sessions.length})</p>
    ${sessionListHtml}
    <p class="cs-section-label">also included</p>
    <ul class="cs-detail-list">
      <li>24-hour cancellation policy</li>
      <li>AGB (terms &amp; conditions)</li>
    </ul>
  `;

  openConfirmSend({
    title: 'send course confirmation',
    recipients,
    subject: `Kursbestätigung — ${course.course_code || 'Ihr Kurs'} · learning with gioia`,
    contentHtml,
    onConfirm: async () => {
      const msg = document.getElementById('confirm-msg-' + courseId);
      const res = await apiFetch('/api/send-course-confirmation', {
        method: 'POST',
        body: { course_id: courseId },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      const label = `sent to ${body.sent || 0}` + (body.failed ? ` · ${body.failed} failed` : '');
      if (msg) showMessage(msg, label);
    },
  });
}

export function openCertificateModal(courseId) {
  return openCertificates(courseId, coursesCache);
}

export async function sendStudentSchedule(studentId, courseId) {
  const course = coursesCache.find((c) => String(c.id) === String(courseId));
  if (!course) {
    alert('Course not found. Please reload and try again.');
    return;
  }
  const student = (course.students || []).find((s) => String(s.id) === String(studentId));
  if (!student || !student.email) {
    alert('Student has no email address on file.');
    return;
  }

  const sessions = upcomingSessions(course);
  const sessionListHtml = sessions.length
    ? `<ol class="cs-session-list">${sessions
        .map((s) => `<li>${esc(fmtDate(s.scheduled_at))}</li>`)
        .join('')}</ol>`
    : '<p class="cs-empty">No upcoming lessons currently scheduled.</p>';

  const contentHtml = `
    <p class="cs-section-label">updated schedule for ${esc(course.course_code || 'course')} (${sessions.length})</p>
    ${sessionListHtml}
  `;

  openConfirmSend({
    title: 'send schedule update',
    recipients: [{ name: studentDisplayName(student), email: student.email }],
    subject: `Aktualisierter Lektionsplan${course.course_code ? ' (' + course.course_code + ')' : ''} — learning with gioia`,
    contentHtml,
    onConfirm: async () => {
      const msg = document.getElementById('schedule-msg-' + studentId);
      const res = await apiFetch('/api/send-session-schedule', {
        method: 'POST',
        body: { course_id: courseId, student_id: studentId },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      if (msg) showMessage(msg, 'schedule sent');
    },
  });
}
