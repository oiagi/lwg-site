// functions/api/_invoice-email.js
// Shared building blocks for invoice-related emails (send-invoice.js,
// cancel-invoice.js): HTML escaping, date formatting, the recipient greeting,
// the outer email layout, the invoice email itself and the cancellation
// (Storno) email template.
// Everything here is pure — covered by tests/invoice-email.test.mjs.

import { courseInfoSectionsHtml } from './_course-confirmation-email.js';

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
// `sectionsHtml` holds optional extra <tr> rows for the card table (the course
// info blocks of the invoice email); when present, the footer also names the
// contact address, like the course-info emails do.
export function emailShell({ language, title, bodyHtml, sectionsHtml = '' }) {
  const isEN = language === 'en';
  const questions = isEN
    ? 'If you have any questions, you can reach us at'
    : 'Bei Fragen erreichen Sie uns unter';
  const contactLine = sectionsHtml
    ? `<p style="margin:0 0 16px;font-size:13px;color:#aaa;line-height:1.6;">
              ${esc(questions)}
              <a href="mailto:info@learningwithgioia.ch" style="color:#1a1a1a;">info@learningwithgioia.ch</a>.
            </p>
            `
    : '';
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
        </tr>${sectionsHtml}
        <tr>
          <td style="padding:24px 40px 32px;border-top:1px solid #eee;">
            ${contactLine}<p style="margin:0;font-size:13px;color:#aaa;line-height:1.6;">
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

// The invoice email: PDF (with QR bill) attached, amount and due date in the
// body, followed by the same course blocks as the course-info emails (details
// table, lesson list, cancellation callout, full AGB). It doubles as the course
// confirmation, so the recipient sees exactly what they are paying for.
// `joinedAt` (YYYY-MM-DD) greys out lessons held before a late joiner joined,
// and the lesson count / total in the details table come from the invoice.
export function buildInvoiceEmail({
  language,
  name,
  first_name,
  last_name,
  gender,
  invoice,
  course = null,
  sessions = [],
  joinedAt = null,
}) {
  const isEN = language === 'en';
  const invoiceNo = invoice.invoice_number || '';
  const amount = `${Number(invoice.total_amount || 0).toFixed(2)} ${invoice.currency || 'CHF'}`;
  const subject = isEN
    ? `Invoice ${invoiceNo} · learning with gioia`
    : `Rechnung ${invoiceNo} · learning with gioia`;

  const greeting = invoiceGreeting({ language, name, first_name, last_name, gender });
  const courseLabel = invoice.subject || (isEN ? 'your course' : 'Ihren Kurs');
  const dueDate = invoice.due_date ? formatDate(invoice.due_date, isEN ? 'en' : 'de') : '';
  const intro = isEN ? 'Thank you for learning with us.' : 'Danke, dass Sie mit uns lernen.';
  const invoiceLine = isEN
    ? `Attached you will find the invoice for ${courseLabel}.`
    : `Anbei finden Sie die Rechnung für ${courseLabel}.`;
  const paymentLine = dueDate
    ? isEN
      ? `You can pay it easily with the QR bill in the PDF. The payment is due by ${dueDate}.`
      : `Sie können sie bequem mit dem QR-Zahlteil im PDF begleichen. Fällig ist die Rechnung bis zum ${dueDate}.`
    : isEN
      ? 'You will find the payment details directly in the attached PDF.'
      : 'Die Zahlungsdetails finden Sie direkt im angehängten PDF.';
  const detailsLine = isEN
    ? 'Below you will find all the important information about your course.'
    : 'Unten finden Sie alle wichtigen Infos zu Ihrem Kurs.';
  const questionLine = isEN
    ? 'If anything looks unclear, just reply to this email.'
    : 'Falls etwas unklar ist, antworten Sie einfach direkt auf diese E-Mail.';
  const sign = isEN ? 'Warm regards,' : 'Herzliche Grüsse';

  const bodyHtml = [
    `<p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#1a1a1a;">${esc(greeting)}</p>`,
    bodyParagraph(intro),
    bodyParagraph(invoiceLine),
    `<p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#333;">
      ${isEN ? 'Amount' : 'Betrag'}: <strong>${esc(amount)}</strong><br>
      ${esc(paymentLine)}
    </p>`,
    ...(course ? [bodyParagraph(detailsLine)] : []),
    bodyParagraph(questionLine, '0 0 24px'),
    bodyParagraph(sign, '0 0 4px'),
    bodyParagraph('Gioia', '0'),
  ].join('\n');

  const sectionsHtml = course
    ? courseInfoSectionsHtml({
        course,
        sessions,
        language,
        includeAgb: true,
        joinedAt,
        // The details table shows what this student is billed for, not the
        // course-level booking, so it always agrees with the PDF.
        booking: { lessons: invoice.quantity, total: invoice.total_amount },
      })
    : '';

  return {
    subject,
    html: emailShell({
      language,
      title: `${isEN ? 'Invoice' : 'Rechnung'} ${invoiceNo}`,
      bodyHtml,
      sectionsHtml,
    }),
  };
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
    ? `Attached you will find the credit note ${storno_number} for invoice ${original_number}. Invoice number ${original_number} is hereby cancelled.`
    : `Anbei finden Sie die Stornorechnung ${storno_number} zur Rechnung ${original_number}. Die Rechnung mit der Nummer ${original_number} ist damit storniert.`;
  const paymentLine = original_paid
    ? isEN
      ? 'We will transfer the amount back to you within the next 7 working days.'
      : 'Wir überweisen Ihnen den Betrag innerhalb der nächsten 7 Werktage.'
    : isEN
      ? 'The invoice is void. No payment is required.'
      : 'Die Rechnung ist gegenstandslos und es ist keine Zahlung erforderlich.';
  const newInvoiceLine = isEN
    ? 'You will receive the new invoice in a separate email.'
    : 'Die neue Rechnung erhalten Sie in einer separaten E-Mail.';
  const questionLine = isEN
    ? 'If anything looks unclear, just reply to this email.'
    : 'Falls etwas unklar ist, antworten Sie einfach direkt auf diese E-Mail.';
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
