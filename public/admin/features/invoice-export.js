/* ── Invoice bulk export: ZIP of PDFs + bookkeeping CSV ────────────────
   Both exports always cover the whole selected year, deliberately ignoring
   the status filter and the search box: an export handed to a bookkeeper
   must never silently omit invoices because of the UI state it was
   triggered from. Cancelled and storno rows are included — a credit note is
   an accounting document and belongs in the books. */
import { apiFetch } from '../core/api.js';
import { getArchiveRows, getArchiveYear } from './invoice-archive.js';

// UMD build; exposes window.fflate. Loaded from the same CDN as jsPDF and
// pdf-lib (see admin/index.html), which the CSP in public/_headers allows.
const FFLATE_SRC = 'https://cdn.jsdelivr.net/npm/fflate@0.8.2/umd/index.js';
const FFLATE_SRI = 'sha384-DT0Ls0mO7JmjTnT+oBuMhEJzYJO1zUqzuuMXNdnOmOQRIpN2BgSjvBV/j50NngIT';

// How many archived PDFs to pull from storage at once.
const FETCH_CONCURRENCY = 6;

let fflatePromise = null;

// Injected on first use rather than added as a fourth <script> to
// admin/index.html: nothing else in the admin needs a zip library, so the
// 32 KB stays off every other page load.
function loadFflate() {
  if (fflatePromise) return fflatePromise;
  fflatePromise = new Promise((resolve, reject) => {
    if (window.fflate) return resolve(window.fflate);
    const s = document.createElement('script');
    s.src = FFLATE_SRC;
    s.integrity = FFLATE_SRI;
    s.crossOrigin = 'anonymous';
    s.onload = () =>
      window.fflate ? resolve(window.fflate) : reject(new Error('fflate not loaded'));
    s.onerror = () => reject(new Error('Failed to load fflate'));
    document.head.appendChild(s);
  });
  return fflatePromise;
}

/* ── Shared helpers ──────────────────────────────────────────────── */

function invoiceNumberOf(file) {
  return (file.name || '').replace(/\.pdf$/i, '');
}

function setStatus(text) {
  const el = document.getElementById('invoice-export-status');
  if (el) el.textContent = text;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ── CSV ─────────────────────────────────────────────────────────── */

// Swiss/German Excel dialect: semicolon separator, CRLF rows and a UTF-8 BOM,
// so double-clicking the file opens it in columns with umlauts intact instead
// of dropping into the text-import wizard.
const CSV_SEPARATOR = ';';
const CSV_NEWLINE = '\r\n';
const CSV_BOM = '\uFEFF';

const CSV_COLUMNS = [
  'invoice_number',
  'status',
  'issued_date',
  'due_date',
  'sent_at',
  'reminder_sent_at',
  'cancelled_at',
  'cancels_invoice',
  'billing_name',
  'student_name',
  'customer_reference',
  'billing_email',
  'course_code',
  'course_subject',
  'course_level',
  'item_subject',
  'item_quantity',
  'item_unit_price',
  'total_amount',
  'currency',
  'language',
];

// DD.MM.YYYY. Not helpers.js fmtDate — that one appends a time component,
// which turns an accounting date column into a timestamp column.
//
// A plain YYYY-MM-DD is read component by component: `new Date('2026-03-04')`
// is UTC midnight, so west of Greenwich the local getters would report the
// third and book the invoice to the wrong day. Timestamps keep going through
// Date, reduced to the calendar day they fell on locally.
function csvDate(value) {
  const pad = (n) => String(n).padStart(2, '0');
  if (!value) return '';
  const str = String(value);
  const plain = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
  if (plain) return `${plain[3]}.${plain[2]}.${plain[1]}`;
  const d = new Date(str);
  if (Number.isNaN(d.getTime())) return '';
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

function csvAmount(value) {
  if (value === null || value === undefined || value === '') return '';
  const n = Number(value);
  return Number.isNaN(n) ? '' : n.toFixed(2);
}

function csvField(value) {
  const s = value === null || value === undefined ? '' : String(value);
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Pure: no DOM, no network. Unit-tested in tests/invoice-csv.test.mjs.
export function buildInvoiceCsv(rows) {
  const list = Array.isArray(rows) ? rows : [];
  // A storno row points at the invoice it reverses by id; bookkeeping needs
  // the human-readable number instead.
  const numberById = new Map(
    list.filter((f) => f.invoice_id).map((f) => [f.invoice_id, invoiceNumberOf(f)])
  );

  const sorted = [...list].sort((a, b) => invoiceNumberOf(a).localeCompare(invoiceNumberOf(b)));

  const lines = [CSV_COLUMNS.join(CSV_SEPARATOR)];
  for (const f of sorted) {
    const student = f.student || {};
    const values = [
      invoiceNumberOf(f),
      f.status ?? '',
      csvDate(f.issued_date),
      csvDate(f.due_date),
      csvDate(f.sent_at),
      csvDate(f.reminder_sent_at),
      csvDate(f.cancelled_at),
      f.cancels_invoice_id ? (numberById.get(f.cancels_invoice_id) ?? '') : '',
      student.billing_name || f.student_name || '',
      f.student_name ?? '',
      student.customer_reference ?? '',
      student.billing_email || student.email || '',
      f.course_code ?? '',
      f.course_subject ?? '',
      f.course_level ?? '',
      f.item_subject ?? '',
      csvAmount(f.item_quantity),
      csvAmount(f.item_unit_price),
      csvAmount(f.total_amount),
      f.currency || 'CHF',
      f.invoice_language ?? '',
    ];
    lines.push(values.map(csvField).join(CSV_SEPARATOR));
  }
  return CSV_BOM + lines.join(CSV_NEWLINE) + CSV_NEWLINE;
}

export function exportInvoiceCsv(btn) {
  const rows = getArchiveRows();
  const year = getArchiveYear();
  if (!rows.length) {
    setStatus(`No archived invoices for ${year}.`);
    return;
  }
  if (btn) btn.disabled = true;
  try {
    const csv = buildInvoiceCsv(rows);
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `invoices-${year}.csv`);
    setStatus(`Exported ${rows.length} invoice${rows.length === 1 ? '' : 's'} to CSV.`);
  } catch (err) {
    console.error('Invoice CSV export error:', err);
    setStatus('CSV export failed: ' + err.message);
  } finally {
    if (btn) btn.disabled = false;
  }
}

/* ── ZIP ─────────────────────────────────────────────────────────── */

// Runs `worker` over `items` with a fixed number of parallel lanes, so a year
// with hundreds of invoices does not open hundreds of sockets at once.
async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  const lanes = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await worker(items[i], i);
    }
  });
  await Promise.all(lanes);
  return results;
}

export async function downloadInvoicePdfZip(btn) {
  const year = getArchiveYear();
  if (!getArchiveRows().length) {
    setStatus(`No archived invoices for ${year}.`);
    return;
  }
  if (btn) btn.disabled = true;
  setStatus('preparing…');
  try {
    const fflate = await loadFflate();

    // Refetch rather than reuse what the panel loaded: the signed URLs carry a
    // one-hour TTL, and a tab left open past that would otherwise zip up a
    // pile of storage error pages.
    const res = await apiFetch(`/api/invoice-archive?year=${year}`);
    if (!res.ok) throw new Error('Could not refresh the invoice archive');
    const { files } = await res.json();
    if (!files.length) {
      setStatus(`No archived invoices for ${year}.`);
      return;
    }

    const failed = [];
    let done = 0;
    const fetched = await mapWithConcurrency(files, FETCH_CONCURRENCY, async (f) => {
      try {
        if (!f.signed_url) throw new Error('no download link');
        const pdfRes = await fetch(f.signed_url);
        if (!pdfRes.ok) throw new Error(`HTTP ${pdfRes.status}`);
        return new Uint8Array(await pdfRes.arrayBuffer());
      } catch (err) {
        console.error(`Could not fetch ${f.name}:`, err);
        failed.push(invoiceNumberOf(f));
        return null;
      } finally {
        setStatus(`zipping… ${++done}/${files.length}`);
      }
    });

    const entries = {};
    files.forEach((f, i) => {
      if (fetched[i]) entries[f.name] = fetched[i];
    });
    const included = Object.keys(entries).length;
    if (!included) throw new Error('None of the invoice PDFs could be downloaded');

    // level 0 (store): PDFs are already compressed, so deflating them buys
    // almost nothing and costs a long synchronous pass. Sync rather than the
    // async API on purpose — that one spawns a blob: Worker, which the CSP
    // (no worker-src, so default-src 'self') blocks.
    const zipped = fflate.zipSync(entries, { level: 0 });
    downloadBlob(new Blob([zipped], { type: 'application/zip' }), `invoices-${year}.zip`);

    setStatus(`Downloaded ${included} invoice${included === 1 ? '' : 's'} as a ZIP.`);
    if (failed.length) {
      alert(
        `The ZIP contains ${included} of ${files.length} invoices.\n\n` +
          `These could not be downloaded and were left out:\n${failed.join(', ')}`
      );
    }
  } catch (err) {
    console.error('Invoice ZIP export error:', err);
    setStatus('ZIP download failed: ' + err.message);
    alert('Could not build the ZIP: ' + err.message);
  } finally {
    if (btn) btn.disabled = false;
  }
}
