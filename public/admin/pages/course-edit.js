/* ── Edit course page ─────────────────────────────────────────────── */
import { initAuth, getSession } from '../core/auth.js';
import { apiFetch } from '../core/api.js';

function setVal(id, v) {
  const el = document.getElementById(id);
  if (el) el.value = v ?? '';
}

function setChecked(id, v) {
  const el = document.getElementById(id);
  if (el) el.checked = !!v;
}

const PLUSABLE_LEVELS = new Set(['A1', 'A2', 'B1', 'B2', 'C1']);
const DEFAULT_PRICE_PER_PERSON = {
  private: 120,
  duo: 70,
  group: 50,
};

function splitLevel(raw) {
  const v = (raw || '').trim();
  if (v.endsWith('+')) {
    const base = v.slice(0, -1);
    if (PLUSABLE_LEVELS.has(base)) return { base, plus: '+' };
  }
  return { base: v, plus: '' };
}

function syncPlusEnabled(baseId, plusId) {
  const baseEl = document.getElementById(baseId);
  const plusEl = document.getElementById(plusId);
  if (!baseEl || !plusEl) return;
  const enabled = PLUSABLE_LEVELS.has(baseEl.value);
  plusEl.disabled = !enabled;
  if (!enabled) plusEl.value = '';
}

function fillDefaultPerPersonPrice() {
  const groupType = document.getElementById('ec-group')?.value;
  const priceEl = document.getElementById('ec-price-person');
  if (!priceEl || priceEl.value) return;
  priceEl.value = DEFAULT_PRICE_PER_PERSON[groupType] ?? '';
}

function populate(course) {
  document.getElementById('ec-id').value = course.id;
  document.getElementById('ec-code-label').textContent = course.course_code
    ? 'Course code: ' + course.course_code
    : '';
  setVal('ec-service', course.service || 'language course');
  const { base, plus } = splitLevel(course.level);
  setVal('ec-level', base);
  setVal('ec-level-plus', plus);
  syncPlusEnabled('ec-level', 'ec-level-plus');
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
  setVal(
    'ec-price-person',
    course.price_per_person_per_60min !== null && course.price_per_person_per_60min !== undefined
      ? course.price_per_person_per_60min
      : ''
  );
  setVal('ec-currency', course.currency || 'CHF');
  setVal('ec-location', course.location || '');
  setChecked('ec-public-booking', course.public_booking_enabled);
  setVal('ec-loc-street', course.location_street || '');
  setVal('ec-loc-number', course.location_street_number || '');
  setVal('ec-loc-postal', course.location_postal_code || '');
  setVal('ec-loc-city', course.location_city || '');
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
  const pricePersonVal = document.getElementById('ec-price-person').value;

  const body = {
    course_id: courseId,
    service: document.getElementById('ec-service').value,
    level:
      document.getElementById('ec-level').value +
        (document.getElementById('ec-level-plus').value || '') || null,
    group_type: document.getElementById('ec-group').value,
    status: document.getElementById('ec-status').value,
    sessions_total: sessionsVal === '' ? null : parseInt(sessionsVal, 10),
    session_length_minutes: lengthVal === '' ? null : parseInt(lengthVal, 10),
    price_per_session: priceVal === '' ? null : parseFloat(priceVal),
    price_per_person_per_60min: pricePersonVal === '' ? null : parseFloat(pricePersonVal),
    currency: document.getElementById('ec-currency').value || 'CHF',
    location: document.getElementById('ec-location').value || null,
    location_street: document.getElementById('ec-loc-street').value.trim() || null,
    location_street_number: document.getElementById('ec-loc-number').value.trim() || null,
    location_postal_code: document.getElementById('ec-loc-postal').value.trim() || null,
    location_city: document.getElementById('ec-loc-city').value.trim() || null,
    public_booking_enabled: document.getElementById('ec-public-booking').checked,
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
      window.location.href = '/admin#courses';
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
    window.location.href = '/admin';
    return;
  }
  const session = await getSession();
  if (!session) {
    window.location.href = '/admin';
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  if (!id) {
    window.location.href = '/admin#courses';
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
  document.getElementById('ec-group').addEventListener('change', fillDefaultPerPersonPrice);
  document
    .getElementById('ec-level')
    .addEventListener('change', () => syncPlusEnabled('ec-level', 'ec-level-plus'));

  document.getElementById('page-loading').style.display = 'none';
  document.getElementById('page-content').style.display = '';
})();
