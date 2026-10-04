// functions/api/_feedback-email.js
// The email that asks a student to fill in the mid-course or end-of-course
// feedback form. Pure: no I/O, unit tested in tests/feedback-email.test.mjs.
//
// The survey is anonymous, so the email deliberately carries no first name
// and says so: what is stored is the answers, never who gave them.
// German is formal (Sie) throughout.

import { courseSubjectLabel, isFeedbackKind } from './_feedback.js';

export function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** "Deutsch B1 Kurs LWG-2026-14" / "German B1 course LWG-2026-14". */
export function courseLabel(course, language) {
  const label = [
    courseSubjectLabel(course, language),
    course?.level,
    language === 'en' ? 'course' : 'Kurs',
    course?.course_code,
  ]
    .filter(Boolean)
    .join(' ');
  return label || (language === 'en' ? 'course' : 'Kurs');
}

const COPY = {
  final: {
    en: {
      subject: (code) => `How was your course?${code} — learning with gioia`,
      intro: (label) =>
        `We hope you enjoyed your ${label}! We would be very grateful if you could take three to five minutes to share your feedback with us. The survey is completely anonymous, and your honest feedback helps us continuously improve our future courses.`,
    },
    de: {
      subject: (code) => `Wie war Ihr Kurs?${code} — learning with gioia`,
      intro: (label) =>
        `Wir hoffen, Ihr ${label} hat Ihnen gefallen. Wir würden uns sehr freuen, wenn Sie sich drei bis fünf Minuten Zeit nehmen, um Ihre Erfahrungen mit uns zu teilen. Die Umfrage ist völlig anonym, und Ihr ehrliches Feedback hilft uns, unsere nächsten Kurse noch besser zu gestalten.`,
    },
  },
  midterm: {
    en: {
      subject: (code) => `How is your course going?${code} — learning with gioia`,
      intro: (label) =>
        `Your ${label} is now about halfway through! We would really appreciate it if you could take three minutes to let us know how things are going. The survey is anonymous, and your feedback will help us tailor the second half of the course to your needs.`,
    },
    de: {
      subject: (code) => `Wie läuft Ihr Kurs?${code} — learning with gioia`,
      intro: (label) =>
        `Ihr ${label} ist ungefähr zur Hälfte abgeschlossen. Wir würden uns sehr freuen, wenn Sie sich drei Minuten Zeit nehmen, um uns eine kurze Rückmeldung zu geben. Die Umfrage ist anonym, und Ihre Antworten helfen uns, die zweite Kurshälfte optimal an Ihre Bedürfnisse anzupassen.`,
    },
  },
};

const SHARED = {
  en: {
    greeting: 'Hello :)',
    btn: 'Share feedback →',
    note: 'This link can be used once and remains valid for 90 days. Your responses are stored completely anonymously.',
    footer: 'If you have any questions, simply reply to this email or write to us at',
  },
  de: {
    greeting: 'Guten Tag :)',
    btn: 'Feedback abgeben →',
    note: 'Dieser Link kann einmalig verwendet werden und ist 90 Tage lang gültig. Ihre Antworten werden ohne Namensbezug gespeichert.',
    footer: 'Falls Sie Fragen haben, antworten Sie einfach auf diese E-Mail oder schreiben Sie an',
  },
};

/** Every piece of copy for one kind and language, for previews and tests. */
export function feedbackEmailCopy(kind, language, course = {}) {
  if (!isFeedbackKind(kind)) throw new Error(`Unknown feedback kind: ${kind}`);
  const lang = language === 'en' ? 'en' : 'de';
  const code = course?.course_code ? ` (${course.course_code})` : '';
  const copy = COPY[kind][lang];
  return {
    subject: copy.subject(code),
    intro: copy.intro(courseLabel(course, lang)),
    ...SHARED[lang],
  };
}

export function buildFeedbackEmail({ kind, course, feedbackUrl, language }) {
  const lang = language === 'en' ? 'en' : 'de';
  const copy = feedbackEmailCopy(kind, lang, course);

  return {
    subject: copy.subject,
    html: `<!DOCTYPE html>
<html lang="${lang}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f8fb;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f8fb;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;max-width:560px;width:100%;">
        <tr><td style="background:#1a1a1a;padding:32px 40px;">
          <p style="margin:0;color:#d6eaf8;font-family:Georgia,serif;font-size:13px;letter-spacing:0.2em;text-transform:uppercase;">learning with gioia</p>
        </td></tr>
        <tr><td style="padding:40px 40px 16px;">
          <p style="margin:0 0 24px;font-size:22px;font-weight:normal;color:#1a1a1a;font-family:Georgia,serif;">${esc(copy.greeting)}</p>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#333;">${esc(copy.intro)}</p>
        </td></tr>
        <tr><td style="padding:0 40px 32px;">
          <p style="margin:0 0 12px;">
            <a href="${esc(feedbackUrl)}" style="display:inline-block;background:#1a1a1a;color:#d6eaf8;text-decoration:none;padding:10px 14px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;">${esc(copy.btn)}</a>
          </p>
          <p style="margin:0;font-size:12px;color:#aaa;line-height:1.6;">${esc(copy.note)}</p>
        </td></tr>
        <tr><td style="padding:24px 40px 32px;border-top:1px solid #eee;">
          <p style="margin:0;font-size:13px;color:#aaa;line-height:1.6;">
            ${esc(copy.footer)}
            <a href="mailto:info@learningwithgioia.ch" style="color:#1a1a1a;">info@learningwithgioia.ch</a>.
          </p>
          <p style="margin:16px 0 0;font-size:13px;color:#aaa;">
            <a href="https://learningwithgioia.ch" style="color:#aaa;">learningwithgioia.ch</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  };
}
