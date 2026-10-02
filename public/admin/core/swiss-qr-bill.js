/* ── Swiss QR-bill data (SIX Implementation Guidelines QR-bill v2.3) ─────── */
// Pure helpers with no DOM and no dependencies, so they load in the admin
// browser bundle, in Pages Functions and in `node --test` alike.
//
// Rules encoded here (IG v2.3, in force since 21 Nov 2025):
// - structured addresses only (type "S"); the combined type "K" is rejected
// - a QR-IBAN (IID 30000–31999) requires a 27-digit QR reference (QRR) with a
//   modulo-10 recursive check digit; a normal IBAN must not carry one
// - amount 0.01–999999999.99 with two decimals, currency CHF or EUR
// - field limits: name 70, street 70, building number 16, postcode 16,
//   town 35, country 2, unstructured message 140, whole payload 997 chars

export const QR_BILL_MAX_PAYLOAD_LENGTH = 997;

export const QR_BILL_FIELD_LIMITS = Object.freeze({
  name: 70,
  street: 70,
  buildingNumber: 16,
  postalCode: 16,
  city: 35,
  country: 2,
  message: 140,
});

const MIN_AMOUNT = 0.01;
const MAX_AMOUNT = 999999999.99;
const CURRENCIES = ['CHF', 'EUR'];
const INVOICE_NUMBER_RE = /^LWG-(\d{4})-(\d{4})$/;

/* ── Check digits ────────────────────────────────────────────────── */

// Modulo 10, recursive (as used for the ESR and the QR reference).
const MOD10_TABLE = [0, 9, 4, 6, 8, 2, 7, 1, 3, 5];

export function mod10Recursive(digits) {
  const value = String(digits ?? '');
  if (!/^\d*$/.test(value)) throw new Error('mod10Recursive: digits only');
  let carry = 0;
  for (const ch of value) carry = MOD10_TABLE[(carry + Number(ch)) % 10];
  return (10 - carry) % 10;
}

export function isValidQrReference(reference) {
  const value = String(reference ?? '').replace(/\s+/g, '');
  if (!/^\d{27}$/.test(value)) return false;
  return mod10Recursive(value.slice(0, 26)) === Number(value[26]);
}

// Deterministic QR reference for an invoice number: LWG-2026-0012 becomes
// 26 digits (20260012 left-padded with zeros) plus the check digit. The bank
// statement then shows "… 02026 0012c", which maps straight back to the
// invoice, so nothing has to be stored.
export function qrReferenceFromInvoiceNumber(invoiceNumber) {
  const match = String(invoiceNumber ?? '')
    .trim()
    .match(INVOICE_NUMBER_RE);
  if (!match) {
    throw new Error(`Invoice number "${invoiceNumber}" must use the format LWG-YYYY-NNNN`);
  }
  const body = (match[1] + match[2]).padStart(26, '0');
  return body + mod10Recursive(body);
}

/* ── IBAN ────────────────────────────────────────────────────────── */

export function normaliseIban(iban) {
  return String(iban ?? '')
    .replace(/\s+/g, '')
    .toUpperCase();
}

// Swiss or Liechtenstein IBAN with a valid ISO 7064 mod 97-10 checksum.
export function isValidIban(iban) {
  const value = normaliseIban(iban);
  if (!/^(CH|LI)\d{19}$/.test(value)) return false;
  const rearranged = value.slice(4) + value.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let remainder = 0;
  for (const ch of numeric) remainder = (remainder * 10 + Number(ch)) % 97;
  return remainder === 1;
}

// A QR-IBAN carries a QR-IID (30000–31999) in positions 5–9.
export function isQrIban(iban) {
  const value = normaliseIban(iban);
  if (!isValidIban(value)) return false;
  const iid = Number(value.slice(4, 9));
  return iid >= 30000 && iid <= 31999;
}

/* ── Text ────────────────────────────────────────────────────────── */

// Typographic characters the SPS character set does not cover, mapped to
// their plain equivalents before anything else is replaced with a dot.
// Built from code points so the source stays plain ASCII.
const codePoints = (...points) => new RegExp(`[${String.fromCodePoint(...points)}]`, 'g');
const TEXT_REPLACEMENTS = [
  [codePoints(0x2010, 0x2011, 0x2012, 0x2013, 0x2014, 0x2015, 0x2212), '-'],
  [codePoints(0x2018, 0x2019, 0x201a, 0x2032), "'"],
  [codePoints(0x201c, 0x201d, 0x201e, 0x2033), '"'],
  [codePoints(0x2026), '...'],
  [codePoints(0x00a0, 0x2007, 0x202f, 0x2009, 0x200a, 0x2002, 0x2003), ' '],
];

// Latin character set permitted in a QR-bill (SPS 2.3 extended set): printable
// ASCII, Latin-1 Supplement, Latin Extended-A and the euro sign.
const ALLOWED_CHAR_RE = /[ -~¡-ÿĀ-ſ€]/;

// Normalises a free-text value for the payload: NFC, typographic substitutes,
// control characters dropped, unsupported characters replaced by ".", then
// trimmed and cut to `maxLength`.
export function normaliseText(value, maxLength = Infinity) {
  let text = String(value ?? '').normalize('NFC');
  for (const [pattern, replacement] of TEXT_REPLACEMENTS) text = text.replace(pattern, replacement);
  text = Array.from(text)
    .map((ch) => {
      const code = ch.codePointAt(0);
      if (code < 0x20 || code === 0x7f) return ' ';
      return ALLOWED_CHAR_RE.test(ch) ? ch : '.';
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > maxLength ? text.slice(0, maxLength).trim() : text;
}

/* ── Parties ─────────────────────────────────────────────────────── */

function normaliseParty(party, role) {
  if (!party) return null;
  const limits = QR_BILL_FIELD_LIMITS;
  const normalised = {
    name: normaliseText(party.name, limits.name),
    street: normaliseText(party.street, limits.street),
    buildingNumber: normaliseText(party.buildingNumber, limits.buildingNumber),
    postalCode: normaliseText(party.postalCode, limits.postalCode),
    city: normaliseText(party.city, limits.city),
    country: String(party.country ?? '')
      .trim()
      .toUpperCase(),
  };
  const missing = ['name', 'postalCode', 'city', 'country'].filter((key) => !normalised[key]);
  if (missing.length) throw new Error(`${role}: missing ${missing.join(', ')}`);
  if (!/^[A-Z]{2}$/.test(normalised.country)) {
    throw new Error(`${role}: country must be a two-letter ISO code`);
  }
  return normalised;
}

function partyLines(party) {
  if (!party) return ['', '', '', '', '', '', ''];
  return [
    'S',
    party.name,
    party.street,
    party.buildingNumber,
    party.postalCode,
    party.city,
    party.country,
  ];
}

function firstFilled(...values) {
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (text) return text;
  }
  return '';
}

// Builds the debtor ("Zahlbar durch") from a student row, preferring the
// billing_* fields whenever any of them is set — the same precedence the
// invoice address block uses. Returns null when the address is incomplete,
// in which case the bill shows a blank box the payer fills in by hand.
// The country comes from the student's billing_country / country columns;
// `fallbackCountry` covers rows saved before those columns existed.
export function debtorFromStudent(student, fallbackCountry = 'CH') {
  if (!student) return null;
  const useBilling = Boolean(
    firstFilled(
      student.billing_name,
      student.billing_street,
      student.billing_street_number,
      student.billing_postcode,
      student.billing_city
    )
  );
  const ownName = [student.first_name, student.last_name]
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join(' ');
  const debtor = useBilling
    ? {
        name: firstFilled(student.billing_name, ownName),
        street: firstFilled(student.billing_street),
        buildingNumber: firstFilled(student.billing_street_number),
        postalCode: firstFilled(student.billing_postcode),
        city: firstFilled(student.billing_city),
        country: firstFilled(student.billing_country, student.country, fallbackCountry),
      }
    : {
        name: ownName,
        street: firstFilled(student.street),
        buildingNumber: firstFilled(student.street_number),
        postalCode: firstFilled(student.postcode),
        city: firstFilled(student.city),
        country: firstFilled(student.country, fallbackCountry),
      };
  if (!debtor.name || !debtor.postalCode || !debtor.city) return null;
  return { ...debtor, country: debtor.country.toUpperCase() };
}

/* ── Amount ──────────────────────────────────────────────────────── */

function normaliseAmount(amount) {
  if (amount === null || amount === undefined || amount === '') return null;
  const value = typeof amount === 'number' ? amount : Number(String(amount).replace(/[',\s]/g, ''));
  if (!Number.isFinite(value)) throw new Error('Amount is not a number');
  const rounded = Math.round(value * 100) / 100;
  if (rounded < MIN_AMOUNT || rounded > MAX_AMOUNT) {
    throw new Error(`Amount must be between ${MIN_AMOUNT} and ${MAX_AMOUNT}`);
  }
  return rounded;
}

/* ── Payload ─────────────────────────────────────────────────────── */

// Validates and normalises the bill data and returns it together with the
// Swiss QR Code payload (31 lines, LF separated, trailer "EPD").
export function prepareQrBill({
  iban,
  creditor,
  debtor = null,
  amount = null,
  currency = 'CHF',
  reference = '',
  message = '',
} = {}) {
  const ibanClean = normaliseIban(iban);
  if (!isValidIban(ibanClean)) throw new Error('Invalid Swiss IBAN');
  const qrIban = isQrIban(ibanClean);

  const referenceClean = String(reference ?? '').replace(/\s+/g, '');
  let referenceType = 'NON';
  if (referenceClean) {
    if (!isValidQrReference(referenceClean)) throw new Error('Invalid QR reference');
    if (!qrIban) throw new Error('A QR reference requires a QR-IBAN');
    referenceType = 'QRR';
  } else if (qrIban) {
    throw new Error('A QR-IBAN requires a QR reference');
  }

  const currencyClean = String(currency ?? '')
    .trim()
    .toUpperCase();
  if (!CURRENCIES.includes(currencyClean)) throw new Error('Currency must be CHF or EUR');

  const bill = {
    iban: ibanClean,
    creditor: normaliseParty(creditor, 'Creditor'),
    debtor: normaliseParty(debtor, 'Debtor'),
    amount: normaliseAmount(amount),
    currency: currencyClean,
    referenceType,
    reference: referenceClean,
    message: normaliseText(message, QR_BILL_FIELD_LIMITS.message),
  };

  const lines = [
    'SPC',
    '0200',
    '1',
    bill.iban,
    ...partyLines(bill.creditor),
    ...partyLines(null), // ultimate creditor: not permitted, always empty
    bill.amount === null ? '' : bill.amount.toFixed(2),
    bill.currency,
    ...partyLines(bill.debtor),
    bill.referenceType,
    bill.reference,
    bill.message,
    'EPD',
  ];
  bill.payload = lines.join('\n');
  if (bill.payload.length > QR_BILL_MAX_PAYLOAD_LENGTH) {
    throw new Error(`QR payload exceeds ${QR_BILL_MAX_PAYLOAD_LENGTH} characters`);
  }
  return bill;
}

export function buildQrBillPayload(input) {
  return prepareQrBill(input).payload;
}

/* ── Display formatting (payment part and receipt) ───────────────── */

export function formatIban(iban) {
  return normaliseIban(iban).replace(/(.{4})(?=.)/g, '$1 ');
}

// QR reference: 2 digits, then blocks of 5 ("21 00000 00003 13947 14300 09017").
export function formatQrReference(reference) {
  const value = String(reference ?? '').replace(/\s+/g, '');
  if (!value) return '';
  return [value.slice(0, 2), ...(value.slice(2).match(/.{1,5}/g) || [])].join(' ');
}

// Two decimals, thousands separated by a space ("1 234.50").
export function formatAmount(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return '';
  const [whole, fraction] = value.toFixed(2).split('.');
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}.${fraction}`;
}

/* ── Labels ──────────────────────────────────────────────────────── */

const LABELS = {
  de: {
    receipt: 'Empfangsschein',
    paymentPart: 'Zahlteil',
    account: 'Konto / Zahlbar an',
    reference: 'Referenz',
    additionalInfo: 'Zusätzliche Informationen',
    payableBy: 'Zahlbar durch',
    payableByBlank: 'Zahlbar durch (Name/Adresse)',
    currency: 'Währung',
    amount: 'Betrag',
    acceptancePoint: 'Annahmestelle',
    separate: 'Vor der Einzahlung abzutrennen',
  },
  en: {
    receipt: 'Receipt',
    paymentPart: 'Payment part',
    account: 'Account / Payable to',
    reference: 'Reference',
    additionalInfo: 'Additional information',
    payableBy: 'Payable by',
    payableByBlank: 'Payable by (name/address)',
    currency: 'Currency',
    amount: 'Amount',
    acceptancePoint: 'Acceptance point',
    separate: 'Separate before paying in',
  },
};

export function qrBillLabels(lang = 'de') {
  return LABELS[lang] || LABELS.de;
}

// Address lines as printed on the bill: name, street + number, postcode + town.
// Following the SIX style guide, foreign addresses carry the country code in
// front of the postcode ("DE-80331 München"); Swiss ones print it plainly.
export function partyDisplayLines(party) {
  if (!party) return [];
  const country = String(party.country ?? '')
    .trim()
    .toUpperCase();
  const postalCode =
    party.postalCode && country && country !== 'CH'
      ? `${country}-${party.postalCode}`
      : party.postalCode;
  return [
    party.name,
    [party.street, party.buildingNumber].filter(Boolean).join(' '),
    [postalCode, party.city].filter(Boolean).join(' '),
  ].filter(Boolean);
}
