/* ── New course page ──────────────────────────────────────────────── */
import { initAuth, getSession } from '../core/auth.js';
import { apiFetch } from '../core/api.js';
import { esc } from '../core/helpers.js';

let studentCache = [];
let participantCount = 1;
const prefillStudentId = new URLSearchParams(window.location.search).get('student_id');

const PLUSABLE_LEVELS = new Set(['A1', 'A2', 'B1', 'B2', 'C1']);
const DEFAULT_PRICE_PER_PERSON = {
  private: 120,
  duo: 70,
  group: 50,
};

function syncPlusEnabled(baseId, plusId) {
  const baseEl = document.getElementById(baseId);
  const plusEl = document.getElementById(plusId);
  if (!baseEl || !plusEl) return;
  const enabled = PLUSABLE_LEVELS.has(baseEl.value);
  plusEl.disabled = !enabled;
  if (!enabled) plusEl.value = '';
}

function fillDefaultPerPersonPrice() {
  const groupType = document.getElementById('nc-group')?.value;
  const priceEl = document.getElementById('nc-price-person');
  if (!priceEl || priceEl.value) return;
  priceEl.value = DEFAULT_PRICE_PER_PERSON[groupType] ?? '';
}

function setDropdownOpen(dropdownEl, inputEl, open) {
  dropdownEl.classList.toggle('is-hidden', !open);
  inputEl.setAttribute('aria-expanded', open ? 'true' : 'false');
}

/* ── Participant block ───────────────────────────────────────────── */
function renderParticipantBlock(i, showRemove = false) {
  const extraClass = i > 0 ? ' participant-block--additional' : '';
  return `
    <div class="participant-block modal-grid${extraClass}" id="nc-p-${i}" data-selected-student-id="">
      ${
        showRemove
          ? `<div class="participant-block-header">
               <span class="detail-meta detail-meta--flush">Participant ${i + 1}</span>
               <button type="button" class="remove-participant-btn" data-remove-block>remove</button>
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
          <ul id="nc-p${i}-dropdown" class="search-dropdown is-hidden" role="listbox"></ul>
        </div>
      </div>
      <div class="modal-field"><label>First name</label><input type="text" id="nc-p${i}-first" placeholder="First name"></div>
      <div class="modal-field"><label>Last name</label><input type="text" id="nc-p${i}-last" placeholder="Last name"></div>
      <div class="modal-field"><label>Email</label><input type="email" id="nc-p${i}-email" placeholder="email@example.com"></div>
      <div class="modal-field"><label>Phone</label><input type="tel" id="nc-p${i}-phone" placeholder="+41…"></div>
    </div>`;
}

function buildStudentSearch(inputEl, dropdownEl, onSelect) {
  function hide() {
    setDropdownOpen(dropdownEl, inputEl, false);
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

    setDropdownOpen(dropdownEl, inputEl, true);
  });

  inputEl.addEventListener('blur', () => setTimeout(() => hide(), 150));

  inputEl.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const first = dropdownEl.querySelector('li');
    if (first && !dropdownEl.classList.contains('is-hidden')) {
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

function applyStudentToParticipant(student, i = 0) {
  const block = document.getElementById(`nc-p-${i}`);
  if (block) block.dataset.selectedStudentId = student.id || '';
  const first = document.getElementById(`nc-p${i}-first`);
  const last = document.getElementById(`nc-p${i}-last`);
  const email = document.getElementById(`nc-p${i}-email`);
  const phone = document.getElementById(`nc-p${i}-phone`);
  const search = document.getElementById(`nc-p${i}-search`);
  if (first) first.value = student.first_name || '';
  if (last) last.value = student.last_name || '';
  if (email) email.value = student.email || '';
  if (phone) phone.value = student.phone || '';
  if (search) {
    search.value = [student.first_name, student.last_name].filter(Boolean).join(' ');
  }
}

function addParticipantBlock() {
  const container = document.getElementById('nc-participants');
  const i = participantCount++;
  const wrapper = document.createElement('div');
  wrapper.innerHTML = renderParticipantBlock(i, true);
  container.appendChild(wrapper.firstElementChild);
  attachSearchListeners(i);
}

/* ── Submit ──────────────────────────────────────────────────────── */
async function handleSubmit(e) {
  e.preventDefault();
  const btn = document.getElementById('nc-submit');
  const msgEl = document.getElementById('nc-msg');
  msgEl.classList.remove('is-visible-block');

  const teacherId = document.getElementById('nc-teacher').value;
  const datetime = document.getElementById('nc-datetime').value;
  if (!teacherId || !datetime) {
    msgEl.textContent = 'Please select a teacher and set a first session date.';
    msgEl.className = 'modal-msg err';
    msgEl.classList.add('is-visible-block');
    return;
  }

  const courseType = document.getElementById('nc-course-type').value;
  const subject = document.getElementById('nc-subject').value;
  const levelBase = document.getElementById('nc-level').value;
  const levelPlus = document.getElementById('nc-level-plus').value || '';
  const level = levelBase + levelPlus;
  const groupType = document.getElementById('nc-group').value;
  const sessions = document.getElementById('nc-sessions').value;
  const sessionLength = document.getElementById('nc-session-length').value;
  const price = document.getElementById('nc-price').value;
  const pricePerson = document.getElementById('nc-price-person').value;
  const location = document.getElementById('nc-location').value;
  const locationCompany = document.getElementById('nc-loc-company').value.trim();
  const locationStreet = document.getElementById('nc-loc-street').value.trim();
  const locationNumber = document.getElementById('nc-loc-number').value.trim();
  const locationPostal = document.getElementById('nc-loc-postal').value.trim();
  const locationCity = document.getElementById('nc-loc-city').value.trim();
  const publicBookingEnabled = document.getElementById('nc-public-booking')?.checked || false;
  const singleSession = document.getElementById('nc-single-session')?.checked || false;

  const participants = [];
  document.querySelectorAll('#nc-participants .participant-block').forEach((block) => {
    const idx = block.id.replace('nc-p-', '');
    const first = document.getElementById(`nc-p${idx}-first`)?.value?.trim();
    const last = document.getElementById(`nc-p${idx}-last`)?.value?.trim();
    const email = document.getElementById(`nc-p${idx}-email`)?.value?.trim();
    const phone = document.getElementById(`nc-p${idx}-phone`)?.value?.trim();
    const selectedStudentId = block.dataset.selectedStudentId || '';
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
  btn.dataset.loading = '';

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
        price_per_person_per_60min: pricePerson ? parseFloat(pricePerson) : null,
        location: location || null,
        location_company: locationCompany || null,
        location_street: locationStreet || null,
        location_street_number: locationNumber || null,
        location_postal_code: locationPostal || null,
        location_city: locationCity || null,
        public_booking_enabled: publicBookingEnabled,
        single_session: singleSession,
        booking_data: { course_type: courseType, subject, level, group: groupType },
        contact_data: { participants },
      },
    });

    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Unknown error');

    msgEl.textContent = `Created. Course: ${result.course_code}`;
    msgEl.className = 'modal-msg success';
    msgEl.classList.add('is-visible-block');
    btn.textContent = 'created';

    setTimeout(() => {
      window.location.href = '/admin#courses';
    }, 1500);
  } catch (err) {
    msgEl.textContent = err.message || 'Something went wrong. Please try again.';
    msgEl.className = 'modal-msg err';
    msgEl.classList.add('is-visible-block');
    btn.textContent = 'create course & calendar event';
    delete btn.dataset.loading;
    btn.disabled = false;
  }
}

/* ── Init ────────────────────────────────────────────────────────── */
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

  // Load teachers
  try {
    const res = await apiFetch('/api/get-teachers');
    const teachers = res.ok ? await res.json() : [];
    const sel = document.getElementById('nc-teacher');
    sel.innerHTML =
      '<option value="">select teacher…</option>' +
      teachers
        .map(
          (t) =>
            `<option value="${esc(t.id)}" data-authorised="${t.authorised ? 'true' : 'false'}">${esc(t.name)}${!t.authorised ? ' (calendar not authorised)' : ''}</option>`
        )
        .join('');
  } catch {
    document.getElementById('nc-teacher').innerHTML =
      '<option value="">could not load teachers</option>';
  }

  // Initial participant block
  const container = document.getElementById('nc-participants');
  container.innerHTML = renderParticipantBlock(0);
  attachSearchListeners(0);

  if (prefillStudentId) {
    apiFetch('/api/get-student-detail?id=' + encodeURIComponent(prefillStudentId))
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((student) => applyStudentToParticipant(student, 0))
      .catch(() => {
        const msgEl = document.getElementById('nc-msg');
        msgEl.textContent = 'Could not prefill the selected student.';
        msgEl.className = 'modal-msg err';
        msgEl.classList.add('is-visible-block');
      });
  }

  // Load student cache for search (fire-and-forget)
  apiFetch('/api/get-students?status=all')
    .then((r) => (r.ok ? r.json() : []))
    .then((data) => {
      studentCache = data;
    })
    .catch(() => {
      studentCache = [];
    });

  // Add participant button
  document.getElementById('nc-add-participant').addEventListener('click', addParticipantBlock);

  // Toggle course-location address fields
  const addressToggle = document.getElementById('nc-toggle-address');
  const addressFields = document.getElementById('nc-address-fields');
  addressToggle.addEventListener('click', () => {
    const open = !addressFields.classList.contains('is-hidden');
    addressFields.classList.toggle('is-hidden', open);
    addressToggle.textContent = open ? '+ add address' : '− hide address';
  });

  // Remove participant delegation
  document.getElementById('nc-participants').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-remove-block]');
    if (btn) btn.closest('.participant-block')?.remove();
  });

  // Click-away to close dropdowns
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#nc-participants')) {
      document.querySelectorAll('.search-dropdown').forEach((d) => {
        d.classList.add('is-hidden');
      });
    }
  });

  document.getElementById('course-new-form').addEventListener('submit', handleSubmit);
  document.getElementById('nc-group').addEventListener('change', fillDefaultPerPersonPrice);
  document
    .getElementById('nc-level')
    .addEventListener('change', () => syncPlusEnabled('nc-level', 'nc-level-plus'));
  syncPlusEnabled('nc-level', 'nc-level-plus');
  fillDefaultPerPersonPrice();

  document.getElementById('page-loading').classList.add('is-hidden');
  document.getElementById('page-content').classList.remove('is-hidden');
})();
