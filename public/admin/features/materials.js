/* ── Materials tab: PDF library and topic tags ─────────────────────────
   The library holds whole books and worksheets as PDFs in a private
   Storage bucket; a logged session references them with a chapter and
   page range. Topic tags (grammar / vocabulary) are a flat, extendable
   list. Both are cached here and shared with the session-log modal.

   Uploads go browser → Storage through a short-lived signed URL, so large
   books never pass through the Worker:
     create-material-upload → PUT file → save-material                  */
import { apiFetch } from '../core/api.js';
import { esc, fmtDate } from '../core/helpers.js';

export const TOPIC_KIND_LABELS = { grammar: 'grammar', vocabulary: 'vocabulary' };
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

let topics = null; // all topics, archived included
let materials = null; // all materials, archived included
let showArchivedMaterials = false;
let showArchivedTopics = false;
let materialQuery = '';
let listenersAttached = false;

/* ── Shared data (also used by the session-log modal) ───────────────── */

export async function getTopics(force = false) {
  if (topics && !force) return topics;
  const res = await apiFetch('/api/get-topics?include_archived=1');
  if (!res.ok) throw new Error('Could not load topics');
  topics = await res.json();
  return topics;
}

export async function getMaterials(force = false) {
  if (materials && !force) return materials;
  const res = await apiFetch('/api/get-materials?include_archived=1');
  if (!res.ok) throw new Error('Could not load materials');
  materials = await res.json();
  return materials;
}

export async function createTopic(kind, name) {
  const res = await apiFetch('/api/save-topic', { method: 'POST', body: { kind, name } });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not create topic');
  topics = [...(topics || []), data];
  return data;
}

// First page number in a free-text range like "45–52, 60".
export function firstPage(pages) {
  const m = String(pages || '').match(/\d+/);
  return m ? Number(m[0]) : null;
}

export function formatMaterialRef(ref) {
  return [ref.title, ref.chapter ? `ch. ${ref.chapter}` : '', ref.pages ? `p. ${ref.pages}` : '']
    .filter(Boolean)
    .join(' · ');
}

// Opens a PDF in a new tab, at the given page when there is one. The tab is
// opened synchronously so popup blockers allow it, then pointed at the
// signed URL once it arrives.
export async function openMaterial(materialId, page) {
  const win = window.open('', '_blank');
  try {
    const res = await apiFetch('/api/get-material-file?id=' + encodeURIComponent(materialId));
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not open file');
    const pageNum = Number(page);
    const url = data.url + (pageNum > 0 ? `#page=${pageNum}` : '');
    if (win) {
      win.opener = null;
      win.location.href = url;
    } else {
      window.location.href = url;
    }
  } catch (err) {
    if (win) win.close();
    alert(err.message);
  }
}

/* ── Tab ────────────────────────────────────────────────────────────── */

export async function loadMaterialsTab() {
  attachListeners();
  const matList = document.getElementById('materials-list');
  const topicList = document.getElementById('topics-list');
  if (matList) matList.innerHTML = '<div class="loading-state">loading…</div>';
  if (topicList) topicList.innerHTML = '<div class="loading-state">loading…</div>';
  try {
    await Promise.all([getMaterials(true), getTopics(true)]);
  } catch {
    const note =
      '<div class="loading-state">Could not load. Has the add_session_crm migration been run?</div>';
    if (matList) matList.innerHTML = note;
    if (topicList) topicList.innerHTML = note;
    return;
  }
  renderMaterials();
  renderTopics();
}

function attachListeners() {
  if (listenersAttached) return;
  const search = document.getElementById('mat-search');
  const file = document.getElementById('mat-file');
  if (!search || !file) return;
  search.addEventListener('input', () => {
    materialQuery = search.value.trim().toLowerCase();
    renderMaterials();
  });
  // Prefill the title from the file name; the user can still change it.
  file.addEventListener('change', () => {
    const title = document.getElementById('mat-title');
    const f = file.files[0];
    if (f && title && !title.value.trim()) title.value = f.name.replace(/\.pdf$/i, '');
  });
  document.getElementById('topic-new-name')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTopic();
    }
  });
  listenersAttached = true;
}

function fmtSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function setMsg(id, text, kind = '') {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.className = `crm-msg${kind ? ' ' + kind : ''}`;
}

function renderMaterials() {
  const list = document.getElementById('materials-list');
  if (!list || !materials) return;
  const rows = materials.filter(
    (m) =>
      (showArchivedMaterials || !m.archived) &&
      (!materialQuery ||
        `${m.title} ${m.file_name} ${m.description || ''}`.toLowerCase().includes(materialQuery))
  );
  if (!rows.length) {
    list.innerHTML = '<div class="empty-state">no materials here</div>';
    return;
  }
  list.innerHTML = `
    <table class="crm-table">
      <thead><tr><th>title</th><th>file</th><th>size</th><th>used</th><th>added</th><th></th></tr></thead>
      <tbody>
        ${rows
          .map((m) => {
            const id = esc(m.id);
            const used = m.usage_count
              ? `${m.usage_count} lesson${m.usage_count === 1 ? '' : 's'}`
              : '—';
            return `
        <tr class="${m.archived ? 'is-archived' : ''}">
          <td>
            <div class="crm-title">${esc(m.title)}${m.archived ? ' <span class="att-chip">archived</span>' : ''}</div>
            ${m.description ? `<div class="crm-desc">${esc(m.description)}</div>` : ''}
          </td>
          <td class="crm-file">${esc(m.file_name)}</td>
          <td>${fmtSize(m.size_bytes)}</td>
          <td>${used}</td>
          <td>${fmtDate(m.created_at)}</td>
          <td class="crm-actions">
            <button class="action-btn" data-action="openMaterial" data-args="${id}">open</button>
            <button class="action-btn" data-action="editMaterial" data-args="${id}">edit</button>
            <button class="action-btn" data-action="toggleMaterialArchived" data-args="${id}">${m.archived ? 'restore' : 'archive'}</button>
            ${
              m.usage_count
                ? ''
                : `<button class="delete-btn" data-action="deleteMaterial" data-args="${id}">delete</button>`
            }
          </td>
        </tr>`;
          })
          .join('')}
      </tbody>
    </table>`;
}

function renderTopics() {
  const list = document.getElementById('topics-list');
  if (!list || !topics) return;
  const visible = topics.filter((t) => showArchivedTopics || !t.archived);
  if (!visible.length) {
    list.innerHTML = '<div class="empty-state">no topics yet</div>';
    return;
  }
  list.innerHTML = Object.keys(TOPIC_KIND_LABELS)
    .map((kind) => {
      const ofKind = visible
        .filter((t) => t.kind === kind)
        .sort((a, b) => a.name.localeCompare(b.name, 'de'));
      if (!ofKind.length) return '';
      return `
      <div class="crm-topic-group">
        <h4 class="crm-subheading">${TOPIC_KIND_LABELS[kind]}</h4>
        ${ofKind
          .map(
            (t) => `
        <div class="crm-topic-row${t.archived ? ' is-archived' : ''}">
          <span class="crm-topic-name">${esc(t.name)}</span>
          <button class="action-btn" data-action="renameTopic" data-args="${esc(t.id)}">rename</button>
          <button class="action-btn" data-action="toggleTopicArchived" data-args="${esc(t.id)}">${t.archived ? 'restore' : 'archive'}</button>
        </div>`
          )
          .join('')}
      </div>`;
    })
    .join('');
}

export function toggleArchivedMaterials() {
  showArchivedMaterials = document.getElementById('mat-show-archived')?.checked || false;
  renderMaterials();
}

export function toggleArchivedTopics() {
  showArchivedTopics = document.getElementById('topic-show-archived')?.checked || false;
  renderTopics();
}

/* ── Upload ─────────────────────────────────────────────────────────── */

// PUT with progress: fetch() cannot report upload progress, XHR can.
function putWithProgress(url, file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', 'application/pdf');
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Upload failed (${xhr.status})`));
    xhr.onerror = () => reject(new Error('Upload failed (network error)'));
    xhr.send(file);
  });
}

export async function uploadMaterial() {
  const fileInput = document.getElementById('mat-file');
  const titleInput = document.getElementById('mat-title');
  const descInput = document.getElementById('mat-description');
  const btn = document.getElementById('mat-upload-btn');
  const file = fileInput?.files[0];

  if (!file) return setMsg('mat-upload-msg', 'Choose a PDF first.', 'err');
  if (!/\.pdf$/i.test(file.name) || (file.type && file.type !== 'application/pdf')) {
    return setMsg('mat-upload-msg', 'Only PDF files can be uploaded.', 'err');
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return setMsg('mat-upload-msg', 'The file is larger than 50 MB.', 'err');
  }
  const title = titleInput.value.trim() || file.name.replace(/\.pdf$/i, '');

  btn.disabled = true;
  try {
    setMsg('mat-upload-msg', 'preparing…');
    const prepRes = await apiFetch('/api/create-material-upload', {
      method: 'POST',
      body: { file_name: file.name, size_bytes: file.size },
    });
    const prep = await prepRes.json();
    if (!prepRes.ok) throw new Error(prep.error || 'Could not prepare upload');

    await putWithProgress(prep.upload_url, file, (pct) =>
      setMsg('mat-upload-msg', `uploading… ${pct}%`)
    );

    const saveRes = await apiFetch('/api/save-material', {
      method: 'POST',
      body: {
        title,
        description: descInput.value.trim() || undefined,
        file_path: prep.file_path,
        file_name: file.name,
        size_bytes: file.size,
      },
    });
    const saved = await saveRes.json();
    if (!saveRes.ok) throw new Error(saved.error || 'Could not save material');

    fileInput.value = '';
    titleInput.value = '';
    descInput.value = '';
    setMsg('mat-upload-msg', `"${saved.title}" added.`, 'success');
    await getMaterials(true);
    renderMaterials();
  } catch (err) {
    setMsg('mat-upload-msg', 'Error: ' + err.message, 'err');
  } finally {
    btn.disabled = false;
  }
}

/* ── Material actions ───────────────────────────────────────────────── */

async function saveMaterial(body) {
  const res = await apiFetch('/api/save-material', { method: 'POST', body });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not save');
  return data;
}

export async function editMaterial(id) {
  const m = materials?.find((x) => x.id === id);
  if (!m) return;
  const title = prompt('Title', m.title);
  if (title === null) return;
  const description = prompt('Description (optional)', m.description || '');
  if (description === null) return;
  try {
    await saveMaterial({ id, title: title.trim(), description: description.trim() });
    await getMaterials(true);
    renderMaterials();
  } catch (err) {
    alert(err.message);
  }
}

export async function toggleMaterialArchived(id) {
  const m = materials?.find((x) => x.id === id);
  if (!m) return;
  try {
    await saveMaterial({ id, archived: !m.archived });
    await getMaterials(true);
    renderMaterials();
  } catch (err) {
    alert(err.message);
  }
}

export async function deleteMaterial(id) {
  const m = materials?.find((x) => x.id === id);
  if (!m || !confirm(`Delete "${m.title}" and its PDF? This cannot be undone.`)) return;
  try {
    const res = await apiFetch('/api/delete-material', { method: 'POST', body: { id } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not delete');
    await getMaterials(true);
    renderMaterials();
  } catch (err) {
    alert(err.message);
  }
}

/* ── Topic actions ──────────────────────────────────────────────────── */

export async function addTopic() {
  const nameInput = document.getElementById('topic-new-name');
  const kind = document.getElementById('topic-new-kind')?.value || 'grammar';
  const name = nameInput?.value.trim();
  if (!name) return setMsg('topic-msg', 'Enter a topic name.', 'err');
  try {
    await createTopic(kind, name);
    nameInput.value = '';
    setMsg('topic-msg', `"${name}" added.`, 'success');
    renderTopics();
  } catch (err) {
    setMsg('topic-msg', err.message, 'err');
  }
}

async function saveTopic(body) {
  const res = await apiFetch('/api/save-topic', { method: 'POST', body });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not save');
  topics = topics.map((t) => (t.id === data.id ? data : t));
}

export async function renameTopic(id) {
  const t = topics?.find((x) => x.id === id);
  if (!t) return;
  const name = prompt('Rename topic (applies to every lesson that uses it)', t.name);
  if (name === null || !name.trim() || name.trim() === t.name) return;
  try {
    await saveTopic({ id, name: name.trim() });
    renderTopics();
  } catch (err) {
    alert(err.message);
  }
}

export async function toggleTopicArchived(id) {
  const t = topics?.find((x) => x.id === id);
  if (!t) return;
  try {
    await saveTopic({ id, archived: !t.archived });
    renderTopics();
  } catch (err) {
    alert(err.message);
  }
}
