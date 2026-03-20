/* ── Teachers cache (shared between enquiries & courses) ──────────── */
import { apiFetch } from './api.js';
import { getAccessToken } from './auth.js';

let teachersCache = null;

export function clearTeachersCache() {
  teachersCache = null;
}

export async function loadTeachers() {
  if (teachersCache) return teachersCache;
  try {
    const res = await apiFetch('/api/get-teachers');
    if (!res.ok) return [];
    teachersCache = await res.json();
    return teachersCache;
  } catch {
    return [];
  }
}

export async function populateTeacherSelects() {
  const teachers = await loadTeachers();
  document.querySelectorAll('[id^="confirm-teacher-"]').forEach(sel => {
    const enquiryId = sel.id.replace('confirm-teacher-', '');
    sel.innerHTML = teachers.map(t => {
      const label = t.authorised ? t.name : t.name + ' (not authorised)';
      return `<option value="${t.id}"${!t.authorised ? ' disabled' : ''}>${label}</option>`;
    }).join('');
    if (teachers.length > 0 && !teachers[0].authorised) {
      const panel = document.getElementById('confirm-panel-' + enquiryId);
      if (panel && !panel.querySelector('.auth-note')) {
        const note = document.createElement('p');
        note.className = 'auth-note';
        note.style.cssText = 'font-size:0.72rem;color:#c0392b;margin-bottom:0.6rem;';
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

export async function authoriseTeacher(teacherId) {
  const token = await getAccessToken();
  const popup = window.open(
    '/api/auth-login?teacher_id=' + teacherId + '&token=' + encodeURIComponent(token),
    'gcal-auth', 'width=600,height=700,left=200,top=100'
  );
  const poll = setInterval(() => {
    if (popup.closed) {
      clearInterval(poll);
      clearTeachersCache();
      populateTeacherSelects();
    }
  }, 500);
}
