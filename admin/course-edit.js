/* ── Edit course page ─────────────────────────────────────────────── */
import { initAuth, getSession } from './auth.js';
import { apiFetch } from './api.js';

function setVal(id, v) {
  const el = document.getElementById(id);
  if (el) el.value = v ?? '';
}

function populate(course) {
  document.getElementById('ec-id').value = course.id;
  document.getElementById('ec-code-label').textContent = course.course_code
    ? 'Course code: ' + course.course_code
    : '';
  setVal('ec-service', course.service || 'language course');
  setVal('ec-level', course.level || '');
  setVal('ec-group', course.group_type || 'private');
  setVal('ec-status', course.status || 'active');
  setVal(
    'ec-sessions',
    course.sessions_total !== null && course.sessions_total !== undefined
      ? course.sessions_total
      : ''
  );
  setVal('ec-session-length', course.session_length_minutes || '');
  setVal(
    'ec-price',
    course.price_per_session !== null && course.price_per_session !== undefined
      ? course.price_per_session
      : ''
  );
  setVal('ec-currency', course.currency || 'CHF');
  setVal('ec-location', course.location || '');
}

async function handleSubmit(e) {
  e.preventDefault();
  const btn = document.getElementById('ec-submit');
  const msgEl = document.getElementById('ec-msg');
  msgEl.style.display = 'none';

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

    msgEl.textContent = 'Course updated.';
    msgEl.className = 'modal-msg success';
    msgEl.style.display = 'block';
    btn.textContent = 'saved ✓';

    setTimeout(() => {
      window.location.href = '/admin.html#courses';
    }, 1500);
  } catch (err) {
    msgEl.textContent = 'Error: ' + err.message;
    msgEl.className = 'modal-msg err';
    msgEl.style.display = 'block';
    btn.textContent = 'save changes';
    btn.disabled = false;
  }
}

(async function init() {
  try {
    await initAuth();
  } catch {
    window.location.href = '/admin.html';
    return;
  }
  const session = await getSession();
  if (!session) {
    window.location.href = '/admin.html';
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  if (!id) {
    window.location.href = '/admin.html#courses';
    return;
  }

  try {
    const res = await apiFetch('/api/get-courses?status=all');
    if (!res.ok) throw new Error();
    const courses = await res.json();
    const course = courses.find((c) => c.id === id);
    if (!course) throw new Error('Course not found');
    populate(course);
  } catch {
    document.getElementById('page-loading').innerHTML =
      '<p class="loading-state">Could not load course.</p>';
    return;
  }

  document.getElementById('course-edit-form').addEventListener('submit', handleSubmit);

  document.getElementById('page-loading').style.display = 'none';
  document.getElementById('page-content').style.display = '';
})();
