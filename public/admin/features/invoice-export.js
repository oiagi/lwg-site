/* ── Invoice bulk export: ZIP of PDFs + bookkeeping spreadsheet ────────
   Both exports always cover the whole selected year, deliberately ignoring
   the status filter and the search box: an export handed to a bookkeeper
   must never silently omit invoices because of the UI state it was
   triggered from. Cancelled and storno rows are included — a credit note is
   an accounting document and belongs in the books. */
import { apiFetch } from '../core/api.js';
import { loadSheetJS } from '../core/sheetjs.js';
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

/* ── Spreadsheet ─────────────────────────────────────────────────── */

// Dates and amounts are written as real Excel dates and numbers rather than
// as text, so the accountant can sort, filter and sum them. These are the
// display formats Excel applies to them.
const DATE_FORMAT = 'DD.MM.YYYY';
const AMOUNT_FORMAT = '#,##0.00';

// Dates on a plain YYYY-MM-DD string must not go through Date's UTC parsing:
// west of Greenwich that would shift an invoice onto the previous day.
// Timestamps are reduced to the calendar day they fell on locally — an
// accounting date column is a date, not an instant.
function excelDate(value) {
  if (!value) return null;
  const plain = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  if (plain && !/[T ]\d/.test(String(value))) {
    return new Date(Number(plain[1]), Number(plain[2]) - 1, Number(plain[3]));
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function excelAmount(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

function text(value) {
  return value === null || value === undefined ? '' : String(value);
}

// One definition per column drives the header, the cell value and the number
// format, so the three can never drift apart. `ctx` carries lookups that need
// the whole set, such as resolving a storno back to the invoice it reverses.
const COLUMNS = [
  { label: 'invoice number', type: 'text', width: 17, value: (f) => invoiceNumberOf(f) },
  { label: 'status', type: 'text', width: 11, value: (f) => text(f.status) },
  { label: 'issued', type: 'date', width: 12, value: (f) => excelDate(f.issued_date) },
  { label: 'due', type: 'date', width: 12, value: (f) => excelDate(f.due_date) },
  { label: 'sent', type: 'date', width: 12, value: (f) => excelDate(f.sent_at) },
  { label: 'reminded', type: 'date', width: 12, value: (f) => excelDate(f.reminder_sent_at) },
  { label: 'cancelled', type: 'date', width: 12, value: (f) => excelDate(f.cancelled_at) },
  {
    label: 'cancels invoice',
    type: 'text',
    width: 17,
    value: (f, ctx) => (f.cancels_invoice_id ? text(ctx.numberById.get(f.cancels_invoice_id)) : ''),
  },
  {
    label: 'billing name',
    type: 'text',
    width: 24,
    value: (f) => text(f.student?.billing_name || f.student_name || ''),
  },
  { label: 'student', type: 'text', width: 22, value: (f) => text(f.student_name) },
  {
    label: 'customer reference',
    type: 'text',
    width: 18,
    value: (f) => text(f.student?.customer_reference),
  },
  {
    label: 'billing email',
    type: 'text',
    width: 26,
    value: (f) => text(f.student?.billing_email || f.student?.email || ''),
  },
  { label: 'course code', type: 'text', width: 14, value: (f) => text(f.course_code) },
  { label: 'subject', type: 'text', width: 14, value: (f) => text(f.course_subject) },
  { label: 'level', type: 'text', width: 8, value: (f) => text(f.course_level) },
  { label: 'item', type: 'text', width: 30, value: (f) => text(f.item_subject) },
  { label: 'quantity', type: 'amount', width: 10, value: (f) => excelAmount(f.item_quantity) },
  { label: 'unit price', type: 'amount', width: 12, value: (f) => excelAmount(f.item_unit_price) },
  { label: 'total', type: 'amount', width: 12, value: (f) => excelAmount(f.total_amount) },
  { label: 'currency', type: 'text', width: 9, value: (f) => text(f.currency || 'CHF') },
  { label: 'language', type: 'text', width: 9, value: (f) => text(f.invoice_language) },
];

// Pure: no DOM, no SheetJS, no network. Unit-tested in
// tests/invoice-export.test.mjs. Returns the header plus a row of real
// JS values (string | number | Date | null) per invoice.
export function buildInvoiceRows(rows) {
  const list = Array.isArray(rows) ? rows : [];
  // A storno row points at the invoice it reverses by id; bookkeeping needs
  // the human-readable number instead.
  const ctx = {
    numberById: new Map(
      list.filter((f) => f.invoice_id).map((f) => [f.invoice_id, invoiceNumberOf(f)])
    ),
  };
  const sorted = [...list].sort((a, b) => invoiceNumberOf(a).localeCompare(invoiceNumberOf(b)));
  return {
    header: COLUMNS.map((c) => c.label),
    rows: sorted.map((f) => COLUMNS.map((c) => c.value(f, ctx))),
  };
}

export async function exportInvoiceXlsx(btn) {
  const invoices = getArchiveRows();
  const year = getArchiveYear();
  if (!invoices.length) {
    setStatus(`No archived invoices for ${year}.`);
    return;
  }
  if (btn) btn.disabled = true;
  setStatus('building spreadsheet…');
  try {
    const XLSX = await loadSheetJS();
    const { header, rows } = buildInvoiceRows(invoices);
    // No cellDates: that stores dates as ISO strings (cell type "d"), which
    // Excel reads poorly. Left off, the Date objects become ordinary date
    // serials carrying the format below — what every spreadsheet expects.
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);

    // Number formats are per cell, so stamp each data cell in a typed column.
    // Blank cells are simply absent from the sheet and are skipped.
    COLUMNS.forEach((col, c) => {
      const fmt = col.type === 'date' ? DATE_FORMAT : col.type === 'amount' ? AMOUNT_FORMAT : null;
      if (!fmt) return;
      for (let r = 1; r <= rows.length; r++) {
        const cell = ws[XLSX.utils.encode_cell({ c, r })];
        if (cell) cell.z = fmt;
      }
    });

    ws['!cols'] = COLUMNS.map((c) => ({ wch: c.width }));
    // Header filter dropdowns, so a year can be sliced by status or student
    // without touching the data. (Freeze panes are not in this SheetJS build.)
    ws['!autofilter'] = {
      ref: XLSX.utils.encode_range({
        s: { c: 0, r: 0 },
        e: { c: COLUMNS.length - 1, r: rows.length },
      }),
    };

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, String(year));
    XLSX.writeFile(wb, `invoices-${year}.xlsx`);
    setStatus(`Exported ${rows.length} invoice${rows.length === 1 ? '' : 's'} to Excel.`);
  } catch (err) {
    console.error('Invoice Excel export error:', err);
    setStatus('Excel export failed: ' + err.message);
    alert('Could not build the spreadsheet: ' + err.message);
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
