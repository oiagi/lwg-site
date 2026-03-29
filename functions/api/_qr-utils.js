// functions/api/_qr-utils.js
// Swiss QR bill utilities — QR reference generation (IG QR-bill v2.3).

// ── Modulo 10 recursive (ISO 7064) check digit ───────────────────────────
// Used by Swiss QR references (26 digits + 1 check digit = 27 digits).
const MOD10_TABLE = [0, 9, 4, 6, 8, 2, 7, 1, 3, 5];

export function mod10Recursive(digits) {
  let carry = 0;
  for (const ch of digits) {
    carry = MOD10_TABLE[(carry + Number(ch)) % 10];
  }
  return (10 - carry) % 10;
}

// ── Generate a 27-digit QR reference from an invoice number ──────────────
// Input:  invoice number string, e.g. "INV-202603-001"
// Output: 27-digit numeric QR reference with Modulo 10 check digit.
//
// Strategy: strip non-digits, left-pad to 26 digits, append check digit.
export function generateQrReference(invoiceNumber) {
  const numericOnly = invoiceNumber.replace(/\D/g, '');
  const padded = numericOnly.padStart(26, '0');
  const check = mod10Recursive(padded);
  return padded + check;
}

// ── Format QR reference for display (groups of 5) ────────────────────────
export function formatQrReference(ref) {
  // "00 00000 00000 00000 00000 00001" style (2 + 5×5 groups)
  return ref.replace(/(.{2})(.{5})(.{5})(.{5})(.{5})(.{5})/, '$1 $2 $3 $4 $5 $6');
}

// ── Generate the next invoice number ─────────────────────────────────────
// Format: INV-YYYYMM-NNN (e.g. INV-202603-001)
export function nextInvoiceNumber(existingNumbers) {
  const now = new Date();
  const prefix = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-`;

  let maxSeq = 0;
  for (const num of existingNumbers) {
    if (num.startsWith(prefix)) {
      const seq = parseInt(num.slice(prefix.length), 10);
      if (seq > maxSeq) maxSeq = seq;
    }
  }
  return prefix + String(maxSeq + 1).padStart(3, '0');
}

// ── Build the Swiss QR Code payload string (IG QR-bill v2.3) ─────────────
// Returns the raw string that gets encoded into the QR code.
export function buildQrPayload({
  qrIban,
  creditorName,
  creditorStreet,
  creditorHouseNumber,
  creditorPostalCode,
  creditorCity,
  creditorCountry,
  amount,
  currency,
  debtorName,
  debtorStreet,
  debtorHouseNumber,
  debtorPostalCode,
  debtorCity,
  debtorCountry,
  qrReference,
  unstructuredMessage,
}) {
  const lines = [
    'SPC', // QR type
    '0200', // Version
    '1', // Coding type (UTF-8)
    qrIban, // IBAN / QR-IBAN
    'S', // Creditor address type (Structured)
    creditorName,
    creditorStreet || '',
    creditorHouseNumber || '',
    creditorPostalCode,
    creditorCity,
    creditorCountry || 'CH',
    '',
    '',
    '',
    '',
    '',
    '',
    '', // Ultimate creditor (not used, 7 empty fields)
    amount ? amount.toFixed(2) : '',
    currency || 'CHF',
    'S', // Debtor address type (Structured)
    debtorName || '',
    debtorStreet || '',
    debtorHouseNumber || '',
    debtorPostalCode || '',
    debtorCity || '',
    debtorCountry || 'CH',
    'QRR', // Reference type (QR Reference)
    qrReference || '',
    unstructuredMessage || '',
    'EPD', // Trailer
  ];
  return lines.join('\n');
}
