/* ── Excel import/export for students ─────────────────────────────── */
import { apiFetch } from '../core/api.js';
import { esc } from '../core/helpers.js';
import { loadStudents, getCurrentStudentFilter } from './students.js';
import { MESSAGE_TIMEOUT_MS } from '../core/constants.js';

const SHEETJS_SRC = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';

// Columns surfaced in exports and accepted on import. Kept in sync with the
// student modal + the save-student allow-list on the backend.
const COLUMNS = [
  'first_name',
  'last_name',
  'gender',
  'gender_note',
  'email',
  'phone',
  'street',
  'street_number',
  'postcode',
  'city',
  'emergency_contact',
  'ec_relationship',
  'ec_phone',
  'ec_email',
  'billing_name',
  'billing_email',
  'billing_phone',
  'billing_street',
  'billing_street_number',
  'billing_postcode',
  'billing_city',
  'vat_number',
  'payment_method',
  'progress_notes',
  'status',
];

let sheetJsPromise = null;
let parsedImportRows = null;

function loadSheetJS() {
  if (sheetJsPromise) return sheetJsPromise;
  sheetJsPromise = new Promise((resolve, reject) => {
    if (window.XLSX) return resolve(window.XLSX);
    const s = document.createElement('script');
    s.src = SHEETJS_SRC;
    s.onload = () => (window.XLSX ? resolve(window.XLSX) : reject(new Error('XLSX not loaded')));
    s.onerror = () => reject(new Error('Failed to load SheetJS'));
    document.head.appendChild(s);
  });
  return sheetJsPromise;
}

/* ── Export ──────────────────────────────────────────────────────── */

export async function exportStudents() {
  const btn = document.getElementById('students-export-btn');
  if (btn) btn.disabled = true;
  try {
    const XLSX = await loadSheetJS();
    const status = getCurrentStudentFilter();
    const qs = status !== 'all' ? `?status=${status}` : '';
    const res = await apiFetch('/api/get-students' + qs);
    if (!res.ok) throw new Error('Could not fetch students');
    const list = await res.json();

    // The list endpoint returns a slim view; fetch full records in parallel
    // so the export includes billing, emergency contact, etc.
    const full = await Promise.all(
      list.map((s) =>
        apiFetch('/api/get-student-detail?id=' + s.id)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
      )
    );

    const rows = full.filter(Boolean).map((s) => {
      const row = {};
      for (const col of COLUMNS) row[col] = s[col] ?? '';
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(rows, { header: COLUMNS });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'students');
    const filename = `students-${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, filename);
  } catch (err) {
    console.error('Export error:', err);
    alert('Export failed: ' + err.message);
  } finally {
    if (btn) btn.disabled = false;
  }
}

/* ── Import ──────────────────────────────────────────────────────── */

export function openImportModal() {
  parsedImportRows = null;
  const modal = document.getElementById('import-modal');
  document.getElementById('import-file').value = '';
  document.getElementById('import-preview').innerHTML = '';
  const btn = document.getElementById('import-submit');
  btn.disabled = true;
  btn.textContent = 'import';
  const msg = document.getElementById('import-msg');
  msg.style.display = 'none';
  msg.textContent = '';
  modal.classList.add('open');
}

export function closeImportModal() {
  document.getElementById('import-modal').classList.remove('open');
  parsedImportRows = null;
}

export async function handleImportFile() {
  const inputEl = document.getElementById('import-file');
  const file = inputEl?.files?.[0];
  const preview = document.getElementById('import-preview');
  const submit = document.getElementById('import-submit');
  const msg = document.getElementById('import-msg');
  msg.style.display = 'none';
  if (!file) {
    preview.innerHTML = '';
    submit.disabled = true;
    return;
  }
  try {
    const XLSX = await loadSheetJS();
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
    if (!rows.length) throw new Error('The first sheet is empty');

    // Keep only recognised columns; require at least first_name.
    const cleaned = rows
      .map((r) => {
        const out = {};
        for (const col of COLUMNS) {
          const v = r[col];
          if (v !== undefined && v !== '') out[col] = typeof v === 'string' ? v.trim() : v;
        }
        return out;
      })
      .filter((r) => r.first_name);

    if (!cleaned.length)
      throw new Error('No rows with a first_name column were found in the first sheet');

    parsedImportRows = cleaned;
    const total = cleaned.length;
    const sample = cleaned.slice(0, 5);
    preview.innerHTML = `
      <p class="detail-muted" style="font-size:0.78rem;margin-bottom:0.4rem;">
        ${total} row${total === 1 ? '' : 's'} ready to import. Showing first ${sample.length}:
      </p>
      <div style="overflow-x:auto;max-height:240px;">
        <table class="admin-course-table" style="min-width:520px;">
          <thead><tr><th>first_name</th><th>last_name</th><th>email</th><th>phone</th><th>status</th></tr></thead>
          <tbody>
            ${sample
              .map(
                (r) => `
              <tr>
                <td>${esc(r.first_name || '')}</td>
                <td>${esc(r.last_name || '')}</td>
                <td>${esc(r.email || '')}</td>
                <td>${esc(r.phone || '')}</td>
                <td>${esc(r.status || '')}</td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>`;
    submit.disabled = false;
  } catch (err) {
    console.error('Import parse error:', err);
    preview.innerHTML = '';
    parsedImportRows = null;
    submit.disabled = true;
    msg.textContent = 'Could not read file: ' + err.message;
    msg.className = 'modal-msg err';
    msg.style.display = 'block';
  }
}

export async function submitImport() {
  if (!parsedImportRows?.length) return;
  const btn = document.getElementById('import-submit');
  const msg = document.getElementById('import-msg');
  msg.style.display = 'none';
  btn.disabled = true;
  btn.textContent = 'importing…';
  try {
    const res = await apiFetch('/api/import-students', {
      method: 'POST',
      body: { rows: parsedImportRows },
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Import failed');
    msg.textContent = `Imported: ${result.created} new, ${result.updated} updated, ${result.skipped} skipped.`;
    msg.className = 'modal-msg success';
    msg.style.display = 'block';
    btn.textContent = 'done';
    setTimeout(() => {
      closeImportModal();
      loadStudents(getCurrentStudentFilter());
    }, MESSAGE_TIMEOUT_MS);
  } catch (err) {
    msg.textContent = 'Error: ' + err.message;
    msg.className = 'modal-msg err';
    msg.style.display = 'block';
    btn.textContent = 'import';
    btn.disabled = false;
  }
}
