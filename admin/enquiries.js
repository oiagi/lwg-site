/* ── Enquiries tab ────────────────────────────────────────────────── */
import { apiFetch } from './api.js';
import { fmt, dl, esc } from './helpers.js';
import { populateTeacherSelects, loadTeachers, authoriseTeacher } from './teachers.js';

let currentFilter = 'all';

export function init() {
  const panel = document.getElementById('panel-enquiries');
  panel.querySelectorAll('.filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      panel.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.status;
      loadEnquiries(currentFilter);
    });
  });
}

export async function loadEnquiries(status, probe = false) {
  const qs = status && status !== 'all' ? `?status=${status}` : '';
  try {
    const res = await apiFetch(`/api/get-enquiries${qs}`);
    if (res.status === 401) return false;
    if (!res.ok) return false;
    const data = await res.json();
    if (!probe) renderEnquiries(data);
    return true;
  } catch {
    return false;
  }
}

function renderBookingDetails(b) {
  if (!b) return '';
  const rows = [];
  const labelMap = {
    language: 'Language',
    background: 'Background',
    level: 'Level',
    exam: 'Exam',
    examDate: 'Exam date',
    frequency: 'Frequency',
    format: 'Format',
    location: 'Location',
    group: 'Group size',
    grades: 'School year',
    subjects: 'Subjects',
    days: 'Preferred days',
    timeOfDay: 'Time of day',
    notes: 'Scheduling notes',
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
    ${dl('Name', [lead.firstName, lead.lastName].filter(Boolean).join(' '))}
    ${dl('Email', lead.email)}
    ${dl('Phone', lead.phone)}
    ${dl('Preferred contact', c.preferredContact)}`;

  /* Backward compat: old enquiries may still have these fields */
  if (lead.postcode) html += dl('Postcode', lead.postcode);
  if (c.ageGroup) html += dl('For', c.ageGroup + (c.ageRange ? ' (' + c.ageRange + ')' : ''));
  if (c.days) html += dl('Days', c.days);
  if (c.timeOfDay) html += dl('Time', c.timeOfDay);
  if (c.notes) html += dl('Notes', c.notes);

  if (c.participants && c.participants.length > 0) {
    html += `<div style="margin-top:0.6rem;font-size:0.68rem;letter-spacing:0.14em;text-transform:uppercase;color:#aaa;">Participants</div>`;
    c.participants.forEach((p, i) => {
      const name = [p.firstName, p.lastName].filter(Boolean).join(' ');
      html += `<div style="margin-top:0.4rem;font-size:0.72rem;color:#555;">
        ${i + 1}. ${esc(name) || '—'}${p.email ? ' — ' + esc(p.email) : ''}${p.phone ? ' · ' + esc(p.phone) : ''}
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

  list.innerHTML = rows
    .map((row) => {
      const status = row.status || 'new';
      const name = [row.lead_first, row.lead_last].filter(Boolean).join(' ') || '—';
      const svc = row.service || '—';
      const b = row.booking_data || {};
      const c = row.contact_data || {};
      const linkedStudent = row.student;

      return `
    <div class="enquiry-row" id="row-${row.id}">
      <div class="enquiry-summary" data-action="toggleDetail" data-args="${row.id}">
        <span class="dot ${esc(status)}"></span>
        <div>
          <div class="enq-name">${esc(name)}</div>
          <div class="enq-svc">${esc(svc)}</div>
        </div>
        <div class="enq-date">${fmt(row.created_at)}</div>
        <div class="enq-status ${esc(status)}">${esc(status)}</div>
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
              <option value="new"       ${status === 'new' ? 'selected' : ''}>new</option>
              <option value="contacted" ${status === 'contacted' ? 'selected' : ''}>contacted</option>
              <option value="confirmed" ${status === 'confirmed' ? 'selected' : ''}>confirmed</option>
              <option value="cancelled" ${status === 'cancelled' ? 'selected' : ''}>cancelled</option>
            </select>
            <button class="save-btn" data-action="saveStatus" data-args="${row.id}">save</button>
            <span class="saved-msg" id="saved-${row.id}">saved</span>
            <button class="delete-btn" data-action="deleteEnquiry" data-args="${row.id}">delete</button>
          </div>
          <div style="margin-top:0.5rem;font-size:0.75rem;color:#888;" id="student-link-${row.id}">
            ${
              linkedStudent
                ? `student: <strong style="color:#555;">${esc(linkedStudent.first_name)} ${esc(linkedStudent.last_name)}</strong>
                 <button class="action-btn" style="font-size:0.7rem;padding:0.15rem 0.5rem;margin-left:0.5rem;"
                   data-action="unlinkStudent" data-args="${row.id}">unlink</button>`
                : 'no student linked'
            }
          </div>
          <textarea class="notes-input" id="notes-${row.id}"
            placeholder="internal notes…">${esc(row.notes)}</textarea>
          <div style="margin-top:0.4rem;">
            <button class="save-btn" data-action="saveNotes" data-args="${row.id}">save notes</button>
            <span class="saved-msg" id="notes-saved-${row.id}">saved</span>
          </div>

          ${
            status !== 'confirmed' && status !== 'cancelled'
              ? `
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

            <button class="confirm-btn" data-action="confirmBooking" data-args="${row.id}">confirm booking &amp; create calendar event</button>
            <p class="confirm-msg" id="confirm-msg-${row.id}"></p>
          </div>
          `
              : ''
          }
        </div>
      </div>
    </div>`;
    })
    .join('');
  populateTeacherSelects();
}

export function toggleDetail(id) {
  const el = document.getElementById(`detail-${id}`);
  el.classList.toggle('open');
}

export async function saveStatus(id) {
  const status = document.getElementById(`status-${id}`).value;
  try {
    const res = await apiFetch('/api/update-enquiry', {
      method: 'PATCH',
      body: { id, status },
    });
    if (res.ok) {
      const msg = document.getElementById(`saved-${id}`);
      msg.style.display = 'inline';
      setTimeout(() => (msg.style.display = 'none'), 2000);
      const dot = document.querySelector(`#row-${id} .dot`);
      if (dot) {
        dot.className = `dot ${status}`;
      }
      const statusEl = document.querySelector(`#row-${id} .enq-status`);
      if (statusEl) {
        statusEl.className = `enq-status ${status}`;
        statusEl.textContent = status;
      }
    }
  } catch (e) {
    console.error(e);
  }
}

export async function saveNotes(id) {
  const notes = document.getElementById(`notes-${id}`).value;
  try {
    const res = await apiFetch('/api/update-enquiry', {
      method: 'PATCH',
      body: { id, notes },
    });
    if (res.ok) {
      const msg = document.getElementById(`notes-saved-${id}`);
      msg.style.display = 'inline';
      setTimeout(() => (msg.style.display = 'none'), 2000);
    }
  } catch (e) {
    console.error(e);
  }
}

export async function unlinkStudent(enquiryId) {
  try {
    const res = await apiFetch('/api/update-enquiry', {
      method: 'PATCH',
      body: { id: enquiryId, student_id: null },
    });
    if (!res.ok) throw new Error();
    const el = document.getElementById(`student-link-${enquiryId}`);
    if (el) el.innerHTML = 'no student linked';
  } catch {
    alert('Could not unlink student.');
  }
}

export async function deleteEnquiry(id) {
  if (!confirm('Permanently delete this enquiry? This cannot be undone.')) return;
  try {
    const res = await apiFetch('/api/delete-enquiry', {
      method: 'DELETE',
      body: { id },
    });
    if (!res.ok) throw new Error();
    const row = document.getElementById('row-' + id);
    if (row) row.remove();
  } catch {
    alert('Could not delete enquiry. Please try again.');
  }
}

export async function confirmBooking(enquiryId) {
  const teacherId = document.getElementById('confirm-teacher-' + enquiryId)?.value;
  const datetimeVal = document.getElementById('confirm-datetime-' + enquiryId)?.value;
  const sessionsVal = document.getElementById('confirm-sessions-' + enquiryId)?.value;
  const msgEl = document.getElementById('confirm-msg-' + enquiryId);
  const btn = document.querySelector('#confirm-panel-' + enquiryId + ' .confirm-btn');

  if (!teacherId || !datetimeVal) {
    msgEl.textContent = 'Please select a teacher and set a date and time.';
    msgEl.className = 'confirm-msg err';
    msgEl.style.display = 'block';
    return;
  }

  btn.textContent = 'confirming…';
  btn.disabled = true;
  msgEl.style.display = 'none';

  try {
    const res = await apiFetch('/api/confirm-booking', {
      method: 'POST',
      body: {
        enquiry_id: enquiryId,
        teacher_id: teacherId,
        sessions_total: sessionsVal ? parseInt(sessionsVal) : null,
        first_session_at: new Date(datetimeVal).toISOString(),
        duration_minutes: 50,
      },
    });

    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Unknown error');

    msgEl.textContent = 'Confirmed. Course: ' + result.course_code + '. Calendar event created.';
    msgEl.className = 'confirm-msg ok';
    msgEl.style.display = 'block';
    btn.textContent = 'confirmed ✓';

    const statusEl = document.querySelector('#row-' + enquiryId + ' .enq-status');
    if (statusEl) {
      statusEl.textContent = 'confirmed';
      statusEl.className = 'enq-status confirmed';
    }

    setTimeout(() => {
      loadEnquiries(currentFilter);
    }, 2000);
  } catch (err) {
    msgEl.textContent = 'Error: ' + err.message;
    msgEl.className = 'confirm-msg err';
    msgEl.style.display = 'block';
    btn.textContent = 'confirm booking & create calendar event';
    btn.disabled = false;
  }
}
