// Run with: node --test tests/
// Covers the Swiss QR-bill data helpers in public/admin/core/swiss-qr-bill.js
// and the encoder wrapper in public/admin/core/swiss-qr-code.js. Both are
// DOM-free, so they import straight into Node.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mod10Recursive,
  isValidQrReference,
  qrReferenceFromInvoiceNumber,
  isValidIban,
  isQrIban,
  normaliseText,
  debtorFromStudent,
  prepareQrBill,
  buildQrBillPayload,
  formatIban,
  formatQrReference,
  formatAmount,
  qrBillLabels,
  partyDisplayLines,
  QR_BILL_MAX_PAYLOAD_LENGTH,
} from '../public/admin/core/swiss-qr-bill.js';
import { encodeQrBill } from '../public/admin/core/swiss-qr-code.js';

// Example accounts from the SIX Implementation Guidelines.
const QR_IBAN = 'CH4431999123000889012';
const PLAIN_IBAN = 'CH5800791123000889012';

const CREDITOR = {
  name: 'Birukoff World c/o Gioia Birukoff',
  street: 'Wildbachstrasse',
  buildingNumber: '65',
  postalCode: '8008',
  city: 'Zürich',
  country: 'CH',
};

const DEBTOR = {
  name: 'Anna Meier',
  street: 'Seestrasse',
  buildingNumber: '12a',
  postalCode: '8002',
  city: 'Zürich',
  country: 'CH',
};

function bill(overrides = {}) {
  return {
    iban: QR_IBAN,
    creditor: CREDITOR,
    debtor: DEBTOR,
    amount: 1234.5,
    currency: 'CHF',
    reference: qrReferenceFromInvoiceNumber('LWG-2026-0012'),
    message: 'Rechnung LWG-2026-0012 · Mathematik',
    ...overrides,
  };
}

/* ── Check digits and references ─────────────────────────────────── */

test('mod10Recursive matches the IG example reference', () => {
  // 21 00000 00003 13947 14300 09017
  assert.equal(mod10Recursive('21000000000313947143000901'), 7);
  assert.equal(mod10Recursive(''), 0);
  assert.throws(() => mod10Recursive('12a'));
});

test('isValidQrReference checks length and check digit', () => {
  assert.equal(isValidQrReference('210000000003139471430009017'), true);
  assert.equal(isValidQrReference('21 00000 00003 13947 14300 09017'), true);
  assert.equal(isValidQrReference('210000000003139471430009018'), false);
  assert.equal(isValidQrReference('21000000000313947143000901'), false);
  assert.equal(isValidQrReference(''), false);
});

test('qrReferenceFromInvoiceNumber is 27 digits, valid and derived from the number', () => {
  const ref = qrReferenceFromInvoiceNumber('LWG-2026-0012');
  assert.match(ref, /^\d{27}$/);
  assert.equal(isValidQrReference(ref), true);
  assert.equal(ref.slice(0, 18), '0'.repeat(18));
  assert.equal(ref.slice(18, 26), '20260012');
  assert.notEqual(ref, qrReferenceFromInvoiceNumber('LWG-2026-0013'));
  assert.throws(() => qrReferenceFromInvoiceNumber('2026-12'), /LWG-YYYY-NNNN/);
});

/* ── IBAN ─────────────────────────────────────────────────────────── */

test('isValidIban accepts CH/LI IBANs with a correct checksum only', () => {
  assert.equal(isValidIban(QR_IBAN), true);
  assert.equal(isValidIban('CH44 3199 9123 0008 8901 2'), true);
  assert.equal(isValidIban(PLAIN_IBAN), true);
  assert.equal(isValidIban('CH4431999123000889013'), false);
  assert.equal(isValidIban('DE89370400440532013000'), false);
  assert.equal(isValidIban(''), false);
});

test('isQrIban recognises the QR-IID range', () => {
  assert.equal(isQrIban(QR_IBAN), true);
  assert.equal(isQrIban(PLAIN_IBAN), false);
  assert.equal(isQrIban('CH4431999123000889013'), false);
});

/* ── Text ─────────────────────────────────────────────────────────── */

test('normaliseText keeps Latin characters, maps typography and cuts length', () => {
  assert.equal(normaliseText('  Zürich · Café  '), 'Zürich · Café');
  assert.equal(normaliseText('A – B — C − D'), 'A - B - C - D');
  assert.equal(normaliseText('„Quote“ ‘x’ …'), '"Quote" \'x\' ...');
  assert.equal(normaliseText('Math 😀 Tab\there'), 'Math . Tab here');
  assert.equal(normaliseText('abcdef', 3), 'abc');
  assert.equal(normaliseText(null), '');
});

/* ── Debtor from student ──────────────────────────────────────────── */

test('debtorFromStudent uses the student address when no billing data is set', () => {
  const debtor = debtorFromStudent({
    first_name: 'Anna',
    last_name: 'Meier',
    street: 'Seestrasse',
    street_number: '12',
    postcode: '8002',
    city: 'Zürich',
  });
  assert.deepEqual(debtor, {
    name: 'Anna Meier',
    street: 'Seestrasse',
    buildingNumber: '12',
    postalCode: '8002',
    city: 'Zürich',
    country: 'CH',
  });
});

test('debtorFromStudent prefers billing fields and falls back to the student name', () => {
  const debtor = debtorFromStudent({
    first_name: 'Anna',
    last_name: 'Meier',
    street: 'Seestrasse',
    postcode: '8002',
    city: 'Zürich',
    billing_street: 'Bahnhofstrasse',
    billing_street_number: '1',
    billing_postcode: '8001',
    billing_city: 'Zürich',
  });
  assert.equal(debtor.name, 'Anna Meier');
  assert.equal(debtor.street, 'Bahnhofstrasse');
  assert.equal(debtor.postalCode, '8001');
  const named = debtorFromStudent({
    first_name: 'Anna',
    billing_name: 'Peter Meier',
    billing_postcode: '8001',
    billing_city: 'Zürich',
  });
  assert.equal(named.name, 'Peter Meier');
});

test('debtorFromStudent returns null when name, postcode or city is missing', () => {
  assert.equal(debtorFromStudent(null), null);
  assert.equal(debtorFromStudent({ first_name: 'Anna', city: 'Zürich' }), null);
  assert.equal(debtorFromStudent({ first_name: 'Anna', postcode: '8002' }), null);
  assert.equal(debtorFromStudent({ postcode: '8002', city: 'Zürich' }), null);
});

/* ── Payload ──────────────────────────────────────────────────────── */

test('buildQrBillPayload produces the 31-line Swiss QR Code payload', () => {
  const payload = buildQrBillPayload(bill());
  const expected = [
    'SPC',
    '0200',
    '1',
    'CH4431999123000889012',
    'S',
    'Birukoff World c/o Gioia Birukoff',
    'Wildbachstrasse',
    '65',
    '8008',
    'Zürich',
    'CH',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '1234.50',
    'CHF',
    'S',
    'Anna Meier',
    'Seestrasse',
    '12a',
    '8002',
    'Zürich',
    'CH',
    'QRR',
    '000000000000000000202600126',
    'Rechnung LWG-2026-0012 · Mathematik',
    'EPD',
  ].join('\n');
  assert.equal(payload, expected);
  assert.equal(payload.split('\n').length, 31);
});

test('prepareQrBill leaves the debtor empty and the amount blank when absent', () => {
  const prepared = prepareQrBill(bill({ debtor: null, amount: null }));
  const lines = prepared.payload.split('\n');
  assert.deepEqual(lines.slice(18, 27), ['', 'CHF', '', '', '', '', '', '', '']);
  assert.equal(prepared.debtor, null);
  assert.equal(prepared.amount, null);
  assert.equal(prepared.referenceType, 'QRR');
});

test('prepareQrBill enforces the IBAN / reference pairing', () => {
  assert.throws(() => prepareQrBill(bill({ iban: PLAIN_IBAN })), /requires a QR-IBAN/);
  assert.throws(() => prepareQrBill(bill({ reference: '' })), /requires a QR reference/);
  assert.throws(() => prepareQrBill(bill({ reference: '1'.repeat(27) })), /Invalid QR reference/);
  assert.throws(() => prepareQrBill(bill({ iban: 'CH4431999123000889013' })), /Invalid Swiss IBAN/);
  const plain = prepareQrBill(bill({ iban: PLAIN_IBAN, reference: '' }));
  assert.equal(plain.referenceType, 'NON');
  assert.equal(plain.payload.split('\n')[27], 'NON');
});

test('prepareQrBill validates amount, currency and creditor', () => {
  assert.throws(() => prepareQrBill(bill({ amount: 0 })), /Amount must be/);
  assert.throws(() => prepareQrBill(bill({ amount: 1e9 })), /Amount must be/);
  assert.throws(() => prepareQrBill(bill({ amount: 'abc' })), /not a number/);
  assert.throws(() => prepareQrBill(bill({ currency: 'USD' })), /CHF or EUR/);
  assert.throws(
    () => prepareQrBill(bill({ creditor: { ...CREDITOR, postalCode: '' } })),
    /Creditor: missing postalCode/
  );
  assert.throws(
    () => prepareQrBill(bill({ creditor: { ...CREDITOR, country: 'Schweiz' } })),
    /two-letter/
  );
  assert.equal(prepareQrBill(bill({ amount: '0.05' })).payload.split('\n')[18], '0.05');
  assert.equal(prepareQrBill(bill({ amount: "1'234.5" })).payload.split('\n')[18], '1234.50');
  assert.equal(prepareQrBill(bill({ currency: 'eur' })).currency, 'EUR');
});

test('prepareQrBill truncates fields to their limits and guards the total length', () => {
  const prepared = prepareQrBill(
    bill({
      debtor: { ...DEBTOR, name: 'N'.repeat(90), city: 'C'.repeat(50) },
      message: 'M'.repeat(200),
    })
  );
  assert.equal(prepared.debtor.name.length, 70);
  assert.equal(prepared.debtor.city.length, 35);
  assert.equal(prepared.message.length, 140);
  assert.ok(prepared.payload.length <= QR_BILL_MAX_PAYLOAD_LENGTH);
});

/* ── Display formatting ───────────────────────────────────────────── */

test('display helpers format IBAN, reference and amount as the style guide shows', () => {
  assert.equal(formatIban(QR_IBAN), 'CH44 3199 9123 0008 8901 2');
  assert.equal(
    formatQrReference('210000000003139471430009017'),
    '21 00000 00003 13947 14300 09017'
  );
  assert.equal(formatQrReference(''), '');
  assert.equal(formatAmount(1234.5), '1 234.50');
  assert.equal(formatAmount(50), '50.00');
  assert.equal(formatAmount(1234567.891), '1 234 567.89');
  assert.equal(formatAmount('x'), '');
});

test('qrBillLabels returns German by default and English on request', () => {
  assert.equal(qrBillLabels().receipt, 'Empfangsschein');
  assert.equal(qrBillLabels('en').paymentPart, 'Payment part');
  assert.equal(qrBillLabels('fr').receipt, 'Empfangsschein');
});

test('partyDisplayLines joins street/number and postcode/town', () => {
  assert.deepEqual(partyDisplayLines(DEBTOR), ['Anna Meier', 'Seestrasse 12a', '8002 Zürich']);
  assert.deepEqual(partyDisplayLines({ ...DEBTOR, street: '', buildingNumber: '' }), [
    'Anna Meier',
    '8002 Zürich',
  ]);
  assert.deepEqual(partyDisplayLines(null), []);
});

/* ── QR encoding ──────────────────────────────────────────────────── */

test('encodeQrBill uses error correction M and a version no higher than 25', () => {
  const qr = encodeQrBill(buildQrBillPayload(bill()));
  assert.equal(qr.errorCorrectionLevel, 'M');
  assert.ok(qr.version >= 1 && qr.version <= 25);
  assert.equal(qr.size, qr.version * 4 + 17);
  assert.equal(qr.isDark(0, 0), true); // finder pattern corner
  const longest = buildQrBillPayload(
    bill({
      debtor: { ...DEBTOR, name: 'N'.repeat(70), street: 'S'.repeat(70) },
      message: 'M'.repeat(140),
    })
  );
  assert.ok(encodeQrBill(longest).version <= 25);
});
