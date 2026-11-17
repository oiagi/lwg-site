// Run with: node --test tests/
// Covers the course letter in functions/api/_course-letter-email.js: one email
// carrying any combination of invoice, course confirmation and questionnaire.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCourseLetterEmail } from '../functions/api/_course-letter-email.js';

const AGB_MARKER_DE = 'Allgemeine Geschäftsbedingungen';
const AGB_MARKER_EN = 'Terms & Conditions';
const Q_URL = 'https://learningwithgioia.ch/de/fragebogen?token=abc&lang=de';

const course = {
  course_code: 'LWG-2026-14',
  course_type: 'language',
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
  quantity: 3,
  total_amount: 450,
  currency: 'CHF',
  invoice_date: '2026-07-20',
  due_date: '2026-08-19',
};

const ALL = { invoice: true, confirmation: true, questionnaire: true };

function build(overrides = {}) {
  return buildCourseLetterEmail({
    language: 'de',
    parts: ALL,
    first_name: 'Anna',
    invoice,
    course,
    sessions,
    questionnaireUrl: Q_URL,
    ...overrides,
  });
}

// Text of the letter body only, i.e. everything above the course blocks.
function letter(html) {
  const end = html.indexOf('Kursdetails');
  return end === -1 ? html : html.slice(0, end);
}

test('all three parts: subject, title and the letter in Gioia’s order', () => {
  const { subject, html, parts } = build();
  assert.equal(subject, 'Kursbestätigung und Rechnung LWG-2026-0007 · learning with gioia');
  assert.ok(html.includes('Kursbestätigung und Rechnung LWG-2026-0007'));
  assert.deepEqual(parts, ALL);

  const order = [
    'Liebe Anna',
    'Wir freuen uns auf Ihren Deutsch B1 Kurs LWG-2026-14! Danke, dass Sie mit uns lernen. Unten finden Sie alle wichtigen Infos zu Ihrem Kurs.',
    'Damit wir den Unterricht auf Sie abstimmen können, würden wir uns freuen, wenn Sie sich vor Kursbeginn etwa fünf Minuten Zeit nehmen, um uns von Ihren Zielen und Ihrer Art zu lernen zu erzählen.',
    'Fragebogen ausfüllen →',
    'Dieser Link ist persönlich, kann einmalig verwendet werden und ist 90 Tage lang gültig.',
    'Die Rechnung für Ihre Buchung finden Sie im Anhang dieser Nachricht. Sie können sie bequem mit dem QR-Zahlteil im PDF begleichen. Wir bitten Sie, den Rechnungsbetrag bis zum 19.08.2026 auf unser Bankkonto zu überweisen.',
    'Bei Fragen antworten Sie gerne direkt auf diese E-Mail.',
    'Herzliche Grüsse',
    '>Gioia Birukoff</p>',
    'Kursdetails',
    'Geplante Lektionen',
    'Absage und Verschiebung',
    AGB_MARKER_DE,
  ];
  let at = -1;
  for (const piece of order) {
    const next = html.indexOf(piece, at + 1);
    assert.ok(next > at, `missing or out of order: ${piece}`);
    at = next;
  }
  assert.ok(html.includes(Q_URL.replace(/&/g, '&amp;')));
});

test('the letter no longer states the amount or thanks for the trust', () => {
  const body = letter(build().html);
  assert.ok(!body.includes('Betrag'));
  assert.ok(!body.includes('450.00'));
  assert.ok(!body.includes('Vielen Dank für Ihr Vertrauen'));
  // The amount still shows in the details table below.
  assert.match(build().html, /Preis für die gesamte Buchung<\/td>\s*<td[^>]*>450\.00 CHF</);
});

test('English mirrors the German letter', () => {
  const { subject, html } = build({ language: 'en' });
  assert.equal(subject, 'Course confirmation and invoice LWG-2026-0007 · learning with gioia');
  assert.ok(html.includes('Hello Anna,'));
  assert.ok(
    html.includes(
      'We are looking forward to your German B1 course LWG-2026-14! Thank you for learning with us. Below you will find all the important information about your course.'
    )
  );
  assert.ok(html.includes('Fill in the questionnaire →'));
  assert.ok(
    html.includes(
      'You will find the invoice for your booking attached to this message. You can pay it easily with the QR bill in the PDF. We kindly ask you to transfer the invoice amount to our bank account by 19/08/2026.'
    )
  );
  assert.ok(html.includes('Should you have any questions, please reply to this email.'));
  assert.ok(html.includes('Warm regards,'));
  assert.match(html, /Course details/);
  assert.ok(html.includes(AGB_MARKER_EN));
  assert.ok(html.includes(AGB_MARKER_DE));
});

test('without the questionnaire its paragraph, button and note drop out', () => {
  const { subject, html, parts } = build({ parts: { invoice: true, confirmation: true } });
  assert.equal(subject, 'Kursbestätigung und Rechnung LWG-2026-0007 · learning with gioia');
  assert.equal(parts.questionnaire, false);
  assert.ok(!html.includes('Damit wir den Unterricht'));
  assert.ok(!html.includes('Fragebogen'));
  assert.ok(!html.includes('fragebogen?token'));
  assert.ok(html.includes('Die Rechnung für Ihre Buchung'));
  assert.ok(html.includes('Kursdetails'));
});

test('a ticked questionnaire without a link (already answered) is left out', () => {
  const { html, parts } = build({ questionnaireUrl: null });
  assert.equal(parts.questionnaire, false);
  assert.ok(!html.includes('Fragebogen ausfüllen'));
  assert.ok(!html.includes('Damit wir den Unterricht'));
});

test('invoice only: plain invoice subject, no course blocks', () => {
  const { subject, html, parts } = build({ parts: { invoice: true } });
  assert.equal(subject, 'Rechnung LWG-2026-0007 · learning with gioia');
  assert.deepEqual(parts, { invoice: true, confirmation: false, questionnaire: false });
  assert.ok(
    html.includes(
      'Wir freuen uns auf Ihren Deutsch B1 Kurs LWG-2026-14! Danke, dass Sie mit uns lernen.</p>'
    )
  );
  assert.ok(!html.includes('Unten finden Sie alle wichtigen Infos'));
  assert.ok(!html.includes('Kursdetails'));
  assert.ok(!html.includes(AGB_MARKER_DE));
  assert.ok(!html.includes('Bei Fragen erreichen Sie uns unter'));
  assert.ok(html.includes('Die Rechnung für Ihre Buchung'));
});

test('invoice with questionnaire but no confirmation keeps the invoice subject', () => {
  const { subject, html } = build({ parts: { invoice: true, questionnaire: true } });
  assert.equal(subject, 'Rechnung LWG-2026-0007 · learning with gioia');
  assert.ok(html.includes('Fragebogen ausfüllen →'));
  assert.ok(!html.includes('Kursdetails'));
});

test('an invoice to a separate payer does not look forward to "your" course', () => {
  const { html } = build({
    parts: { invoice: true },
    forPayer: true,
    first_name: '',
    name: 'Muster AG',
  });
  assert.ok(!html.includes('Wir freuen uns auf'));
  assert.ok(html.includes('Guten Tag Muster AG'));
  assert.ok(html.includes('>Danke, dass Sie mit uns lernen.</p>'));
});

test('confirmation without invoice: confirmation subject, no invoice paragraph', () => {
  const { subject, html, parts } = build({
    parts: { confirmation: true, questionnaire: true },
    invoice: null,
  });
  assert.equal(subject, 'Kursbestätigung - LWG-2026-14 · learning with gioia');
  assert.deepEqual(parts, { invoice: false, confirmation: true, questionnaire: true });
  assert.ok(!html.includes('Rechnung für Ihre Buchung'));
  assert.ok(!html.includes('QR-Zahlteil'));
  assert.ok(html.includes('Fragebogen ausfüllen →'));
  assert.ok(html.includes('Kursdetails'));
  assert.ok(html.includes(AGB_MARKER_DE));

  const en = build({ parts: { confirmation: true }, invoice: null, language: 'en' });
  assert.equal(en.subject, 'Course confirmation - LWG-2026-14 · learning with gioia');
});

test('confirmation without invoice takes the billed figures from `booking`', () => {
  const { html } = build({
    parts: { confirmation: true },
    invoice: null,
    booking: { lessons: 2, total: 300 },
  });
  assert.match(html, /Anzahl Lektionen<\/td>\s*<td[^>]*>2</);
  assert.match(html, /Preis für die gesamte Buchung<\/td>\s*<td[^>]*>300\.00 CHF</);

  const fallback = build({ parts: { confirmation: true }, invoice: null }).html;
  assert.match(fallback, /Anzahl Lektionen<\/td>\s*<td[^>]*>3</);
});

test('the details table shows the billed lesson count and total', () => {
  const { html } = build({
    joinedAt: '2026-08-10',
    invoice: { ...invoice, quantity: 2, total_amount: 300 },
  });
  assert.match(html, /Anzahl Lektionen<\/td>\s*<td[^>]*>2</);
  assert.match(html, /Preis für die gesamte Buchung<\/td>\s*<td[^>]*>300\.00 CHF</);
  assert.ok(!html.includes('450.00 CHF'));
});

test('lessons held before a late joiner joined are greyed out', () => {
  const { html } = build({ joinedAt: '2026-08-10' });
  const first = html.indexOf('Montag, 03.08.2026');
  const second = html.indexOf('Montag, 10.08.2026');
  assert.ok(html.slice(html.lastIndexOf('<td', first), first).includes('line-through'));
  assert.ok(!html.slice(html.lastIndexOf('<td', second), second).includes('line-through'));
  assert.ok(!build().html.includes('line-through'));
});

test('a far course simply carries the course start as the date', () => {
  const far = { ...invoice, invoice_date: '2026-06-01', due_date: '2026-08-03' };
  assert.ok(
    build({ invoice: far }).html.includes(
      'den Rechnungsbetrag bis zum 03.08.2026 auf unser Bankkonto'
    )
  );
});

test('without a due date the letter points to the PDF', () => {
  const { html } = build({ invoice: { ...invoice, due_date: '' } });
  assert.ok(
    html.includes(
      'Die Rechnung für Ihre Buchung finden Sie im Anhang dieser Nachricht. Die Zahlungsdetails finden Sie direkt im angehängten PDF.'
    )
  );
});

test('male first names are greeted with "Lieber"', () => {
  assert.ok(build({ first_name: 'Tom', gender: 'male' }).html.includes('Lieber Tom'));
});

test('names and the link are escaped', () => {
  const { html } = build({
    first_name: '<b>x</b>',
    questionnaireUrl: 'https://example.test/?a=1&b="2"',
  });
  assert.ok(!html.includes('<b>x</b>'));
  assert.ok(html.includes('&lt;b&gt;x&lt;/b&gt;'));
  assert.ok(html.includes('href="https://example.test/?a=1&amp;b=&quot;2&quot;"'));
});
