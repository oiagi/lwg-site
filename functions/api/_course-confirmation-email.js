// functions/api/_course-confirmation-email.js
// Shared template for the two consolidated course-info emails:
//   'confirmation'   — sent after enrolment, includes the full AGB
//   'starting_soon'  — sent shortly before the first lesson, no AGB repeat
// Both share the course details table, lesson list and cancellation callout;
// only the subject, title and intro differ.

import { getCancellationPolicy, getGroupCancellationPolicy, renderAgbEmailHtml } from './_agb.js';

export const COURSE_EMAIL_VARIANTS = ['confirmation', 'starting_soon'];

export function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function fmtDate(iso, language = 'de', durationMinutes = null) {
  const locale = language === 'en' ? 'en-GB' : 'de-CH';
  const tz = 'Europe/Zurich';
  const start = new Date(iso);
  const duration = Number(durationMinutes);
  const base = start.toLocaleString(locale, {
    timeZone: tz,
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  if (!Number.isFinite(duration) || duration <= 0) return base;
  const end = new Date(start.getTime() + duration * 60000);
  const endTime = end.toLocaleString(locale, { timeZone: tz, hour: '2-digit', minute: '2-digit' });
  return `${base} - ${endTime} (${duration} min)`;
}

export function formatPrice(amount, currency) {
  if (amount === null || amount === undefined) return '—';
  return `${Number(amount).toFixed(2)} ${currency || 'CHF'}`;
}

export function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function bookingLessonCount(course, sessions) {
  return numberOrNull(course.sessions_total) || sessions.length || null;
}

export function studentBookingTotal(course, sessions) {
  const pricePer60 = numberOrNull(course.price_per_person_per_60min);
  const lessons = bookingLessonCount(course, sessions);
  if (pricePer60 === null || lessons === null) return null;

  const sessionLength = numberOrNull(course.session_length_minutes) || 60;
  return pricePer60 * lessons * (sessionLength / 60);
}

export function formatLocation(course) {
  const company = course.location_company;
  const line1 = [course.location_street, course.location_street_number].filter(Boolean).join(' ');
  const line2 = [course.location_postal_code, course.location_city].filter(Boolean).join(' ');
  const address = [company, line1, line2].filter(Boolean).join(', ');
  return address || course.location || '—';
}

export function courseDetailRows(course, sessions, language = 'de') {
  const lessons = bookingLessonCount(course, sessions);
  const total = studentBookingTotal(course, sessions);
  const label = {
    de: {
      code: 'Kurscode',
      subject: 'Fach',
      level: 'Niveau',
      format: 'Format',
      lessons: 'Anzahl Lektionen',
      duration: 'Lektionsdauer',
      price: 'Preis pro Person / 60 Min.',
      total: 'Preis für die gesamte Buchung',
      location: 'Ort',
      open: 'offen',
    },
    en: {
      code: 'Course code',
      subject: 'Subject',
      level: 'Level',
      format: 'Format',
      lessons: 'Number of lessons',
      duration: 'Lesson duration',
      price: 'Price per person / 60 min',
      total: 'Your price for the full booking',
      location: 'Location',
      open: 'open',
    },
  }[language === 'en' ? 'en' : 'de'];
  const rows = [
    [label.code, course.course_code || '-'],
    [label.subject, course.subject || '-'],
    [label.level, course.level || '-'],
    [label.format, course.group_type || '-'],
    [label.lessons, lessons !== null ? String(lessons) : label.open],
    [label.duration, course.session_length_minutes ? `${course.session_length_minutes} min` : '-'],
    [label.price, formatPrice(course.price_per_person_per_60min, course.currency)],
    [label.total, formatPrice(total, course.currency)],
    [label.location, formatLocation(course)],
  ];
  return rows
    .map(
      ([k, v]) => `
      <tr>
        <td style="padding:6px 0;color:#888;font-size:13px;vertical-align:top;white-space:nowrap;">${esc(k)}</td>
        <td style="padding:6px 0 6px 24px;font-size:13px;">${esc(v)}</td>
      </tr>`
    )
    .join('');
}

export function sessionDuration(session, course) {
  return session.duration_minutes ?? course.session_length_minutes ?? null;
}

export function sessionListRows(sessions, course, language = 'de') {
  if (!sessions.length) {
    const empty =
      language === 'en' ? 'No lessons have been scheduled yet.' : 'Noch keine Lektionen geplant.';
    return `<tr><td style="padding:8px 0;font-size:13px;color:#888;">${empty}</td></tr>`;
  }
  return sessions
    .map(
      (s, i) => `
      <tr>
        <td style="padding:6px 0;font-size:13px;color:#888;width:2.4em;vertical-align:top;">${i + 1}.</td>
        <td style="padding:6px 0;font-size:13px;">${esc(fmtDate(s.scheduled_at, language, sessionDuration(s, course)))}</td>
      </tr>`
    )
    .join('');
}

/* The lesson the "starting soon" mail leads with: the next one still ahead of
   us, or — when the course has already begun — the earliest one on record, so
   the intro never goes silent. */
export function firstLessonLabel(sessions, language = 'de', now = new Date()) {
  const dated = (sessions || []).filter((s) => s.scheduled_at);
  if (!dated.length) return null;
  const sorted = dated.slice().sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
  const upcoming = sorted.find((s) => new Date(s.scheduled_at) >= now);
  return fmtDate((upcoming || sorted[0]).scheduled_at, language);
}

function variantCopy({ variant, language, greetingName, sessions, now }) {
  const isEnglish = language === 'en';

  if (variant === 'starting_soon') {
    const lesson = firstLessonLabel(sessions, language, now);
    if (isEnglish) {
      const start = lesson ? `Your course starts on ${lesson}.` : 'Your course starts soon.';
      return {
        title: 'Your course starts soon',
        intro: `It's almost time, ${greetingName} :) ${start} Below you will find all the important information about your course again. Any questions? Just write to us at info@learningwithgioia.ch`,
      };
    }
    const start = lesson ? `Dein Kurs startet am ${lesson}.` : 'Dein Kurs startet demnächst.';
    return {
      title: 'Dein Kurs startet bald',
      intro: `Es ist bald so weit, ${greetingName} :) ${start} Hier findest du nochmals alle wichtigen Infos zu deinem Kurs. Noch Fragen? Dann schreib uns einfach auf info@learningwithgioia.ch`,
    };
  }

  if (isEnglish) {
    return {
      title: 'Course confirmation',
      intro: `Thank you for your registration, ${greetingName} :) We look forward to learning with you soon. Below you will find all the important information about your course. Any questions? Just write to us at info@learningwithgioia.ch`,
    };
  }
  return {
    title: 'Kursbestätigung',
    intro: `Vielen Dank für deine Anmeldung, ${greetingName} :) Wir freuen uns darauf, bald mit dir zu lernen. Unten findest du alle wichtigen Infos zu deinem Kurs. Noch Fragen? Dann schreib uns einfach auf info@learningwithgioia.ch`,
  };
}

function subjectFor({ variant, language, course }) {
  const isEnglish = language === 'en';
  if (variant === 'starting_soon') {
    return isEnglish
      ? `Your course starts soon - ${course.course_code || 'your course'} · learning with gioia`
      : `Dein Kurs startet bald - ${course.course_code || 'dein Kurs'} · learning with gioia`;
  }
  return isEnglish
    ? `Course confirmation - ${course.course_code || 'your course'} · learning with gioia`
    : `Kursbestätigung - ${course.course_code || 'dein Kurs'} · learning with gioia`;
}

export function buildConfirmationEmail({
  course,
  sessions,
  studentFirstName,
  language,
  variant = 'confirmation',
  now = new Date(),
}) {
  const isEnglish = language === 'en';
  const greetingName = studentFirstName || (isEnglish ? 'course participant' : 'Kursteilnehmer:in');
  const { title, intro } = variantCopy({ variant, language, greetingName, sessions, now });
  const copy = {
    subject: subjectFor({ variant, language, course }),
    htmlLang: isEnglish ? 'en' : 'de',
    title,
    intro,
    details: isEnglish ? 'Course details' : 'Kursdetails',
    sessions: isEnglish ? 'Scheduled lessons' : 'Geplante Lektionen',
    cancellation: isEnglish ? 'Cancellation and postponement' : 'Absage und Verschiebung',
    questions: isEnglish
      ? 'If you have any questions, you can reach us at'
      : 'Bei Fragen erreichst du uns unter',
  };
  // The AGB were already sent with the confirmation, so the reminder skips them.
  const agbBlock =
    variant === 'starting_soon'
      ? ''
      : `
        <tr>
          <td style="padding:0 40px 32px;border-top:1px solid #eee;padding-top:24px;">
            ${renderAgbEmailHtml(language)}
          </td>
        </tr>`;
  return {
    subject: copy.subject,
    html: `<!DOCTYPE html>
<html lang="${copy.htmlLang}">
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
              ${esc(copy.title)}
            </p>
            <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#333;">
              ${esc(copy.intro)}
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 40px 24px;">
            <p style="margin:0 0 12px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#aaa;">${esc(copy.details)}</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #eee;">
              ${courseDetailRows(course, sessions, language)}
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:0 40px 24px;">
            <p style="margin:0 0 12px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#aaa;">${esc(copy.sessions)}</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #eee;">
              ${sessionListRows(sessions, course, language)}
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:0 40px 24px;">
            <div style="background:#fff9e6;border-left:3px solid #d4a017;padding:16px 20px;">
              <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#8a6d0a;">${esc(copy.cancellation)}</p>
              <p style="margin:0;font-size:13px;line-height:1.6;color:#333;">
                ${esc(['duo', 'group'].includes(String(course.group_type || '').toLowerCase()) ? getGroupCancellationPolicy(language) : getCancellationPolicy(language))}
              </p>
            </div>
          </td>
        </tr>${agbBlock}
        <tr>
          <td style="padding:24px 40px 32px;border-top:1px solid #eee;">
            <p style="margin:0;font-size:13px;color:#aaa;line-height:1.6;">
              ${esc(copy.questions)}
              <a href="mailto:info@learningwithgioia.ch" style="color:#1a1a1a;">info@learningwithgioia.ch</a>.
            </p>
            <p style="margin:16px 0 0;font-size:13px;color:#aaa;">
              <a href="https://learningwithgioia.ch" style="color:#aaa;">learningwithgioia.ch</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  };
}
