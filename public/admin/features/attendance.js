/* ── Session log modal ────────────────────────────────────────────────
   Per-session attendance capture: who was there, whether they joined
   online, and whether they only attended half the lesson. Below it,
   what the lesson covered: topic tags, PDF references (chapter / pages)
   and free notes. Everything goes out in one save-attendance request.
   Saving is the one thing that marks a session completed, so the
   course list is reloaded afterwards to pick up the new status, the
   inline lines and the updated counters.                              */
import { apiFetch } from '../core/api.js';
import { esc, studentStartsBySession } from '../core/helpers.js';
import { MESSAGE_TIMEOUT_MS } from '../core/constants.js';
import { coursesCache, loadCourses, getCurrentCourseFilter } from './courses.js';
import { getTopics, getMaterials, createTopic } from './materials.js';

let attendanceStudents = [];
let optionListenerAttached = false;

// Lesson content state. crmAvailable stays false when topics/materials
// cannot be loaded (migration not run yet); the modal then saves attendance
// only, so logging keeps working.
let crmAvailable = false;
let crmListenersAttached = false;
let topicById = new Map();
let selectedTopicIds = [];
let materialById = new Map();
const KIND_MARK = { grammar: 'G', vocabulary: 'V' };
const MAX_SUGGESTIONS = 10;

/* ── Topics ─────────────────────────────────────────────────────────── */

function renderSelectedTopics() {
  const box = document.getElementById('att-topics');
  if (!box) return;
  box.innerHTML = selectedTopicIds
    .map((id) => topicById.get(id))
    .filter(Boolean)
    .map(
      (t) => `<span class="crm-chip crm-chip--${esc(t.kind)}">
        <span class="crm-kind">${KIND_MARK[t.kind] || ''}</span>${esc(t.name)}
        <button type="button" class="crm-remove" data-action="removeSessionTopic" data-args="${esc(t.id)}" aria-label="remove ${esc(t.name)}">×</button>
      </span>`
    )
    .join('');
}

function renderTopicSuggestions() {
  const input = document.getElementById('att-topic-search');
  const box = document.getElementById('att-topic-suggest');
  if (!input || !box) return;
  const q = input.value.trim().replace(/\s+/g, ' ');
  const ql = q.toLowerCase();
  if (!ql) {
    box.innerHTML = '';
    return;
  }
  const matches = [...topicById.values()]
    .filter((t) => !t.archived && !selectedTopicIds.includes(t.id))
    .filter((t) => t.name.toLowerCase().includes(ql))
    .sort(
      (a, b) =>
        Number(!a.name.toLowerCase().startsWith(ql)) -
          Number(!b.name.toLowerCase().startsWith(ql)) || a.name.localeCompare(b.name, 'de')
    )
    .slice(0, MAX_SUGGESTIONS);
  const exact = [...topicById.values()].some((t) => t.name.toLowerCase() === ql);

  const items = matches.map(
    (t) =>
      `<button type="button" class="crm-suggest-item" data-action="addSessionTopic" data-args="${esc(t.id)}"><span class="crm-kind">${KIND_MARK[t.kind] || ''}</span>${esc(t.name)}</button>`
  );
  if (!exact) {
    items.push(
      `<button type="button" class="crm-suggest-item crm-suggest-item--new" data-action="createSessionTopic" data-args="grammar">+ add “${esc(q)}” as grammar</button>`,
      `<button type="button" class="crm-suggest-item crm-suggest-item--new" data-action="createSessionTopic" data-args="vocabulary">+ add “${esc(q)}” as vocabulary</button>`
    );
  }
  box.innerHTML = items.join('');
}

function resetTopicSearch() {
  const input = document.getElementById('att-topic-search');
  if (input) {
    input.value = '';
    input.focus();
  }
  renderTopicSuggestions();
}

export function addSessionTopic(id) {
  if (!selectedTopicIds.includes(id)) selectedTopicIds.push(id);
  renderSelectedTopics();
  resetTopicSearch();
}

export function removeSessionTopic(id) {
  selectedTopicIds = selectedTopicIds.filter((t) => t !== id);
  renderSelectedTopics();
  renderTopicSuggestions();
}

export async function createSessionTopic(kind) {
  const input = document.getElementById('att-topic-search');
  const name = input?.value.trim().replace(/\s+/g, ' ');
  if (!name) return;
  try {
    const topic = await createTopic(kind, name);
    topicById.set(topic.id, topic);
    addSessionTopic(topic.id);
  } catch (err) {
    const box = document.getElementById('att-topic-suggest');
    if (box) box.innerHTML = `<p class="crm-msg err">${esc(err.message)}</p>`;
  }
}

/* ── Materials ──────────────────────────────────────────────────────── */

function materialRow(ref) {
  return `
    <div class="crm-material-row" data-material-id="${esc(ref.material_id)}">
      <span class="crm-material-title">${esc(ref.title || materialById.get(ref.material_id)?.title || '—')}</span>
      <input type="text" class="crm-ref-input att-mat-chapter" maxlength="100" placeholder="chapter" value="${esc(ref.chapter || '')}" />
      <input type="text" class="crm-ref-input att-mat-pages" maxlength="100" placeholder="pages, e.g. 45–52" value="${esc(ref.pages || '')}" />
      <button type="button" class="crm-remove" data-action="removeSessionMaterial" aria-label="remove">×</button>
    </div>`;
}

function renderMaterialPicker() {
  const select = document.getElementById('att-material-pick');
  if (!select) return;
  const options = [...materialById.values()]
    .filter((m) => !m.archived)
    .sort((a, b) => a.title.localeCompare(b.title, 'de'))
    .map((m) => `<option value="${esc(m.id)}">${esc(m.title)}</option>`);
  select.innerHTML =
    `<option value="">${options.length ? '+ add material…' : 'no materials yet — upload them in the materials tab'}</option>` +
    options.join('');
}

export function removeSessionMaterial(el) {
  el?.closest?.('.crm-material-row')?.remove();
}

function collectMaterials() {
  return [...document.querySelectorAll('#att-materials .crm-material-row')].map((row) => ({
    material_id: row.dataset.materialId,
    chapter: row.querySelector('.att-mat-chapter')?.value.trim() || undefined,
    pages: row.querySelector('.att-mat-pages')?.value.trim() || undefined,
  }));
}

function attachCrmListeners() {
  if (crmListenersAttached) return;
  const input = document.getElementById('att-topic-search');
  const select = document.getElementById('att-material-pick');
  if (!input || !select) return;
  input.addEventListener('input', renderTopicSuggestions);
  // Enter takes the first suggestion (an existing tag, or "add as grammar").
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    document.querySelector('#att-topic-suggest .crm-suggest-item')?.click();
  });
  select.addEventListener('change', () => {
    const m = materialById.get(select.value);
    select.value = '';
    if (!m) return;
    document
      .getElementById('att-materials')
      .insertAdjacentHTML('beforeend', materialRow({ material_id: m.id, title: m.title }));
    document.querySelector('#att-materials .crm-material-row:last-child .att-mat-chapter')?.focus();
  });
  crmListenersAttached = true;
}

async function prepareCrm(session) {
  const crmBox = document.getElementById('att-crm');
  const unavailable = document.getElementById('att-crm-unavailable');
  document.getElementById('att-topic-search').value = '';
  document.getElementById('att-topic-suggest').innerHTML = '';
  document.getElementById('att-materials').innerHTML = '';
  document.getElementById('att-notes').value = session?.notes || '';
  selectedTopicIds = [];
  renderSelectedTopics();
  attachCrmListeners();

  try {
    const [topics, materials] = await Promise.all([getTopics(), getMaterials()]);
    topicById = new Map(topics.map((t) => [t.id, t]));
    materialById = new Map(materials.map((m) => [m.id, m]));
    crmAvailable = true;
  } catch {
    crmAvailable = false;
  }
  crmBox.classList.toggle('is-unavailable', !crmAvailable);
  unavailable.hidden = crmAvailable;
  if (!crmAvailable) return;

  // A session may carry tags that were archived since; keep them selectable.
  for (const t of session?.topics || []) if (!topicById.has(t.id)) topicById.set(t.id, t);
  selectedTopicIds = (session?.topics || []).map((t) => t.id);
  renderSelectedTopics();
  renderMaterialPicker();
  document.getElementById('att-materials').innerHTML = (session?.materials || [])
    .map(materialRow)
    .join('');
}

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
  document.getElementById('att-title').textContent = 'log session — ' + (dateLabel || '');
  const container = document.getElementById('att-students');
  container.innerHTML = '<p class="loading-state loading-state--compact">loading students…</p>';
  const msg = document.getElementById('att-msg');
  msg.classList.remove('is-visible-block');
  msg.textContent = '';
  const btn = document.getElementById('att-submit');
  btn.textContent = 'save session';
  btn.disabled = false;
  document.getElementById('attendance-modal').classList.add('open');
  attachOptionListener();

  try {
    const course = await findCourse(courseId);
    const session = course?.sessions?.find((s) => String(s.id) === String(sessionId));
    attendanceStudents = (course?.students || []).filter((student) =>
      studentStartsBySession(student, session)
    );
    await prepareCrm(session);

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
    const body = { session_id: sessionId, records };
    if (crmAvailable) {
      body.topic_ids = selectedTopicIds;
      body.materials = collectMaterials();
      body.notes = document.getElementById('att-notes').value;
    }
    const res = await apiFetch('/api/save-attendance', { method: 'POST', body });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Unknown error');

    if (result.errors?.length)
      throw new Error('Some entries could not be saved. Please try again.');
    msgEl.textContent = `Saved attendance for ${result.saved_count} student(s). Session marked completed.`;
    msgEl.className = 'modal-msg success';
    btn.textContent = 'saved';

    await loadCourses(getCurrentCourseFilter());
    setTimeout(() => closeAttendanceModal(), MESSAGE_TIMEOUT_MS);
  } catch (err) {
    msgEl.textContent = 'Error: ' + err.message;
    msgEl.className = 'modal-msg err';
    msgEl.classList.add('is-visible-block');
    btn.textContent = 'save session';
    btn.disabled = false;
  }
}
