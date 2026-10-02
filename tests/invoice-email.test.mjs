// Run with: node --test tests/
// Covers the pure invoice-email helpers in functions/api/_invoice-email.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  esc,
  cleanFilenamePart,
  formatDate,
  invoiceGreeting,
  emailShell,
  bodyParagraph,
  buildInvoiceEmail,
  buildCancellationEmail,
} from '../functions/api/_invoice-email.js';

const AGB_MARKER_DE = 'Allgemeine Geschäftsbedingungen';
const AGB_MARKER_EN = 'Terms & Conditions';

const course = {
  course_code: 'LWG-2026-14',
  subject: 'Deutsch',
  level: 'B1',
  group_type: 'einzel',
  sessions_total: 3,
  session_length_minutes: 90,
  price_per_person_per_60min: 100,
  currency: 'CHF',
  location_street: 'Bahnhofstrasse',
  location_street_number: '4',
  location_postal_code: '8001',
  location_city: 'Zürich',
};

const sessions = [
  { scheduled_at: '2026-08-03T16:00:00Z', duration_minutes: 90, status: 'scheduled' },
  { scheduled_at: '2026-08-10T16:00:00Z', duration_minutes: 90, status: 'scheduled' },
  { scheduled_at: '2026-08-17T16:00:00Z', duration_minutes: 90, status: 'scheduled' },
];

const invoice = {
  invoice_number: 'LWG-2026-0007',
  subject: 'Deutsch · B1 · LWG-2026-14',
  total_amount: 450,
  currency: 'CHF',
  due_date: '2026-08-03',
};

function buildInvoice(overrides = {}) {
  return buildInvoiceEmail({
    language: 'de',
    first_name: 'Anna',
    invoice,
    course,
    sessions,
    ...overrides,
  });
}

test('esc escapes HTML special characters and handles nullish', () => {
  assert.equal(
    esc('<b>"Gioia" & \'co\'</b>'),
    '&lt;b&gt;&quot;Gioia&quot; &amp; &#39;co&#39;&lt;/b&gt;'
  );
  assert.equal(esc(null), '');
  assert.equal(esc(undefined), '');
  assert.equal(esc(0), '0');
});

test('cleanFilenamePart sanitises and falls back', () => {
  assert.equal(cleanFilenamePart('LWG-2026-0001', 'lwg'), 'LWG-2026-0001');
  assert.equal(cleanFilenamePart('a b/c*d', 'lwg'), 'a-b-c-d');
  assert.equal(cleanFilenamePart('', 'lwg'), 'lwg');
  assert.equal(cleanFilenamePart('---', 'lwg'), '');
});

test('formatDate renders per language and passes garbage through', () => {
  assert.equal(formatDate('2026-08-07', 'de'), '07.08.2026');
  assert.equal(formatDate('2026-08-07', 'en'), '07/08/2026');
  assert.equal(formatDate('', 'de'), '');
  assert.equal(formatDate('not-a-date', 'de'), 'not-a-date');
});

test('invoiceGreeting branches on language, first name, and gender', () => {
  assert.equal(invoiceGreeting({ language: 'en', first_name: 'Anna' }), 'Hello Anna,');
  assert.equal(invoiceGreeting({ language: 'en' }), 'Hello there,');
  assert.equal(invoiceGreeting({ language: 'de', first_name: 'Anna' }), 'Liebe Anna');
  assert.equal(
    invoiceGreeting({ language: 'de', last_name: 'Muster', gender: 'female' }),
    'Liebe Frau Muster'
  );
  assert.equal(
    invoiceGreeting({ language: 'de', name: 'Max Muster', gender: 'male' }),
    'Lieber Herr Muster'
  );
  assert.equal(invoiceGreeting({ language: 'de', name: 'Max Muster' }), 'Guten Tag Max Muster');
  assert.equal(invoiceGreeting({ language: 'de' }), 'Guten Tag');
});

test('emailShell wraps body, escapes the title, and sets the language', () => {
  const html = emailShell({ language: 'de', title: 'Rechnung <1>', bodyHtml: '<p id="x">Hi</p>' });
  assert.ok(html.includes('<html lang="de">'));
  assert.ok(html.includes('Rechnung &lt;1&gt;'));
  assert.ok(html.includes('<p id="x">Hi</p>'));
  assert.ok(html.includes('learningwithgioia.ch'));
  assert.ok(emailShell({ language: 'en', title: 't', bodyHtml: '' }).includes('<html lang="en">'));
});

test('emailShell places extra sections before the footer and names the contact only then', () => {
  const plain = emailShell({ language: 'de', title: 't', bodyHtml: '<p>b</p>' });
  assert.ok(!plain.includes('Bei Fragen erreichen Sie uns unter'));
  assert.equal(
    plain,
    emailShell({ language: 'de', title: 't', bodyHtml: '<p>b</p>', sectionsHtml: '' })
  );

  const withSections = emailShell({
    language: 'de',
    title: 't',
    bodyHtml: '<p>b</p>',
    sectionsHtml: '<tr><td id="section">s</td></tr>',
  });
  const body = withSections.indexOf('<p>b</p>');
  const section = withSections.indexOf('id="section"');
  const footer = withSections.indexOf('Bei Fragen erreichen Sie uns unter');
  assert.ok(body < section && section < footer);
  assert.ok(withSections.includes('mailto:info@learningwithgioia.ch'));
  assert.ok(
    emailShell({ language: 'en', title: 't', bodyHtml: '', sectionsHtml: '<tr></tr>' }).includes(
      'If you have any questions, you can reach us at'
    )
  );
});

test('invoice email keeps its subject, greeting, amount and due date', () => {
  const { subject, html } = buildInvoice();
  assert.equal(subject, 'Rechnung LWG-2026-0007 · learning with gioia');
  assert.ok(html.includes('Rechnung LWG-2026-0007'));
  assert.ok(html.includes('Liebe Anna'));
  assert.ok(html.includes('Anbei finden Sie die Rechnung für Deutsch · B1 · LWG-2026-14.'));
  assert.ok(html.includes('Betrag: <strong>450.00 CHF</strong>'));
  assert.ok(html.includes('Fällig ist die Rechnung bis zum 03.08.2026.'));
  assert.ok(html.includes('Herzliche Grüsse'));
});

test('invoice email carries the course details, lessons, cancellation policy and AGB', () => {
  const { html } = buildInvoice();
  assert.ok(html.includes('Unten finden Sie alle wichtigen Infos zu Ihrem Kurs.'));
  assert.match(html, /Kursdetails/);
  assert.match(html, /Kurscode/);
  assert.match(html, /LWG-2026-14/);
  assert.match(html, /Preis für die gesamte Buchung/);
  assert.match(html, /450\.00 CHF/);
  assert.match(html, /Anzahl Lektionen<\/td>\s*<td[^>]*>3</);
  assert.match(html, /Bahnhofstrasse 4, 8001 Zürich/);
  assert.match(html, /Geplante Lektionen/);
  assert.match(html, /Montag, 03.08.2026, 18:00 - 19:30 \(90 min\)/);
  assert.match(html, /Montag, 17.08.2026, 18:00 - 19:30 \(90 min\)/);
  assert.match(html, /Absage und Verschiebung/);
  assert.ok(html.includes(AGB_MARKER_DE));
  assert.ok(html.includes('Bei Fragen erreichen Sie uns unter'));
  // The course blocks sit below the sign-off.
  assert.ok(html.indexOf('>Gioia</p>') < html.indexOf('Kursdetails'));
});

test('English invoice email carries English labels and both AGB versions', () => {
  const { subject, html } = buildInvoice({ language: 'en' });
  assert.equal(subject, 'Invoice LWG-2026-0007 · learning with gioia');
  assert.ok(html.includes('Hello Anna,'));
  assert.ok(html.includes('Amount: <strong>450.00 CHF</strong>'));
  assert.match(html, /Course details/);
  assert.match(html, /Scheduled lessons/);
  assert.match(html, /Monday, 03\/08\/2026, 18:00 - 19:30 \(90 min\)/);
  assert.match(html, /Cancellation and postponement/);
  assert.ok(html.includes(AGB_MARKER_EN));
  assert.ok(html.includes(AGB_MARKER_DE));
});

test('invoice email greys out lessons held before a late joiner joined', () => {
  const { html } = buildInvoice({ joinedAt: '2026-08-10' });
  const first = html.indexOf('Montag, 03.08.2026');
  const second = html.indexOf('Montag, 10.08.2026');
  const firstCell = html.lastIndexOf('<td', first);
  const secondCell = html.lastIndexOf('<td', second);
  assert.ok(html.slice(firstCell, first).includes('line-through'));
  assert.ok(!html.slice(secondCell, second).includes('line-through'));
  assert.ok(
    html.includes('Grau durchgestrichen: Lektionen, die vor Ihrem Einstieg stattgefunden haben.')
  );

  const regular = buildInvoice().html;
  assert.ok(!regular.includes('line-through'));
  assert.ok(!regular.includes('Grau durchgestrichen'));

  const en = buildInvoice({ joinedAt: '2026-08-10', language: 'en' }).html;
  assert.ok(en.includes('Greyed out: lessons held before you joined.'));
});

test('invoice email details show the billed lesson count and total, not the course-level ones', () => {
  const { html } = buildInvoice({
    joinedAt: '2026-08-10',
    invoice: { ...invoice, quantity: 2, total_amount: 300 },
  });
  assert.match(html, /Anzahl Lektionen<\/td>\s*<td[^>]*>2</);
  assert.match(html, /Preis für die gesamte Buchung<\/td>\s*<td[^>]*>300\.00 CHF</);
  assert.ok(!html.includes('450.00 CHF'));
  assert.ok(html.includes('Betrag: <strong>300.00 CHF</strong>'));

  // Without invoice figures the table falls back to the course-level numbers.
  const fallback = buildInvoice({ invoice: { ...invoice, quantity: undefined } }).html;
  assert.match(fallback, /Anzahl Lektionen<\/td>\s*<td[^>]*>3</);
});

test('invoice email without a course renders no course blocks', () => {
  const { html } = buildInvoice({ course: null, sessions: [] });
  assert.ok(html.includes('Betrag: <strong>450.00 CHF</strong>'));
  assert.ok(!html.includes('Kursdetails'));
  assert.ok(!html.includes('Unten finden Sie alle wichtigen Infos'));
  assert.ok(!html.includes(AGB_MARKER_DE));
  assert.ok(!html.includes('Bei Fragen erreichen Sie uns unter'));
});

test('invoice email falls back when the invoice has no subject or due date', () => {
  const { html } = buildInvoice({ invoice: { ...invoice, subject: '', due_date: '' } });
  assert.ok(html.includes('Anbei finden Sie die Rechnung für Ihren Kurs.'));
  assert.ok(html.includes('Die Zahlungsdetails finden Sie direkt im angehängten PDF.'));
});

test('bodyParagraph escapes text and applies the margin', () => {
  assert.equal(
    bodyParagraph('a<b', '0'),
    '<p style="margin:0;font-size:15px;line-height:1.7;color:#333;">a&lt;b</p>'
  );
  assert.ok(bodyParagraph('x').includes('margin:0 0 18px'));
});

test('cancellation email (de, unpaid): storno subject, no-payment line', () => {
  const { subject, html } = buildCancellationEmail({
    language: 'de',
    first_name: 'Anna',
    storno_number: 'LWG-2026-0042',
    original_number: 'LWG-2026-0007',
    original_paid: false,
    new_invoice_follows: true,
  });
  assert.equal(subject, 'Stornorechnung LWG-2026-0042 · learning with gioia');
  assert.ok(html.includes('Liebe Anna'));
  assert.ok(html.includes('Die Rechnung mit der Nummer LWG-2026-0007 ist damit storniert.'));
  assert.ok(html.includes('es ist keine Zahlung erforderlich'));
  assert.ok(html.includes('Die neue Rechnung erhalten Sie in einer separaten E-Mail.'));
  assert.ok(!html.includes('überweisen'));
});

test('cancellation email omits the new-invoice line unless requested', () => {
  const { html } = buildCancellationEmail({
    language: 'de',
    first_name: 'Anna',
    storno_number: 'LWG-2026-0042',
    original_number: 'LWG-2026-0007',
    original_paid: true,
  });
  assert.ok(!html.includes('Die neue Rechnung'));
});

test('cancellation email (de, paid): refund line instead of no-payment line', () => {
  const { html } = buildCancellationEmail({
    language: 'de',
    first_name: 'Anna',
    storno_number: 'LWG-2026-0042',
    original_number: 'LWG-2026-0007',
    original_paid: true,
  });
  assert.ok(html.includes('Wir überweisen Ihnen den Betrag innerhalb der nächsten 7 Werktage.'));
  assert.ok(!html.includes('keine Zahlung erforderlich'));
});

test('cancellation email (en): subject names the original invoice', () => {
  const paidVariant = buildCancellationEmail({
    language: 'en',
    first_name: 'Anna',
    storno_number: 'LWG-2026-0042',
    original_number: 'LWG-2026-0007',
    original_paid: true,
  });
  assert.equal(paidVariant.subject, 'Cancellation of invoice LWG-2026-0007 · learning with gioia');
  assert.ok(paidVariant.html.includes('Hello Anna,'));
  assert.ok(
    paidVariant.html.includes('transfer the amount back to you within the next 7 working days')
  );
  const unpaidVariant = buildCancellationEmail({
    language: 'en',
    storno_number: 'LWG-2026-0042',
    original_number: 'LWG-2026-0007',
    original_paid: false,
    new_invoice_follows: true,
  });
  assert.ok(unpaidVariant.html.includes('No payment is required'));
  assert.ok(unpaidVariant.html.includes('You will receive the new invoice in a separate email.'));
});
