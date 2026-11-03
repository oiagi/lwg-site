/* ── Pre-course questionnaire ─────────────────────────────────────────
   Render helpers for the answers students give before a course starts.
   Some answers matter for lesson planning and are shown at a glance
   wherever students appear: how they want their documents (printed /
   electronic), how to reach them outside class and how they get their
   homework. The full answers sit on the student page. Labels come from
   the API (functions/api/_questionnaire.js), so nothing here repeats
   the question wording.

   Planned absences have their own block: the date ranges the student
   marked in the calendar (absence_periods rows, source 'questionnaire')
   plus any the admin added by hand, each removable, with two date
   inputs to add another. Questionnaires answered before the calendar
   existed hold free text instead; that still shows as a line.         */
import { esc, dl } from '../core/helpers.js';

const fmtDate = (value) => new Date(value).toLocaleDateString('de-CH');

/* '2026-11-03' → '03.11.2026' without going through the local time zone. */
function fmtIsoDay(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? `${m[3]}.${m[2]}.${m[1]}` : String(iso || '');
}

/** One absence period as text: a day, or 'from – to'. */
export function formatPeriod(period) {
  const from = fmtIsoDay(period.start_date);
  const to = fmtIsoDay(period.end_date || period.start_date);
  return from === to ? from : `${from} – ${to}`;
}

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
 * documents, contact and homework. Absences typed as free text (before
 * the calendar) are shown in full here; calendar absences are periods
 * and come from absencePeriodsHtml instead.
 */
export function participantPlanningHtml(questionnaire) {
  if (!questionnaire) return '';
  if (!questionnaire.submitted_at) {
    return `<div class="planning-row"><span class="detail-muted">questionnaire sent · not answered yet</span></div>`;
  }
  const absences =
    typeof questionnaire.absences === 'string' && questionnaire.absences
      ? `<p class="planning-absences"><span class="planning-absences-label">absences:</span> ${esc(questionnaire.absences)}</p>`
      : '';
  const tags = [
    documentsTag(questionnaire.documents_format),
    plainTag('contact', CONTACT_LABELS, questionnaire.contact_channel),
    plainTag('homework', HOMEWORK_LABELS, questionnaire.homework_delivery),
  ].join('');
  return `<div class="planning-row">${tags}</div>${absences}`;
}

const SOURCE_LABELS = { questionnaire: 'questionnaire', admin: 'added by you' };

/**
 * The planned absences of one participant in a course: a chip per period
 * with its source and a remove button, then two date inputs and a button
 * to add one. Rendered for every participant, questionnaire or not, since
 * the admin can add periods for anyone. Lessons inside these periods are
 * flagged on the session rows and pre-filled as absent in the log modal.
 */
export function absencePeriodsHtml(student, courseId) {
  const periods = student.absence_periods || [];
  const key = `${courseId}-${student.id}`;
  const chips = periods
    .map(
      (p) => `<span class="absence-chip">
        <span>${esc(formatPeriod(p))}</span>
        <span class="absence-source">${esc(SOURCE_LABELS[p.source] || p.source || '')}</span>
        <button type="button" class="absence-remove" data-action="removeAbsencePeriod"
          data-args="${esc(p.id)}" title="remove this absence"
          aria-label="remove absence ${esc(formatPeriod(p))}">×</button>
      </span>`
    )
    .join('');
  return `
    <div class="absence-block" id="absence-block-${esc(key)}">
      <span class="absence-label">planned absences:</span>
      ${chips || '<span class="detail-muted">none</span>'}
      <span class="absence-add">
        <label class="participant-inline-field participant-inline-field--date" for="absence-from-${esc(key)}">
          <span>from</span>
          <input type="date" id="absence-from-${esc(key)}">
        </label>
        <label class="participant-inline-field participant-inline-field--date" for="absence-to-${esc(key)}">
          <span>to</span>
          <input type="date" id="absence-to-${esc(key)}">
        </label>
        <button type="button" class="action-btn" data-action="addAbsencePeriod"
          data-args="${esc(courseId)},${esc(student.id)}">add absence</button>
      </span>
      <span class="absence-error" id="absence-error-${esc(key)}"></span>
    </div>`;
}

/** The tag that goes with the other course emails in a participant row. */
export function questionnaireSentTag(questionnaire) {
  if (!questionnaire) return '';
  return questionnaire.submitted_at
    ? `<span class="sent-tag paid-tag">questionnaire answered · ${esc(fmtDate(questionnaire.submitted_at))}</span>`
    : `<span class="sent-tag">questionnaire sent · ${esc(fmtDate(questionnaire.requested_at))}</span>`;
}

/** True when a participant has planned absences, from the calendar, the admin or old free text. */
export function hasPlannedAbsences(student) {
  return Boolean(
    student.absence_periods?.length ||
    (typeof student.questionnaire?.absences === 'string' && student.questionnaire.absences)
  );
}

/**
 * One line for the course list: "2 printed · 1 electronic · absences: 1 ·
 * 1 not answered". Empty when no questionnaire was sent for the course
 * and nobody has planned absences.
 */
export function coursePlanningLine(students) {
  const all = students || [];
  const asked = all.filter((s) => s.questionnaire);
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
  const absent = all.filter(hasPlannedAbsences).length;
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
