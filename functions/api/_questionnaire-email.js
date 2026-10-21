// functions/api/_questionnaire-email.js
// The email that asks a student to fill in the pre-course questionnaire.
// Pure: no I/O, unit tested in tests/questionnaire.test.mjs.
// German is formal (Sie) throughout.

import { esc, courseLabel } from './_feedback-email.js';

const COPY = {
  en: {
    subject: (code) => `Before your course starts${code} — learning with gioia`,
    greeting: (name) => `Hello${name ? ' ' + name : ''} :)`,
    intro: (label) =>
      `We are looking forward to your ${label}! So that we can plan the lessons around you, we would be grateful if you could take about five minutes before the course starts to tell us about your goals and how you like to learn.`,
    btn: 'Fill in the questionnaire →',
    note: 'This link is personal, can be used once and remains valid for 90 days. Only your teacher sees your answers.',
    footer: 'If you have any questions, simply reply to this email or write to us at',
  },
  de: {
    subject: (code) => `Vor Ihrem Kursbeginn${code} — learning with gioia`,
    greeting: (name) => `Guten Tag${name ? ' ' + name : ''} :)`,
    intro: (label) =>
      `Wir freuen uns auf Ihren ${label}! Damit wir den Unterricht auf Sie abstimmen können, würden wir uns freuen, wenn Sie sich vor Kursbeginn etwa fünf Minuten Zeit nehmen, um uns von Ihren Zielen und Ihrer Art zu lernen zu erzählen.`,
    btn: 'Fragebogen ausfüllen →',
    note: 'Dieser Link ist persönlich, kann einmalig verwendet werden und ist 90 Tage lang gültig. Nur Ihre Lehrperson sieht Ihre Antworten.',
    footer: 'Falls Sie Fragen haben, antworten Sie einfach auf diese E-Mail oder schreiben Sie an',
  },
};

/** Every piece of copy in one language, for previews and tests. */
export function questionnaireEmailCopy(language, course = {}, firstName = '') {
  const lang = language === 'en' ? 'en' : 'de';
  const copy = COPY[lang];
  const code = course?.course_code ? ` (${course.course_code})` : '';
  return {
    subject: copy.subject(code),
    greeting: copy.greeting(String(firstName || '').trim()),
    intro: copy.intro(courseLabel(course, lang)),
    btn: copy.btn,
    note: copy.note,
    footer: copy.footer,
  };
}

export function buildQuestionnaireEmail({ course, firstName, questionnaireUrl, language }) {
  const lang = language === 'en' ? 'en' : 'de';
  const copy = questionnaireEmailCopy(lang, course, firstName);

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
            <a href="${esc(questionnaireUrl)}" style="display:inline-block;background:#1a1a1a;color:#d6eaf8;text-decoration:none;padding:10px 14px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;">${esc(copy.btn)}</a>
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
