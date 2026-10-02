/* ── Country list (ESM wrapper) ───────────────────────────────────────
   The list itself lives in /countries.js, a classic script shared with the
   public intake and booking pages. Importing it here runs the script and
   exposes globalThis.LWG_COUNTRIES; this module re-exports it so admin
   features can import it like any other helper. The relative path resolves
   both in the browser (/admin/core/ → /countries.js) and in Node tests. */
import '../../countries.js';

export const COUNTRIES = globalThis.LWG_COUNTRIES;
export const DEFAULT_COUNTRY = COUNTRIES.DEFAULT;

export function countryName(code, lang = 'en') {
  return COUNTRIES.name(code, lang);
}

// '' for CH or empty, else the localized country name (the "only when
// abroad" rule for printed address blocks).
export function foreignCountryLine(code, lang = 'en') {
  return COUNTRIES.foreignLine(code, lang);
}
