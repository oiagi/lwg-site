// functions/api/_call-email.js
// Email builders for booked 15-minute intro calls.
//
// Pure — each returns { subject, html } — so the copy is unit-testable and
// book-call.js stays about orchestration. Visual template matches
// submit-enquiry.js: #f4f8fb page, 560px white card, #1a1a1a header bar.

const ADMIN_EMAIL = 'info@learningwithgioia.ch';

function esc(str) {
  if (!str && str !== 0) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 'Friday, 21 August 2026 at 09:00' in the right language, Zurich time. */
export function formatCallWhen(startIso, language = 'en') {
  const date = new Date(startIso);
  const locale = language === 'de' ? 'de-CH' : 'en-GB';
  const day = date.toLocaleDateString(locale, {
    timeZone: 'Europe/Zurich',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const time = date.toLocaleTimeString(locale, {
    timeZone: 'Europe/Zurich',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  return language === 'de' ? `${day} um ${time}` : `${day} at ${time}`;
}

/** Short form for subject lines: 'Fri 21 Aug, 09:00'. */
export function formatCallWhenShort(startIso, language = 'en') {
  const date = new Date(startIso);
  const locale = language === 'de' ? 'de-CH' : 'en-GB';
  const day = date.toLocaleDateString(locale, {
    timeZone: 'Europe/Zurich',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const time = date.toLocaleTimeString(locale, {
    timeZone: 'Europe/Zurich',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  return `${day}, ${time}`;
}

function detailRows(rows) {
  return rows
    .filter(([, v]) => v)
    .map(
      ([k, v]) =>
        `<tr>
       <td style="padding:6px 0;color:#888;font-size:13px;vertical-align:top;white-space:nowrap;">${esc(k)}</td>
       <td style="padding:6px 0 6px 24px;font-size:13px;">${v}</td>
     </tr>`
    )
    .join('');
}

function shell({ lang, kicker, headerPadding = '32px 40px', body, footer }) {
  return `<!DOCTYPE html>
<html lang="${lang}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f8fb;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f8fb;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;max-width:560px;width:100%;">
        <tr>
          <td style="background:#1a1a1a;padding:${headerPadding};">
            <p style="margin:0;color:#d6eaf8;font-family:Georgia,serif;font-size:13px;letter-spacing:0.2em;text-transform:uppercase;">${kicker}</p>
          </td>
        </tr>
        <tr><td style="padding:40px 40px 32px;">${body}</td></tr>
        <tr><td style="padding:24px 40px 32px;border-top:1px solid #eee;">${footer}</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * Confirmation to the visitor.
 *
 * @param {object} booking — { starts_at, duration_minutes, first_name,
 *   language, meet_link, delivery }
 */
export function buildCallConfirmationEmail(booking) {
  const language = booking.language === 'de' ? 'de' : 'en';
  const isGerman = language === 'de';
  const when = formatCallWhen(booking.starts_at, language);
  const duration = booking.duration_minutes || 15;
  const meetLink = booking.meet_link || null;

  const copy = isGerman
    ? {
        htmlLang: 'de',
        subject: `Dein ${duration}-Minuten-Gespräch ist gebucht — ${formatCallWhenShort(booking.starts_at, 'de')} (Zürich)`,
        greeting: `Danke, ${booking.first_name} :)`,
        body: `Dein kostenloses ${duration}-minütiges Gespräch mit Gioia ist bestätigt.`,
        label: 'Dein Termin',
        whenKey: 'Wann',
        durationKey: 'Dauer',
        durationValue: `${duration} Minuten`,
        whereKey: 'Wo',
        linkPending: 'Der Link folgt in der Kalendereinladung.',
        joinBtn: 'Am Gespräch teilnehmen →',
        calendarNote:
          'Du erhältst zusätzlich eine Google-Kalendereinladung — mit dem Annehmen wird das Gespräch in deinen Kalender eingetragen.',
        icsNote:
          'Mit der angehängten Kalenderdatei (.ics) trägst du das Gespräch in deinen Kalender ein.',
        reschedule: 'Passt die Zeit doch nicht? Antworte einfach auf diese E-Mail.',
        footer: 'Bei Fragen antworte auf diese E-Mail oder schreib an',
      }
    : {
        htmlLang: 'en',
        subject: `Your ${duration}-minute call is booked — ${formatCallWhenShort(booking.starts_at, 'en')} (Zürich)`,
        greeting: `Thanks, ${booking.first_name} :)`,
        body: `Your free ${duration}-minute call with Gioia is confirmed.`,
        label: 'Your call',
        whenKey: 'When',
        durationKey: 'Duration',
        durationValue: `${duration} minutes`,
        whereKey: 'Where',
        linkPending: 'The link follows in the calendar invitation.',
        joinBtn: 'Join the call →',
        calendarNote:
          "You'll also receive a Google Calendar invitation — accepting it adds the call to your calendar.",
        icsNote: 'The attached calendar file (.ics) adds the call to your calendar.',
        reschedule: 'Need a different time? Just reply to this email.',
        footer: 'If you have any questions in the meantime, reply to this email or write to',
      };

  const whereValue = meetLink
    ? `<a href="${esc(meetLink)}" style="color:#1a1a1a;">${esc(meetLink)}</a>`
    : esc(copy.linkPending);

  const joinButton = meetLink
    ? `<p style="margin:0 0 32px;">
         <a href="${esc(meetLink)}" style="display:inline-block;background:#1a1a1a;color:#d6eaf8;text-decoration:none;padding:10px 14px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;">${copy.joinBtn}</a>
       </p>`
    : '';

  const deliveryNote = booking.delivery === 'email' ? copy.icsNote : copy.calendarNote;

  return {
    subject: copy.subject,
    html: shell({
      lang: copy.htmlLang,
      kicker: 'learning with gioia',
      body: `
        <p style="margin:0 0 24px;font-size:22px;font-weight:normal;color:#1a1a1a;font-family:Georgia,serif;">${esc(copy.greeting)}</p>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#333;">${esc(copy.body)}</p>
        <p style="margin:0 0 12px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#aaa;">${esc(copy.label)}</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #eee;margin-bottom:28px;">
          ${detailRows([
            [copy.whenKey, esc(when)],
            [copy.durationKey, esc(copy.durationValue)],
            [copy.whereKey, whereValue],
          ])}
        </table>
        ${joinButton}
        <p style="margin:0 0 12px;font-size:14px;line-height:1.7;color:#555;">${esc(deliveryNote)}</p>
        <p style="margin:0;font-size:14px;line-height:1.7;color:#555;">${esc(copy.reschedule)}</p>`,
      footer: `
        <p style="margin:0;font-size:13px;color:#aaa;line-height:1.6;">
          ${esc(copy.footer)}
          <a href="mailto:${ADMIN_EMAIL}" style="color:#1a1a1a;">${ADMIN_EMAIL}</a>.
        </p>
        <p style="margin:16px 0 0;font-size:13px;color:#aaa;">
          <a href="https://learningwithgioia.ch" style="color:#aaa;">learningwithgioia.ch</a>
        </p>`,
    }),
  };
}

/**
 * Internal notification. Subject is prefixed when the call did not make it
 * onto the calendar, so a Google failure cannot pass unnoticed.
 */
export function buildCallNotificationEmail(booking) {
  const duration = booking.duration_minutes || 15;
  const name = `${booking.first_name || ''} ${booking.last_name || ''}`.trim() || '—';
  const notOnCalendar = booking.delivery !== 'calendar';

  const rows = [
    ['When', esc(formatCallWhen(booking.starts_at, 'en'))],
    ['Duration', `${duration} minutes`],
    ['Name', esc(name)],
    [
      'Email',
      `<a href="mailto:${esc(booking.email)}" style="color:#1a1a1a;">${esc(booking.email)}</a>`,
    ],
    ['Phone', esc(booking.phone) || '—'],
    ['Topic', esc(booking.topic) || '—'],
    ['Language', (booking.language || 'en').toUpperCase()],
    [
      'Delivery',
      notOnCalendar ? 'email — add it to your calendar manually' : 'calendar invite sent',
    ],
    [
      'Meet link',
      booking.meet_link
        ? `<a href="${esc(booking.meet_link)}" style="color:#1a1a1a;">${esc(booking.meet_link)}</a>`
        : '—',
    ],
    ['Booking', esc(booking.id)],
  ];

  const warning = notOnCalendar
    ? `<p style="margin:0 0 24px;padding:12px 16px;background:#fdf1ee;border-left:3px solid #b3564d;font-size:14px;line-height:1.6;color:#8a3a33;">
         This call is <strong>not</strong> on the Google Calendar — add it manually. The visitor has been sent a calendar file instead.
       </p>`
    : '';

  return {
    subject:
      (notOnCalendar ? '⚠ NOT ON CALENDAR — ' : '') +
      `New ${duration}min call — ${name} — ${formatCallWhenShort(booking.starts_at, 'en')}`,
    html: shell({
      lang: 'en',
      kicker: `new ${duration}min call`,
      headerPadding: '24px 40px',
      body: `${warning}
        <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #eee;">
          ${detailRows(rows)}
        </table>`,
      footer: `<a href="https://learningwithgioia.ch/admin.html#teachers" style="font-size:12px;color:#888;">View in admin dashboard →</a>`,
    }),
  };
}
