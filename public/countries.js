// Shared country list for the student address forms (public intake / booking
// pages and the admin student modal). Loaded as a classic <script> so the
// public pages and the admin SPA share one copy via globalThis.LWG_COUNTRIES.
//
// Values are ISO 3166-1 alpha-2 codes — the same format the Swiss QR-bill
// needs for the debtor. Display names come from Intl.DisplayNames so no
// hand-written DE/EN table is needed.
(function () {
  'use strict';

  const DEFAULT = 'CH';

  // Shown first, in this order, before the alphabetical rest.
  const PRIMARY = ['CH', 'DE', 'AT', 'LI', 'FR', 'IT'];

  // Remaining European countries plus a few common destinations.
  // prettier-ignore
  const OTHERS = [
    'AL', 'AD', 'BE', 'BA', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'GR',
    'HU', 'IS', 'IE', 'XK', 'LV', 'LT', 'LU', 'MT', 'MD', 'MC', 'ME', 'NL',
    'MK', 'NO', 'PL', 'PT', 'RO', 'SM', 'RS', 'SK', 'SI', 'ES', 'SE', 'TR',
    'UA', 'GB', 'VA',
    'AU', 'BR', 'CA', 'CN', 'EG', 'IN', 'IL', 'JP', 'KR', 'MX', 'NZ', 'RU',
    'SG', 'ZA', 'AE', 'US',
  ];

  const CODES = [...PRIMARY, ...OTHERS];

  function locale(lang) {
    return lang === 'de' ? 'de' : 'en';
  }

  function name(code, lang) {
    const iso = String(code ?? '')
      .trim()
      .toUpperCase();
    if (!iso) return '';
    try {
      const display = new Intl.DisplayNames([locale(lang)], { type: 'region', fallback: 'none' });
      return display.of(iso) || iso;
    } catch {
      return iso;
    }
  }

  // Country line for printed address blocks: Swiss convention omits the
  // country for domestic addresses, so this returns '' for CH (and empty).
  function foreignLine(code, lang) {
    const iso = String(code ?? '')
      .trim()
      .toUpperCase();
    if (!iso || iso === DEFAULT) return '';
    return name(iso, lang);
  }

  function orderedCodes(lang) {
    const rest = OTHERS.map((code) => [code, name(code, lang)]).sort((a, b) =>
      a[1].localeCompare(b[1], locale(lang))
    );
    return [...PRIMARY, ...rest.map(([code]) => code)];
  }

  function populateSelect(select, lang, selected = DEFAULT) {
    if (!select) return;
    const current = String(selected ?? '')
      .trim()
      .toUpperCase();
    const codes = orderedCodes(lang);
    // Keep an unknown stored code selectable rather than silently dropping it.
    if (current && !codes.includes(current)) codes.push(current);
    select.textContent = '';
    for (const code of codes) {
      const option = document.createElement('option');
      option.value = code;
      option.textContent = name(code, lang);
      if (code === current) option.selected = true;
      select.appendChild(option);
    }
  }

  globalThis.LWG_COUNTRIES = {
    DEFAULT,
    CODES,
    name,
    foreignLine,
    orderedCodes,
    populateSelect,
  };
})();
