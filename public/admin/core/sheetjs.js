/* ── Shared SheetJS loader ─────────────────────────────────────────────
   Used by the student export (features/excel.js) and the invoice export
   (features/invoice-export.js). Loaded on first use and cached for the
   session, so the ~930 KB build stays off every page load that never
   exports a spreadsheet. */

// Vendored SheetJS build (npm/jsdelivr line is frozen at vulnerable 0.18.5;
// patched builds ship only via cdn.sheetjs.com, which the CSP blocks).
const SHEETJS_SRC = '/admin/vendor/xlsx.full.min.js';

let sheetJsPromise = null;

export function loadSheetJS() {
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
