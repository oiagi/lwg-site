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
  buildCancellationEmail,
} from '../functions/api/_invoice-email.js';

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
  assert.ok(html.includes('Die Rechnung LWG-2026-0007 ist damit storniert.'));
  assert.ok(html.includes('es ist keine Zahlung erforderlich'));
  assert.ok(html.includes('Die neue Rechnung erhältst du in einer separaten E-Mail.'));
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
  assert.ok(html.includes('Wir überweisen dir den Betrag innerhalb der nächsten 7 Werktage.'));
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
  assert.ok(unpaidVariant.html.includes('no payment is required'));
  assert.ok(unpaidVariant.html.includes('You will receive the new invoice in a separate email.'));
});
