import fs from 'node:fs';

const DEFAULT_TO = 'info@learningwithgioia.ch';
const FROM_EMAIL = 'learning with gioia <hello@oiagi.org>';
const REPLY_TO = ['info@learningwithgioia.ch'];
const TEST_PREFIX = '[TEST automated email]';

function loadDotEnv(path = '.dev.vars') {
  if (!fs.existsSync(path)) return;
  for (const line of fs.readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function shell(title, body, { lang = 'en', width = 600 } = {}) {
  return `<!DOCTYPE html>
<html lang="${lang}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f8fb;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f8fb;padding:40px 0;">
    <tr><td align="center">
      <table width="${width}" cellpadding="0" cellspacing="0" style="background:#ffffff;max-width:${width}px;width:100%;">
        <tr>
          <td style="background:#1a1a1a;padding:32px 40px;">
            <p style="margin:0;color:#d6eaf8;font-family:Georgia,serif;font-size:13px;letter-spacing:0.2em;text-transform:uppercase;">learning with gioia</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 40px 32px;">
            <p style="margin:0 0 24px;font-size:22px;font-weight:normal;color:#1a1a1a;font-family:Georgia,serif;">${title}</p>
            ${body}
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

function rows(items) {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #eee;">${items
    .map(
      ([key, value]) => `
      <tr>
        <td style="padding:6px 0;color:#888;font-size:13px;vertical-align:top;white-space:nowrap;">${esc(key)}</td>
        <td style="padding:6px 0 6px 24px;font-size:13px;">${esc(value || '-')}</td>
      </tr>`
    )
    .join('')}</table>`;
}

function smallPdfBase64(label) {
  const pdf = `%PDF-1.1
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 66 >>
stream
BT /F1 12 Tf 30 90 Td (${label.replace(/[()\\]/g, '')}) Tj ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000204 00000 n 
trailer
<< /Root 1 0 R /Size 5 >>
startxref
320
%%EOF`;
  return Buffer.from(pdf).toString('base64');
}

function buildEmails(to) {
  const CANCELLATION_EN =
    'Please note that cancelling or postponing a lesson must be communicated at least 24 hours before the lesson begins. If a lesson is cancelled less than 24 hours before the start, the lesson is considered held and can no longer be postponed.';
  const CANCELLATION_DE =
    'Bitte beachten Sie, dass das Absagen oder Verschieben einer Lektion mindestens 24 Stunden vor Lektionsbeginn kommuniziert werden muss. Wird eine Lektion weniger als 24 Stunden vor Beginn abgesagt, gilt die Lektion als abgehalten und kann nicht mehr verschoben werden.';

  const courseRows = rows([
    ['Course code', 'TEST-DE-A2'],
    ['Subject', 'German'],
    ['Level', 'A2'],
    ['Format', 'Group course'],
    ['Number of lessons', '8'],
    ['Lesson duration', '60 min'],
    ['Price per person / 60 min', '55.00 CHF'],
    ['Your price for the full booking', '440.00 CHF'],
    ['Location', 'Wildbachstrasse 65, 8008 Zurich'],
  ]);
  const courseRowsDE = rows([
    ['Kurscode', 'TEST-DE-A2'],
    ['Fach', 'Deutsch'],
    ['Niveau', 'A2'],
    ['Format', 'Gruppenkurs'],
    ['Anzahl Lektionen', '8'],
    ['Lektionsdauer', '60 min'],
    ['Preis pro Person / 60 Min.', 'CHF 55.00'],
    ['Ihr Preis für die gesamte Buchung', 'CHF 440.00'],
    ['Ort', 'Wildbachstrasse 65, 8008 Zürich'],
  ]);
  const scheduleRows = rows([
    ['1.', 'Wednesday, 13.05.2026, 18:30'],
    ['2.', 'Wednesday, 20.05.2026, 18:30'],
    ['3.', 'Wednesday, 27.05.2026, 18:30'],
  ]);
  const scheduleRowsDE = rows([
    ['1.', 'Mittwoch, 13.05.2026, 18:30'],
    ['2.', 'Mittwoch, 20.05.2026, 18:30'],
    ['3.', 'Mittwoch, 27.05.2026, 18:30'],
  ]);

  return [
    {
      key: 'enquiry-customer',
      subject: `${TEST_PREFIX} We've received your enquiry - learning with gioia`,
      html: shell(
        'Thank you, Gioia :)',
        `<p style="margin:0 0 32px;font-size:15px;line-height:1.7;color:#333;">We've received your message and will contact you shortly to discuss your enquiry.</p>${rows(
          [
            ['What they are looking for', 'A German conversation course test request'],
            ['Preferred contact', 'Email'],
          ]
        )}`
      ),
    },
    {
      key: 'enquiry-customer-de',
      subject: `${TEST_PREFIX} Wir haben deine Anfrage erhalten — learning with gioia`,
      html: shell(
        'Danke, Gioia :)',
        `<p style="margin:0 0 32px;font-size:15px;line-height:1.7;color:#333;">Wir haben deine Nachricht erhalten und melden uns in Kürze bei dir, um deine Anfrage zu besprechen.</p>${rows(
          [
            ['Gewünschter Unterricht', 'Deutsch Konversationskurs Testanfrage'],
            ['Bevorzugte Kontaktart', 'E-Mail'],
          ]
        )}`,
        { lang: 'de' }
      ),
    },
    {
      key: 'enquiry-admin',
      subject: `${TEST_PREFIX} New enquiry - Gioia Test`,
      html: shell(
        'new enquiry',
        rows([
          ['ID', 'test-enquiry-id'],
          ['Lead', 'Gioia Test'],
          ['Email', to],
          ['Phone', '+41 00 000 00 00'],
          ['Preferred contact', 'Email'],
          ['What they are looking for', 'A German conversation course test request'],
        ]),
        { width: 560 }
      ),
    },
    {
      key: 'direct-booking-customer',
      subject: `${TEST_PREFIX} Booking request received - A2 group course - learning with gioia`,
      html: shell(
        'Thank you, Gioia :)',
        `<p style="margin:0 0 12px;font-size:15px;line-height:1.7;color:#333;">We've received your booking request. What happens next:</p>
        <ul style="margin:0 0 28px 20px;padding:0;font-size:15px;line-height:1.7;color:#333;">
          <li>We will confirm your request shortly.</li>
          <li>You will receive the payment request for your course.</li>
          <li>You pay the bill.</li>
          <li>Done! You're all set for your course.</li>
        </ul>${rows([
          ['Course', 'German - A2'],
          ['Starts', '13.05.2026, 18:30'],
          ['Place', 'Wildbachstrasse 65, 8008 Zurich'],
          ['Total price', '440.00 CHF'],
        ])}`
      ),
    },
    {
      key: 'direct-booking-customer-de',
      subject: `${TEST_PREFIX} Buchungsanfrage erhalten — A1 Gruppenkurs · learning with gioia`,
      html: shell(
        'Danke, Gioia :)',
        `<p style="margin:0 0 12px;font-size:15px;line-height:1.7;color:#333;">Wir haben deine Buchungsanfrage erhalten. So geht es weiter:</p>
        <ul style="margin:0 0 28px 20px;padding:0;font-size:15px;line-height:1.7;color:#333;">
          <li style="margin-bottom:8px;">Wir bestätigen deine Anfrage so schnell wie möglich.</li>
          <li style="margin-bottom:8px;">Bitte füll in der Zwischenzeit dieses Formular aus. Ohne diese Informationen können wir dich nicht in einen Kurs einschreiben!</li>
          <li style="margin-bottom:8px;">Du erhältst die Zahlungsinformationen für deinen Kurs.</li>
          <li style="margin-bottom:8px;">Du bezahlst die Rechnung.</li>
          <li>Fertig! Dein Platz im Kurs ist reserviert.</li>
        </ul>${rows([
          ['Kurs', 'Deutsch · A1'],
          ['Start', '13.05.2026, 18:30'],
          ['Ort', 'Teststrasse 1, 8001 Zürich'],
          ['Gesamtpreis', '440.00 CHF'],
        ])}`,
        { lang: 'de' }
      ),
    },
    {
      key: 'direct-booking-admin',
      subject: `${TEST_PREFIX} Direct course booking request - Gioia Test`,
      html: shell(
        'direct booking request',
        rows([
          ['Enquiry ID', 'test-direct-booking-id'],
          ['Course', 'TEST-DE-A2 - A2'],
          ['Student', 'Gioia Test'],
          ['Email', to],
          ['Phone', '+41 00 000 00 00'],
        ]),
        { width: 560 }
      ),
    },
    {
      key: 'course-confirmation',
      subject: `${TEST_PREFIX} Course confirmation - TEST-DE-A2 - learning with gioia`,
      html: shell(
        'Course confirmation',
        `<p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#333;">Thank you for your registration, Gioia :) We look forward to learning with you soon. Below you will find all the important information about your course. Any questions? Just write to us at info@learningwithgioia.ch</p>
        <p style="margin:0 0 12px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#aaa;">Course details</p>${courseRows}
        <p style="margin:24px 0 12px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#aaa;">Scheduled lessons</p>${scheduleRows}
        <div style="margin-top:24px;background:#fff9e6;border-left:3px solid #d4a017;padding:16px 20px;">
          <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#8a6d0a;">Cancellation and postponement</p>
          <p style="margin:0;font-size:13px;line-height:1.6;color:#333;">${CANCELLATION_EN}</p>
        </div>`
      ),
    },
    {
      key: 'course-confirmation-de',
      subject: `${TEST_PREFIX} Kursbestätigung - TEST-DE-A2 · learning with gioia`,
      html: shell(
        'Kursbestätigung',
        `<p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#333;">Vielen Dank für deine Anmeldung, Gioia :) Wir freuen uns darauf, bald mit dir zu lernen. Unten findest du alle wichtigen Infos zu deinem Kurs. Noch Fragen? Dann schreib uns einfach auf info@learningwithgioia.ch</p>
        <p style="margin:0 0 12px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#aaa;">Kursdetails</p>${courseRowsDE}
        <p style="margin:24px 0 12px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#aaa;">Geplante Lektionen</p>${scheduleRowsDE}
        <div style="margin-top:24px;background:#fff9e6;border-left:3px solid #d4a017;padding:16px 20px;">
          <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#8a6d0a;">Absage und Verschiebung</p>
          <p style="margin:0;font-size:13px;line-height:1.6;color:#333;">${CANCELLATION_DE}</p>
        </div>`,
        { lang: 'de' }
      ),
    },
    {
      key: 'decline-booking-en',
      subject: `${TEST_PREFIX} Regarding your booking request — learning with gioia`,
      html: shell(
        'Hi Gioia :)',
        `<p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#333;">Thank you for your request. Unfortunately, somebody was faster and the course you requested is no longer available :(</p>
        <p style="margin:0;font-size:15px;line-height:1.7;color:#333;">We will be in touch shortly to discuss options.</p>`,
        { width: 560 }
      ),
    },
    {
      key: 'decline-booking-de',
      subject: `${TEST_PREFIX} Bezüglich deiner Buchungsanfrage — learning with gioia`,
      html: shell(
        'Hallo Gioia :)',
        `<p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#333;">Vielen Dank für deine Anfrage. Leider war jemand schneller und der Kurs, den du angefragt hast, ist leider nicht mehr verfügbar :(</p>
        <p style="margin:0;font-size:15px;line-height:1.7;color:#333;">Wir melden uns bald bei dir, um Optionen zu besprechen.</p>`,
        { lang: 'de', width: 560 }
      ),
    },
    {
      key: 'schedule-update',
      subject: `${TEST_PREFIX} Updated lesson plan (TEST-DE-A2) - learning with gioia`,
      html: shell(
        'Hello Gioia,',
        `<p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#333;">Attached is the current lesson plan for your A2 course TEST-DE-A2. We are happy to have you.</p>
        <p style="margin:0 0 12px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#aaa;">Scheduled lessons</p>${scheduleRows}
        <div style="margin-top:24px;background:#fff9e6;border-left:3px solid #d4a017;padding:16px 20px;">
          <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#8a6d0a;">Cancellation and postponement</p>
          <p style="margin:0;font-size:13px;line-height:1.6;color:#333;">${CANCELLATION_EN}</p>
        </div>`,
        { width: 560 }
      ),
    },
    {
      key: 'schedule-update-de',
      subject: `${TEST_PREFIX} Aktualisierter Lektionsplan (TEST-DE-A2) — learning with gioia`,
      html: shell(
        'Hallo Gioia,',
        `<p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#333;">anbei der aktuelle Lektionsplan für deinen A2 Kurs TEST-DE-A2. Wir freuen uns, dass du dabei bist.</p>
        <p style="margin:0 0 12px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#aaa;">Geplante Lektionen</p>${scheduleRowsDE}
        <div style="margin-top:24px;background:#fff9e6;border-left:3px solid #d4a017;padding:16px 20px;">
          <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#8a6d0a;">Absage und Verschiebung</p>
          <p style="margin:0;font-size:13px;line-height:1.6;color:#333;">${CANCELLATION_DE}</p>
        </div>`,
        { lang: 'de', width: 560 }
      ),
    },
    {
      key: 'invoice',
      subject: `${TEST_PREFIX} Invoice LWG-2026-TEST · learning with gioia`,
      html: shell(
        'Invoice LWG-2026-TEST',
        `<p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#1a1a1a;">Hello Gioia,</p>
        <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#333;">Thank you for learning with us.</p>
        <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#333;">Attached you will find the invoice for German A2 group course.</p>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#333;">Amount: <strong>440.00 CHF</strong><br>You can pay it easily with the QR bill in the PDF. The payment is due by 20.05.2026.</p>
        <p style="margin:0;font-size:15px;line-height:1.7;color:#333;">Warm regards,<br>Gioia</p>`
      ),
      attachments: [
        { filename: 'invoice-LWG-2026-TEST.pdf', content: smallPdfBase64('Test invoice PDF') },
      ],
    },
    {
      key: 'invoice-de',
      subject: `${TEST_PREFIX} Rechnung LWG-2026-TEST · learning with gioia`,
      html: shell(
        'Rechnung LWG-2026-TEST',
        `<p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#1a1a1a;">Hallo Gioia,</p>
        <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#333;">Vielen Dank, dass Sie mit uns lernen.</p>
        <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#333;">Anbei finden Sie die Rechnung für den Deutsch A2 Gruppenkurs.</p>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#333;">Betrag: <strong>440.00 CHF</strong><br>Sie können sie bequem mit dem QR-Zahlteil im PDF begleichen. Fällig ist die Rechnung bis zum 20.05.2026.</p>
        <p style="margin:0;font-size:15px;line-height:1.7;color:#333;">Herzliche Grüsse,<br>Gioia</p>`,
        { lang: 'de' }
      ),
      attachments: [
        { filename: 'rechnung-LWG-2026-TEST.pdf', content: smallPdfBase64('Test Rechnung PDF') },
      ],
    },
    {
      key: 'certificate',
      subject: `${TEST_PREFIX} Certificate of Attendance — TEST-DE-A2 · learning with gioia`,
      html: shell(
        'Done!',
        `<p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#1a1a1a;">Hello Gioia Test,</p>
        <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#333;">Below you will find the certificate for your A2 course TEST-DE-A2.</p>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#333;">It was a pleasure learning with you! Thank you for being part of the course, and maybe see you again soon.</p>
        <p style="margin:0;font-size:15px;line-height:1.7;color:#333;">Warm regards,<br>Gioia</p>`
      ),
      attachments: [
        {
          filename: 'certificate-of-attendance-LWG-TEST-2026.pdf',
          content: smallPdfBase64('Test certificate PDF'),
        },
      ],
    },
    {
      key: 'certificate-de',
      subject: `${TEST_PREFIX} Teilnahmebestätigung — TEST-DE-A2 · learning with gioia`,
      html: shell(
        'Fertig!',
        `<p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#1a1a1a;">Hallo Gioia Test,</p>
        <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#333;">anbei findest du das Zertifikat für deinen A2 Kurs TEST-DE-A2.</p>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#333;">Es hat uns Spass gemacht, mit dir zu lernen! Danke, dass du dabei warst und vielleicht bis bald.</p>
        <p style="margin:0;font-size:15px;line-height:1.7;color:#333;">Herzliche Grüsse,<br>Gioia</p>`,
        { lang: 'de' }
      ),
      attachments: [
        {
          filename: 'teilnahmebestaetigung-LWG-TEST-2026.pdf',
          content: smallPdfBase64('Test Zertifikat PDF'),
        },
      ],
    },
  ];
}

async function sendEmail(apiKey, to, email) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [to],
      reply_to: REPLY_TO,
      subject: email.subject,
      html: email.html,
      attachments: email.attachments,
    }),
  });
  const text = await response.text();
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  return { ok: response.ok, status: response.status, body };
}

loadDotEnv();

const to = process.env.TEST_EMAIL || process.argv[2] || DEFAULT_TO;
const apiKey = process.env.RESEND_API_KEY;

if (!apiKey) {
  console.error('Missing RESEND_API_KEY. Add it to .dev.vars or export it before running.');
  process.exit(1);
}

console.log(`Sending automated email test run to ${to}`);

let failed = 0;
for (const email of buildEmails(to)) {
  const result = await sendEmail(apiKey, to, email);
  if (!result.ok) failed += 1;
  const id = result.body?.id ? ` id=${result.body.id}` : '';
  const error = result.ok ? '' : ` error=${JSON.stringify(result.body)}`;
  console.log(`${result.ok ? 'OK' : 'FAIL'} ${email.key} status=${result.status}${id}${error}`);
}

if (failed) {
  console.error(`${failed} automated email test(s) failed.`);
  process.exit(1);
}

console.log('All automated email tests were accepted by Resend.');
