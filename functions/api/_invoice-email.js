// functions/api/_invoice-email.js
// Shared building blocks for invoice-related emails (send-invoice.js,
// cancel-invoice.js): HTML escaping, date formatting, the recipient greeting,
// the outer email layout, and the cancellation (Storno) email template.
// Everything here is pure — covered by tests/invoice-email.test.mjs.

export function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function cleanFilenamePart(value, fallback) {
  return String(value || fallback)
    .trim()
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function formatDate(value, language) {
  if (!value) return '';
  const date = new Date(value + 'T12:00:00');
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(language === 'en' ? 'en-GB' : 'de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function surnameFromName(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

function fullNameFromParts(firstName, lastName, fallbackName = '') {
  return [firstName, lastName].filter(Boolean).join(' ') || fallbackName;
}

export function invoiceGreeting({ language, name, first_name, last_name, gender }) {
  if (language === 'en') return `Hello ${first_name || name || 'there'},`;
  if (first_name) return `Liebe ${first_name}`;
  const surname = last_name || surnameFromName(name);
  if (gender === 'female' && surname) return `Liebe Frau ${surname}`;
  if (gender === 'male' && surname) return `Lieber Herr ${surname}`;
  const fullName = fullNameFromParts(first_name, last_name, name);
  return fullName ? `Guten Tag ${fullName}` : 'Guten Tag';
}

// Wraps already-escaped body paragraphs in the shared branded email layout
// (dark header band, white card, footer link). `title` is escaped here.
export function emailShell({ language, title, bodyHtml }) {
  const isEN = language === 'en';
  return `<!DOCTYPE html>
<html lang="${isEN ? 'en' : 'de'}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f8fb;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f8fb;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;max-width:600px;width:100%;">
        <tr>
          <td style="background:#1a1a1a;padding:32px 40px;">
            <p style="margin:0;color:#d6eaf8;font-family:Georgia,serif;font-size:13px;letter-spacing:0.2em;text-transform:uppercase;">learning with gioia</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 40px 16px;">
            <p style="margin:0 0 24px;font-size:22px;font-weight:normal;color:#1a1a1a;font-family:Georgia,serif;">
              ${esc(title)}
            </p>
            ${bodyHtml}
          </td>
        </tr>
        <tr>
          <td style="padding:24px 40px 32px;border-top:1px solid #eee;">
            <p style="margin:0;font-size:13px;color:#aaa;line-height:1.6;">
              <a href="https://learningwithgioia.ch" style="color:#aaa;">learningwithgioia.ch</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function bodyParagraph(text, margin = '0 0 18px') {
  return `<p style="margin:${margin};font-size:15px;line-height:1.7;color:#333;">${esc(text)}</p>`;
}

// Notification email for a cancelled invoice: storno PDF attached, states that
// the original invoice is void and — unless it was already paid — that no
// payment is required. Paid originals are refunded within 7 working days.
export function buildCancellationEmail({
  language,
  name,
  first_name,
  last_name,
  gender,
  storno_number,
  original_number,
  original_paid,
  new_invoice_follows = false,
}) {
  const isEN = language === 'en';
  const subject = isEN
    ? `Cancellation of invoice ${original_number} · learning with gioia`
    : `Stornorechnung ${storno_number} · learning with gioia`;
  const title = isEN
    ? `Cancellation of invoice ${original_number}`
    : `Stornorechnung ${storno_number}`;

  const greeting = invoiceGreeting({ language, name, first_name, last_name, gender });
  const intro = isEN
    ? `Attached you will find the credit note ${storno_number} for invoice ${original_number}. Invoice ${original_number} is hereby cancelled.`
    : `Anbei findest du die Stornorechnung ${storno_number} zur Rechnung ${original_number}. Die Rechnung ${original_number} ist damit storniert.`;
  const paymentLine = original_paid
    ? isEN
      ? 'We will transfer the amount back to you within the next 7 working days.'
      : 'Wir überweisen dir den Betrag innerhalb der nächsten 7 Werktage.'
    : isEN
      ? 'The invoice is void — no payment is required.'
      : 'Die Rechnung ist gegenstandslos — es ist keine Zahlung erforderlich.';
  const newInvoiceLine = isEN
    ? 'You will receive the new invoice in a separate email.'
    : 'Die neue Rechnung erhältst du in einer separaten E-Mail.';
  const questionLine = isEN
    ? 'If anything looks unclear, just reply to this email.'
    : 'Falls etwas unklar ist, antworte einfach direkt auf diese E-Mail.';
  const sign = isEN ? 'Warm regards,' : 'Herzliche Grüsse';

  const bodyHtml = [
    `<p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#1a1a1a;">${esc(greeting)}</p>`,
    bodyParagraph(intro),
    bodyParagraph(paymentLine),
    ...(new_invoice_follows ? [bodyParagraph(newInvoiceLine)] : []),
    bodyParagraph(questionLine, '0 0 24px'),
    bodyParagraph(sign, '0 0 4px'),
    bodyParagraph('Gioia', '0'),
  ].join('\n');

  return { subject, html: emailShell({ language, title, bodyHtml }) };
}
