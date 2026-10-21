/* ── Pre-course questionnaire ─────────────────────────────────────────
   Render helpers for the answers students give before a course starts.
   Some answers matter for lesson planning and are shown at a glance
   wherever students appear: how they want their documents (printed /
   electronic), dates they already know they will miss, how to reach
   them outside class and how they get their homework. The full
   answers sit on the student page. Labels come from the API
   (functions/api/_questionnaire.js), so nothing here repeats the
   question wording.                                                    */
import { esc, dl } from '../core/helpers.js';

const fmtDate = (value) => new Date(value).toLocaleDateString('de-CH');

const DOCUMENT_LABELS = {
  printed: 'printed',
  electronic: 'electronic',
  both: 'printed + electronic',
};

/** Printed gets the stronger tag: those are the copies to prepare. */
function documentsTag(format) {
  const label = DOCUMENT_LABELS[format];
  if (!label) return '';
  const wantsPaper = format === 'printed' || format === 'both';
  return `<span class="planning-tag${wantsPaper ? ' planning-tag--print' : ''}">documents: ${esc(label)}</span>`;
}

const CONTACT_LABELS = {
  whatsapp: 'WhatsApp',
  email: 'email',
  admin_only: 'admin only',
};

const HOMEWORK_LABELS = {
  end_of_lesson: 'end of lesson',
  whatsapp: 'via WhatsApp',
  email: 'via email',
};

function plainTag(prefix, labels, value) {
  const label = labels[value];
  return label ? `<span class="planning-tag">${esc(prefix)}: ${esc(label)}</span>` : '';
}

/**
 * The planning answers for one participant row in a course: tags for
 * documents, contact and homework, and the planned absences in full.
 */
export function participantPlanningHtml(questionnaire) {
  if (!questionnaire) return '';
  if (!questionnaire.submitted_at) {
    return `<div class="planning-row"><span class="detail-muted">questionnaire sent · not answered yet</span></div>`;
  }
  const absences = questionnaire.absences
    ? `<p class="planning-absences"><span class="planning-absences-label">absences:</span> ${esc(questionnaire.absences)}</p>`
    : '';
  const tags = [
    documentsTag(questionnaire.documents_format),
    plainTag('contact', CONTACT_LABELS, questionnaire.contact_channel),
    plainTag('homework', HOMEWORK_LABELS, questionnaire.homework_delivery),
  ].join('');
  return `<div class="planning-row">${tags}</div>${absences}`;
}

/** The tag that goes with the other course emails in a participant row. */
export function questionnaireSentTag(questionnaire) {
  if (!questionnaire) return '';
  return questionnaire.submitted_at
    ? `<span class="sent-tag paid-tag">questionnaire answered · ${esc(fmtDate(questionnaire.submitted_at))}</span>`
    : `<span class="sent-tag">questionnaire sent · ${esc(fmtDate(questionnaire.requested_at))}</span>`;
}

/**
 * One line for the course list: "2 printed · 1 electronic · absences: 1 ·
 * 1 not answered". Empty when no questionnaire was sent for the course.
 */
export function coursePlanningLine(students) {
  const asked = (students || []).filter((s) => s.questionnaire);
  if (!asked.length) return '';
  const answered = asked.filter((s) => s.questionnaire.submitted_at);
  const count = (format) =>
    answered.filter((s) => s.questionnaire.documents_format === format).length;
  const parts = [];
  const printed = count('printed');
  const both = count('both');
  const electronic = count('electronic');
  if (printed) parts.push(`<strong>${printed} printed</strong>`);
  if (both) parts.push(`<strong>${both} printed + electronic</strong>`);
  if (electronic) parts.push(`${electronic} electronic`);
  const absent = answered.filter((s) => s.questionnaire.absences).length;
  if (absent) parts.push(`absences: ${absent}`);
  const open = asked.length - answered.length;
  if (open) parts.push(`${open} not answered`);
  return parts.length ? `<span class="course-planning">${parts.join(' · ')}</span>` : '';
}

/** The student page section: one block per course, planning answers first. */
export function studentQuestionnaireSection(questionnaires) {
  if (!questionnaires?.length) return '';
  const blocks = questionnaires
    .map((q) => {
      const heading = `${esc(q.course_code || 'course')} · ${
        q.submitted_at
          ? `answered ${esc(fmtDate(q.submitted_at))}`
          : `sent ${esc(fmtDate(q.requested_at))}, not answered yet`
      }`;
      if (!q.submitted_at) return `<p class="detail-body detail-muted">${heading}</p>`;
      const planning = new Set([
        'documents_format',
        'absences',
        'contact_channel',
        'homework_delivery',
      ]);
      const highlighted = (q.answers || []).filter((a) => planning.has(a.id));
      const rest = (q.answers || []).filter((a) => !planning.has(a.id));
      return `
        <p class="detail-body">${heading}</p>
        ${highlighted.length ? `<div class="planning-highlight">${highlighted.map((a) => dl(a.label, a.text)).join('')}</div>` : ''}
        ${rest.map((a) => dl(a.label, a.text)).join('')}`;
    })
    .join('');
  return `
    <div class="detail-section">
      <p class="detail-meta">Pre-course questionnaire</p>
      ${blocks}
    </div>`;
}
