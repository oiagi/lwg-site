// functions/api/_questionnaire.js
// Single source of truth for the pre-course questionnaire: what students are
// asked before a course starts (how they like to work, their goals, what the
// teacher should plan around). Shared by questionnaire.js (public form API),
// send-questionnaire-request.js, get-questionnaires.js, get-courses.js and
// get-student-detail.js. Keep this file free of I/O — it is unit tested
// directly (tests/questionnaire.test.mjs).
//
// Unlike the feedback forms, answers are tied to the student: they live on
// the request row itself (course_questionnaires.answers, JSON keyed by
// question id), so the teacher can plan around each person. The rendering,
// profile filtering and validation come from _feedback.js.
//
// Every German string is in the formal "Sie" form and Swiss spelling (ss).

import {
  buildQuestionSet,
  validateAnswers,
  askedFields,
  otherKey,
  fillWording,
} from './_feedback.js';

/** Questionnaire links stay valid for 90 days, same as feedback and intake. */
export const TOKEN_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

export const QUESTIONNAIRE_MINUTES = { de: '5 Minuten', en: '5 minutes' };

/** The answers the admin shows at a glance, for lesson planning. */
export const PLANNING_FIELD_IDS = [
  'documents_format',
  'absences',
  'contact_channel',
  'homework_delivery',
];

/** Under the contact and homework questions: in a group, one channel for all. */
const GROUP_MAJORITY_HINT = {
  de: 'Bitte wählen Sie eine Option. In Gruppenkursen gilt für alle, was die Mehrheit wählt, damit alle Teilnehmenden dieselben Informationen zur selben Zeit erhalten.',
  en: 'Please choose one option. In group courses, the option chosen by most students applies to everyone, so that all students receive the same information at the same time.',
};

/* Field format: see the question registry comment in _feedback.js. */
export const QUESTIONNAIRE_FIELDS = [
  // step 0 — about you
  {
    id: 'prior_experience',
    type: 'choice',
    step: 0,
    required: true,
    profiles: ['language'],
    short: { de: 'Vorkenntnisse', en: 'prior experience' },
    de: 'Wie lange haben Sie bereits {subject} gelernt?',
    en: 'How long have you been learning {subject}?',
    options: [
      { value: 'never', de: 'Noch gar nicht', en: 'Not at all yet' },
      { value: 'under_6m', de: 'Weniger als 6 Monate', en: 'Less than 6 months' },
      { value: '6_12m', de: '6 bis 12 Monate', en: '6 to 12 months' },
      { value: '1_3y', de: '1 bis 3 Jahre', en: '1 to 3 years' },
      { value: 'over_3y', de: 'Mehr als 3 Jahre', en: 'More than 3 years' },
    ],
  },
  {
    id: 'prior_where',
    type: 'text',
    step: 0,
    profiles: ['language'],
    showIf: { id: 'prior_experience', values: ['under_6m', '6_12m', '1_3y', 'over_3y'] },
    short: { de: 'Bisher gelernt', en: 'learned so far' },
    de: 'Wo und wie haben Sie bisher gelernt?',
    en: 'Where and how have you learned so far?',
    hint: {
      de: 'Zum Beispiel Schule, Sprachschule, App, Alltag.',
      en: 'For example school, a language school, an app, everyday life.',
    },
  },
  {
    id: 'self_level',
    type: 'choice',
    step: 0,
    required: true,
    profiles: ['language'],
    short: { de: 'Eigene Einschätzung', en: 'self-rated level' },
    de: 'Wie schätzen Sie Ihr aktuelles Niveau ein?',
    en: 'How would you rate your current level?',
    hint: {
      de: 'Eine Beschreibung der Niveaus finden Sie unter learningwithgioia.ch/de/niveaus.',
      en: 'You will find a description of the levels at learningwithgioia.ch/en/niveaus.',
    },
    options: [
      { value: 'A0', de: 'Anfänger/in ohne Vorkenntnisse', en: 'Complete beginner' },
      { value: 'A1', de: 'A1', en: 'A1' },
      { value: 'A2', de: 'A2', en: 'A2' },
      { value: 'B1', de: 'B1', en: 'B1' },
      { value: 'B2', de: 'B2', en: 'B2' },
      { value: 'C1', de: 'C1 oder höher', en: 'C1 or above' },
      { value: 'unsure', de: 'Ich weiss es nicht', en: 'I am not sure' },
    ],
  },
  {
    id: 'other_languages',
    type: 'text',
    step: 0,
    profiles: ['language'],
    short: { de: 'Andere Sprachen', en: 'other languages' },
    de: 'Welche anderen Sprachen sprechen Sie?',
    en: 'Which other languages do you speak?',
    hint: {
      de: 'Das hilft uns, Grammatik mit Sprachen zu vergleichen, die Sie schon kennen.',
      en: 'This helps us compare grammar with languages you already know.',
    },
  },
  {
    id: 'past_difficulties',
    type: 'text',
    step: 0,
    short: { de: 'Was nicht geholfen hat', en: "what hasn't worked" },
    de: 'Was hat Ihnen beim Lernen bisher nicht geholfen oder Mühe bereitet?',
    en: "What hasn't worked for you or has been difficult when learning so far?",
  },

  // step 1 — goals
  {
    id: 'goals',
    type: 'text',
    step: 1,
    required: true,
    short: { de: 'Ziele', en: 'goals' },
    de: 'Was sind Ihre Ziele für diesen Kurs?',
    en: 'What are your goals for this course?',
    hint: {
      de: 'Zum Beispiel im Alltag zurechtkommen, im Beruf sicherer werden, eine Prüfung bestehen.',
      en: 'For example getting by in everyday life, feeling more confident at work, passing an exam.',
    },
  },
  {
    id: 'focus_skills',
    type: 'multi',
    step: 1,
    required: true,
    profiles: ['language'],
    short: { de: 'Schwerpunkte', en: 'focus' },
    de: 'Woran möchten Sie vor allem arbeiten?',
    en: 'What would you most like to work on?',
    hint: {
      de: 'Wählen Sie, was Ihnen am wichtigsten ist.',
      en: 'Choose what matters most to you.',
    },
    options: [
      { value: 'speaking', de: 'Sprechen', en: 'Speaking' },
      { value: 'listening', de: 'Hörverstehen', en: 'Listening' },
      { value: 'reading', de: 'Lesen', en: 'Reading' },
      { value: 'writing', de: 'Schreiben', en: 'Writing' },
      { value: 'grammar', de: 'Grammatik', en: 'Grammar' },
      { value: 'pronunciation', de: 'Aussprache', en: 'Pronunciation' },
      { value: 'vocabulary', de: 'Wortschatz', en: 'Vocabulary' },
    ],
  },
  {
    id: 'exam',
    type: 'choice',
    step: 1,
    other: true,
    profiles: ['language'],
    short: { de: 'Prüfung', en: 'exam' },
    de: 'Bereiten Sie sich auf eine Prüfung vor?',
    en: 'Are you preparing for an exam?',
    options: [
      { value: 'no', de: 'Nein', en: 'No' },
      {
        value: 'goethe',
        de: 'Goethe-Zertifikat',
        en: 'Goethe certificate',
        subjects: ['german', 'deutsch'],
      },
      { value: 'telc', de: 'telc', en: 'telc', subjects: ['german', 'deutsch'] },
      { value: 'osd', de: 'ÖSD', en: 'ÖSD', subjects: ['german', 'deutsch'] },
      {
        value: 'fide',
        de: 'fide (Aufenthaltsbewilligung oder Einbürgerung)',
        en: 'fide (residence permit or citizenship)',
        subjects: ['german', 'deutsch'],
      },
      { value: 'other', de: 'Andere Prüfung', en: 'Another exam' },
    ],
  },
  {
    id: 'vocab_topics',
    type: 'text',
    step: 1,
    profiles: ['language'],
    short: { de: 'Wortschatzthemen', en: 'vocabulary topics' },
    de: 'Gibt es Wortschatzthemen, die Sie in diesem Kurs behandeln möchten?',
    en: 'Are there any vocabulary topics you would like to work on in this course?',
    hint: {
      de: 'Zum Beispiel Arbeit, Arztbesuch, Wohnungssuche, Freizeit.',
      en: 'For example work, seeing a doctor, flat hunting, free time.',
    },
  },
  {
    id: 'swiss_german',
    type: 'choice',
    step: 1,
    profiles: ['language'],
    subjects: ['german', 'deutsch'],
    short: { de: 'Schweizerdeutsch', en: 'Swiss German' },
    de: 'Möchten Sie nebenbei auch etwas Schweizerdeutsch und typisch schweizerische Ausdrücke kennenlernen?',
    en: 'Would you also like some exposure to Swiss German and typically Swiss expressions?',
    options: [
      { value: 'yes', de: 'Ja, gerne', en: 'Yes, please' },
      { value: 'no', de: 'Nein, nur Hochdeutsch', en: 'No, standard German only' },
      { value: 'unsure', de: 'Ich weiss es noch nicht', en: 'Not sure yet' },
    ],
  },

  // step 2 — how we work
  {
    id: 'instruction_language',
    type: 'choice',
    step: 2,
    required: true,
    profiles: ['language'],
    short: { de: 'Unterrichtssprache', en: 'teaching language' },
    de: 'In welcher Sprache sollen Erklärungen im Unterricht sein?',
    en: 'Which language should explanations in class be in?',
    options: [
      {
        value: 'target_only',
        de: 'Nur {subject}. {bridge} nur, um ein bestimmtes Wort oder eine Wendung zu übersetzen.',
        en: 'Only {subject}. {bridge} only to translate a specific word or phrase.',
      },
      {
        value: 'bridge_when_needed',
        de: 'Möglichst {subject}, aber Erklärungen auf {bridge}, wenn nötig.',
        en: 'As much {subject} as possible, but explanations in {bridge} when needed.',
      },
      { value: 'no_preference', de: 'Keine Präferenz', en: 'No preference' },
    ],
  },
  {
    id: 'correction_style',
    type: 'choice',
    step: 2,
    required: true,
    short: { de: 'Korrekturen', en: 'corrections' },
    de: 'Wie möchten Sie korrigiert werden?',
    en: 'How would you like to be corrected?',
    options: [
      {
        value: 'immediately',
        de: 'Sofort, wenn ein Fehler passiert',
        en: 'Right away when I make a mistake',
      },
      { value: 'after_activity', de: 'Am Ende einer Übung', en: 'At the end of an activity' },
      {
        value: 'important_only',
        de: 'Nur bei wichtigen Fehlern',
        en: 'Only for important mistakes',
      },
      { value: 'no_preference', de: 'Keine Präferenz', en: 'No preference' },
    ],
  },
  {
    id: 'coursebook',
    type: 'choice',
    step: 2,
    required: true,
    short: { de: 'Lehrmittel', en: 'coursebook' },
    de: 'Möchten Sie mit einem Lehrbuch arbeiten?',
    en: 'Would you like to work with a coursebook?',
    options: [
      {
        value: 'coursebook_plus',
        de: 'Ja, mit einem Lehrbuch und zusätzlichen Materialien',
        en: 'Yes, a coursebook supplemented with additional materials',
      },
      {
        value: 'various_materials',
        de: 'Nein, Arbeitsblätter und Materialien aus verschiedenen Quellen sind in Ordnung',
        en: 'No, handouts and materials from various sources are ok',
      },
      { value: 'no_preference', de: 'Keine Präferenz', en: 'No preference' },
    ],
  },
  {
    id: 'documents_format',
    type: 'choice',
    step: 2,
    required: true,
    short: { de: 'Unterlagen', en: 'documents' },
    de: 'Wie möchten Sie Ihre Unterlagen erhalten?',
    en: 'How would you like to receive your documents?',
    options: [
      { value: 'electronic', de: 'Elektronisch', en: 'Electronically' },
      { value: 'printed', de: 'Ausgedruckt', en: 'Printed' },
      { value: 'both', de: 'Beides', en: 'Both' },
    ],
  },
  {
    id: 'contact_channel',
    type: 'choice',
    step: 2,
    required: true,
    short: { de: 'Kontakt', en: 'contact' },
    de: 'Wie möchten Sie ausserhalb des Unterrichts mit uns in Kontakt sein?',
    en: 'How would you like us to be in touch outside of class?',
    hint: GROUP_MAJORITY_HINT,
    options: [
      { value: 'whatsapp', de: 'Per WhatsApp', en: 'Via WhatsApp' },
      { value: 'email', de: 'Per E-Mail', en: 'Via email' },
      {
        value: 'admin_only',
        de: 'Kein Kontakt ausserhalb des Unterrichts, ausser zu organisatorischen Fragen',
        en: 'No contact outside of class, except about course administration',
      },
    ],
  },
  {
    id: 'homework_time',
    type: 'choice',
    step: 2,
    required: true,
    short: { de: 'Zeit für Hausaufgaben', en: 'homework time' },
    de: 'Wie viel Zeit haben Sie pro Woche für Hausaufgaben?',
    en: 'How much time do you have for homework each week?',
    options: [
      { value: 'none', de: 'Keine', en: 'None' },
      { value: 'under_30m', de: 'Weniger als 30 Minuten', en: 'Less than 30 minutes' },
      { value: '30_60m', de: '30 bis 60 Minuten', en: '30 to 60 minutes' },
      { value: '1_2h', de: '1 bis 2 Stunden', en: '1 to 2 hours' },
      { value: 'over_2h', de: 'Mehr als 2 Stunden', en: 'More than 2 hours' },
    ],
  },
  {
    id: 'homework_delivery',
    type: 'choice',
    step: 2,
    required: true,
    showIf: { id: 'homework_time', values: ['under_30m', '30_60m', '1_2h', 'over_2h'] },
    short: { de: 'Hausaufgaben erhalten', en: 'homework delivery' },
    de: 'Wie möchten Sie Ihre Hausaufgaben erhalten?',
    en: 'How would you like to receive your homework?',
    hint: GROUP_MAJORITY_HINT,
    options: [
      { value: 'end_of_lesson', de: 'Am Ende der Lektion', en: 'At the end of the lesson' },
      { value: 'whatsapp', de: 'Per WhatsApp', en: 'Via WhatsApp' },
      { value: 'email', de: 'Per E-Mail', en: 'Via email' },
    ],
  },
  {
    id: 'learning_needs',
    type: 'text',
    step: 2,
    short: { de: 'Besondere Bedürfnisse', en: 'learning needs' },
    de: 'Gibt es etwas, das beeinflusst, wie Sie lernen?',
    en: 'Is there anything that affects how you learn?',
    hint: {
      de: 'Zum Beispiel Legasthenie oder Konzentrationsschwierigkeiten. Freiwillig, nur Ihre Lehrperson sieht diese Angabe.',
      en: 'For example dyslexia or difficulty concentrating. Optional, only your teacher sees this.',
    },
  },

  // step 3 — planning
  {
    id: 'absences',
    type: 'text',
    step: 3,
    short: { de: 'Geplante Abwesenheiten', en: 'planned absences' },
    de: 'Wissen Sie schon von Daten, an denen Sie nicht teilnehmen können?',
    en: 'Do you already know of any dates you will miss?',
    hint: {
      de: 'Lektionen können wegen geplanter Abwesenheiten nicht verschoben werden. Wenn Ihre Lehrperson aber davon weiss, kann sie die Themen entsprechend planen.',
      en: 'Lessons cannot be postponed because of planned absences, but knowing about them helps your teacher plan topics around them.',
    },
  },
  {
    id: 'anything_else',
    type: 'text',
    step: 3,
    short: { de: 'Sonstiges', en: 'anything else' },
    de: 'Gibt es sonst noch etwas, das Ihre Lehrperson wissen sollte?',
    en: 'Is there anything else your teacher should know?',
  },
];

/** The questionnaire as the public form shows it, in one language. */
export function questionnaireForLanguage(language, course = null) {
  return buildQuestionSet(QUESTIONNAIRE_FIELDS, {
    language,
    course,
    minutes: QUESTIONNAIRE_MINUTES,
  });
}

/** Validate a submission; see validateAnswers in _feedback.js. */
export function validateQuestionnaire(body, course = null) {
  return validateAnswers(QUESTIONNAIRE_FIELDS, body, course);
}

function fieldById(id) {
  return QUESTIONNAIRE_FIELDS.find((f) => f.id === id) || null;
}

/** One stored answer as display text, or null when there is nothing to show. */
export function answerText(id, answers, course = null, language = 'en') {
  const lang = language === 'de' ? 'de' : 'en';
  const field = fieldById(id);
  const stored = answers?.[id];
  if (!field || stored === null || stored === undefined || stored === '') return null;
  if (Array.isArray(stored) && !stored.length) return null;
  if (field.type === 'text') return String(stored);

  const label = (value) => {
    const option = (field.options || []).find((o) => o.value === value);
    return option ? fillWording(option[lang], course, lang) : String(value);
  };
  const text = (Array.isArray(stored) ? stored : [stored]).map(label).join(', ');
  const other = field.other ? answers?.[otherKey(field)] : null;
  return other ? `${text} (${other})` : text;
}

/**
 * Every answered question as { id, label, text }, in form order, for the
 * admin and the notification email. Questions the course never asked or
 * the student left blank are left out.
 */
export function labelledAnswers(answers, course = null, language = 'en') {
  const lang = language === 'de' ? 'de' : 'en';
  const fields = course ? askedFields(QUESTIONNAIRE_FIELDS, course) : QUESTIONNAIRE_FIELDS;
  return fields
    .map((field) => ({
      id: field.id,
      label: field.short[lang],
      text: answerText(field.id, answers, course, lang),
    }))
    .filter((row) => row.text !== null);
}

/**
 * The planning answers only (documents format, planned absences, contact
 * channel, how homework is handed out), so course and student overviews
 * can show them without the whole JSON.
 */
export function planningAnswers(answers) {
  const absences = typeof answers?.absences === 'string' ? answers.absences.trim() || null : null;
  return {
    documents_format: answers?.documents_format || null,
    absences,
    contact_channel: answers?.contact_channel || null,
    homework_delivery: answers?.homework_delivery || null,
  };
}

/**
 * What a submission adds to the student record: the goals and the
 * self-rated level, each only when the record has nothing there yet, so
 * the teacher's own notes are never overwritten. Returns a PATCH body,
 * empty when there is nothing to add.
 */
export function syncStudentFields(answers, student) {
  const isBlank = (v) => v === null || v === undefined || String(v).trim() === '';
  const patch = {};
  if (isBlank(student?.learning_goals) && !isBlank(answers?.goals)) {
    patch.learning_goals = String(answers.goals).trim();
  }
  const level = answers?.self_level;
  if (isBlank(student?.current_level) && level && level !== 'unsure') {
    patch.current_level = level;
  }
  return patch;
}
