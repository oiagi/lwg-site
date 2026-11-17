// functions/api/_course-letter-email.js
// The course letter: one email that can carry up to three parts, chosen per
// student in the admin's send dialog.
//   invoice        — the PDF (with QR bill) is attached, the letter names the
//                    due date
//   confirmation   — course details, lesson list, cancellation callout and the
//                    full AGB below the sign-off
//   questionnaire  — the personal link to the pre-course questionnaire
// Every paragraph belongs to one part and drops out with it, so any
// combination reads as one letter. The questionnaire on its own stays the
// separate email in _questionnaire-email.js.
// Pure: no I/O, covered by tests/course-letter-email.test.mjs.

import {
  esc,
  formatDate,
  invoiceGreeting,
  emailShell,
  bodyParagraph,
  SIGNATURE_NAME,
} from './_invoice-email.js';
import { courseInfoSectionsHtml } from './_course-confirmation-email.js';
import { questionnaireEmailCopy } from './_questionnaire-email.js';

const COPY = {
  de: {
    thanks: 'Danke, dass Sie mit uns lernen.',
    details: 'Unten finden Sie alle wichtigen Infos zu Ihrem Kurs.',
    invoice: 'Die Rechnung für Ihre Buchung finden Sie im Anhang dieser Nachricht.',
    // The due date already encodes the payment rule (course start when more
    // than 30 days out, otherwise invoice + 30 days), so one sentence serves
    // both cases. See public/admin/core/invoice-terms.js.
    payment: (dueDate) =>
      `Sie können sie bequem mit dem QR-Zahlteil im PDF begleichen. Wir bitten Sie, den Rechnungsbetrag bis zum ${dueDate} auf unser Bankkonto zu überweisen.`,
    paymentNoDate: 'Die Zahlungsdetails finden Sie direkt im angehängten PDF.',
    questions: 'Bei Fragen antworten Sie gerne direkt auf diese E-Mail.',
    sign: 'Herzliche Grüsse',
    titleInvoice: (no) => `Rechnung ${no}`,
    titleConfirmation: 'Kursbestätigung',
    titleBoth: (no) => `Kursbestätigung und Rechnung ${no}`,
    courseFallback: 'Ihr Kurs',
  },
  en: {
    thanks: 'Thank you for learning with us.',
    details: 'Below you will find all the important information about your course.',
    invoice: 'You will find the invoice for your booking attached to this message.',
    payment: (dueDate) =>
      `You can pay it easily with the QR bill in the PDF. We kindly ask you to transfer the invoice amount to our bank account by ${dueDate}.`,
    paymentNoDate: 'You will find the payment details directly in the attached PDF.',
    questions: 'Should you have any questions, please reply to this email.',
    sign: 'Warm regards,',
    titleInvoice: (no) => `Invoice ${no}`,
    titleConfirmation: 'Course confirmation',
    titleBoth: (no) => `Course confirmation and invoice ${no}`,
    courseFallback: 'your course',
  },
};

const BRAND = 'learning with gioia';

function titles({ copy, hasInvoice, hasConfirmation, invoiceNo, course }) {
  if (hasInvoice && hasConfirmation) {
    const title = copy.titleBoth(invoiceNo);
    return { title, subject: `${title} · ${BRAND}` };
  }
  if (hasInvoice) {
    const title = copy.titleInvoice(invoiceNo);
    return { title, subject: `${title} · ${BRAND}` };
  }
  return {
    title: copy.titleConfirmation,
    subject: `${copy.titleConfirmation} - ${course?.course_code || copy.courseFallback} · ${BRAND}`,
  };
}

/**
 * @param {object}  args
 * @param {object}  args.parts            - { invoice, confirmation, questionnaire }
 * @param {object}  [args.invoice]        - required when parts.invoice
 * @param {object}  [args.course]         - required for the confirmation blocks
 *   and the welcome sentence
 * @param {string}  [args.questionnaireUrl] - without it the questionnaire
 *   paragraph is left out (the student has already answered)
 * @param {boolean} [args.forPayer]       - the recipient pays but is not the
 *   learner, so the "looking forward to your course" sentence is left out
 * @param {object}  [args.booking]        - { lessons, total } override for the
 *   details table when no invoice supplies them
 */
export function buildCourseLetterEmail({
  language,
  parts = {},
  name = '',
  first_name = '',
  last_name = '',
  gender = '',
  invoice = null,
  course = null,
  sessions = [],
  joinedAt = null,
  questionnaireUrl = null,
  forPayer = false,
  booking = null,
}) {
  const lang = language === 'en' ? 'en' : 'de';
  const copy = COPY[lang];
  const hasInvoice = Boolean(parts.invoice && invoice);
  const hasConfirmation = Boolean(parts.confirmation && course);
  const hasQuestionnaire = Boolean(parts.questionnaire && questionnaireUrl);
  const questionnaire = questionnaireEmailCopy(lang, course || {});

  const { title, subject } = titles({
    copy,
    hasInvoice,
    hasConfirmation,
    invoiceNo: invoice?.invoice_number || '',
    course,
  });

  const opening = [
    course && !forPayer ? questionnaire.welcome : null,
    copy.thanks,
    hasConfirmation ? copy.details : null,
  ]
    .filter(Boolean)
    .join(' ');

  const questionnaireHtml = hasQuestionnaire
    ? [
        bodyParagraph(questionnaire.ask),
        `<p style="margin:0 0 12px;">
              <a href="${esc(questionnaireUrl)}" style="display:inline-block;background:#1a1a1a;color:#d6eaf8;text-decoration:none;padding:10px 14px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;">${esc(questionnaire.btn)}</a>
            </p>`,
        `<p style="margin:0 0 24px;font-size:12px;color:#aaa;line-height:1.6;">${esc(questionnaire.note)}</p>`,
      ]
    : [];

  const dueDate = hasInvoice && invoice.due_date ? formatDate(invoice.due_date, lang) : '';
  const invoiceHtml = hasInvoice
    ? [bodyParagraph(`${copy.invoice} ${dueDate ? copy.payment(dueDate) : copy.paymentNoDate}`)]
    : [];

  const bodyHtml = [
    `<p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#1a1a1a;">${esc(
      invoiceGreeting({ language: lang, name, first_name, last_name, gender })
    )}</p>`,
    bodyParagraph(opening),
    ...questionnaireHtml,
    ...invoiceHtml,
    bodyParagraph(copy.questions, '0 0 24px'),
    bodyParagraph(copy.sign, '0 0 4px'),
    bodyParagraph(SIGNATURE_NAME, '0'),
  ].join('\n');

  // The details table shows what this student is billed for, not the
  // course-level booking, so it always agrees with the PDF.
  const billed = hasInvoice
    ? { lessons: invoice.quantity, total: invoice.total_amount }
    : booking || {};
  const sectionsHtml = hasConfirmation
    ? courseInfoSectionsHtml({
        course,
        sessions,
        language: lang,
        includeAgb: true,
        joinedAt,
        booking: billed,
      })
    : '';

  return {
    subject,
    html: emailShell({ language: lang, title, bodyHtml, sectionsHtml }),
    // What actually made it into the email, for the caller's bookkeeping.
    parts: {
      invoice: hasInvoice,
      confirmation: hasConfirmation,
      questionnaire: hasQuestionnaire,
    },
  };
}
