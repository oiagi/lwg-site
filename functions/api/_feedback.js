// functions/api/_feedback.js
// Single source of truth for the two course feedback forms (mid-course and
// end of course) plus the pure helpers that validate a submission and
// summarise a set of responses. Shared by feedback.js (public form API),
// send-feedback-request.js, get-feedback.js and get-courses.js, so the form,
// the admin views and the stored answers can never drift apart. Keep this
// file free of I/O — it is unit tested directly (tests/feedback.test.mjs).
//
// Answers are stored as one JSON object per response, keyed by question id
// (plus `<id>_other` for the free text next to an "other" option), so adding
// or rewording a question needs no migration. Responses carry no student
// reference at all — see supabase/migrations/add_course_feedback_responses.sql.
//
// Every German string is in the formal "Sie" form and Swiss spelling (ss).

/** Feedback links stay valid for 90 days, same as the intake links. */
export const TOKEN_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

/** Maximum length of each free-text answer. */
export const COMMENT_MAX_LENGTH = 2000;

/** Maximum length of an "other: ___" answer next to a choice. */
export const OTHER_MAX_LENGTH = 120;

/** Every scale on the form runs 1-10, the recommendation question included. */
export const RATING_MIN = 1;
export const RATING_MAX = 10;
export const NPS_MIN = 1;
export const NPS_MAX = 10;

/** Default endpoint labels for the ends of a 1-10 scale. */
export const RATING_SCALE_LABELS = {
  min: { de: 'schlecht', en: 'poor' },
  max: { de: 'ausgezeichnet', en: 'excellent' },
};

/** The two forms. A request row and a response row each carry one of these. */
export const FEEDBACK_KINDS = ['midterm', 'final'];
export const DEFAULT_KIND = 'final';

/** How each kind reads in the admin and in summaries. */
export const KIND_LABELS = {
  midterm: { de: 'Zwischenfeedback', en: 'mid-course' },
  final: { de: 'Abschlussfeedback', en: 'end of course' },
};

export function isFeedbackKind(kind) {
  return FEEDBACK_KINDS.includes(kind);
}

export function kindLabel(kind, language = 'en') {
  const lang = language === 'de' ? 'de' : 'en';
  return KIND_LABELS[kind]?.[lang] || kind;
}

/* ── Course profiles ──────────────────────────────────────────────────
   A maths tutoring student should not be asked whether they had enough
   opportunity to speak. Every question and every option may name the
   profiles it belongs to; leaving that out means "all profiles". The
   profiles are derived from the course, never asked — the form header
   already tells the student which course this is about.

   A course carries one subject profile ('language' or 'academic') and,
   when it prepares for an exam, the extra 'exam' profile on top. That is
   what lets Gymi-Deutsch keep the speaking questions and still be asked
   whether it left the student ready for the exam.                    */

/** The profiles a question can be tagged with. */
export const FEEDBACK_PROFILES = ['language', 'academic', 'exam'];

/** Used when there is no course to go by (e.g. a preview). */
export const DEFAULT_PROFILE = 'language';

/** Course types that prepare for an exam. */
const EXAM_COURSE_TYPES = new Set(['exam preparation', 'gymivorbereitung']);

const LANGUAGE_SUBJECTS = new Set([
  'german',
  'deutsch',
  'swiss german',
  'schweizerdeutsch',
  'english',
  'englisch',
  'french',
  'französisch',
  'franzoesisch',
  'italian',
  'italienisch',
  'spanish',
  'spanisch',
]);

/** Subjects we can name in a question; anything else uses a placeholder. */
const SUBJECT_LABELS = {
  german: { de: 'Deutsch', en: 'German' },
  deutsch: { de: 'Deutsch', en: 'German' },
  'swiss german': { de: 'Schweizerdeutsch', en: 'Swiss German' },
  schweizerdeutsch: { de: 'Schweizerdeutsch', en: 'Swiss German' },
  english: { de: 'Englisch', en: 'English' },
  englisch: { de: 'Englisch', en: 'English' },
  french: { de: 'Französisch', en: 'French' },
  französisch: { de: 'Französisch', en: 'French' },
  italian: { de: 'Italienisch', en: 'Italian' },
  spanish: { de: 'Spanisch', en: 'Spanish' },
  mathematics: { de: 'Mathematik', en: 'Mathematics' },
  mathematik: { de: 'Mathematik', en: 'Mathematics' },
  physics: { de: 'Physik', en: 'Physics' },
  physik: { de: 'Physik', en: 'Physics' },
};

/** What {subject} becomes when the course names no subject we know. */
const SUBJECT_PLACEHOLDER = {
  language: { de: 'diese Sprache', en: 'the language' },
  academic: { de: 'diesem Fach', en: 'this subject' },
};

/** How the course type reads on the form header. */
const COURSE_TYPE_LABELS = {
  'language course': { de: 'Sprachkurs', en: 'language course' },
  'exam preparation': { de: 'Prüfungsvorbereitung', en: 'exam preparation' },
  tutoring: { de: 'Nachhilfe', en: 'tutoring' },
  gymivorbereitung: { de: 'Gymivorbereitung', en: 'Gymi preparation' },
};

function normalise(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

/**
 * The subject profile a course's wording follows. Falls back through
 * subject → course type → CEFR-looking level, and lands on the language
 * profile when the course record says nothing useful.
 */
export function courseFeedbackProfile(course) {
  const subject = normalise(course?.subject);
  if (subject) return LANGUAGE_SUBJECTS.has(subject) ? 'language' : 'academic';

  const courseType = normalise(course?.course_type);
  if (courseType.includes('language')) return 'language';
  if (courseType) return 'academic';

  return /\b(ch)?[abc][12]\b/.test(normalise(course?.level)) ? 'language' : DEFAULT_PROFILE;
}

/** Every profile a course's questions are drawn from. */
export function courseFeedbackProfiles(course) {
  const profiles = [courseFeedbackProfile(course)];
  if (EXAM_COURSE_TYPES.has(normalise(course?.course_type))) profiles.push('exam');
  return profiles;
}

function subjectWord(course, profile, lang) {
  const label = SUBJECT_LABELS[normalise(course?.subject)];
  return label ? label[lang] : SUBJECT_PLACEHOLDER[profile][lang];
}

/** The course subject in one language, falling back to what was typed in. */
export function courseSubjectLabel(course, language = 'de') {
  const lang = language === 'en' ? 'en' : 'de';
  return SUBJECT_LABELS[normalise(course?.subject)]?.[lang] || course?.subject || '';
}

/**
 * The course as the form header names it, e.g. "Deutsch B1 · Sprachkurs"
 * or "Mathematics · tutoring". Empty when the record says nothing.
 */
export function courseDisplayName(course, language = 'de') {
  const lang = language === 'en' ? 'en' : 'de';
  const courseType = COURSE_TYPE_LABELS[normalise(course?.course_type)]?.[lang] || '';
  const subjectAndLevel = [courseSubjectLabel(course, lang), course?.level]
    .filter(Boolean)
    .join(' ');
  return [subjectAndLevel, courseType].filter(Boolean).join(' · ');
}

/* ── Question registry ────────────────────────────────────────────────
   One field:
     id        key in the stored answers JSON
     type      'scale' (1-10) | 'nps' (1-10, feeds the net promoter score)
               | 'choice' | 'multi' | 'text'
     step      zero-based page of the form the question sits on; steps have
               no titles, they only paginate
     short     label used in the admin views and summaries
     de / en   the question as the student reads it
     hint      optional helper line under the question
     options   for choice/multi: { value, de, en, profiles? }
     other     for choice/multi: true when "other" has a free-text box,
               stored under `<id>_other`
     required  blocks submission when unanswered (and shown)
     profiles  course profiles this question (or option) applies to
     byProfile per-profile overrides of the de/en wording
     scale     custom endpoint labels for scale/nps questions
     showIf    { id, values } — only asked when an earlier answer matches.
               A hidden question is stored as null whatever was posted.   */

const OTHER_OPTION = { value: 'other', de: 'Anderes', en: 'Other' };

const SATISFACTION_SCALE = {
  min: { de: 'sehr unzufrieden', en: 'very dissatisfied' },
  max: { de: 'sehr zufrieden', en: 'very satisfied' },
};

/** Shorthand for a required 1-10 statement. */
function statement(id, step, short, de, en, extra) {
  return { id, type: 'scale', step, required: true, short, de, en, ...extra };
}

/* ── End-of-course form ─────────────────────────────────────────────── */
const FINAL_FIELDS = [
  // step 0 — the ratings
  {
    id: 'satisfaction',
    type: 'scale',
    step: 0,
    required: true,
    short: { de: 'Gesamt', en: 'overall' },
    de: 'Wie zufrieden sind Sie insgesamt mit dem Unterricht?',
    en: 'Overall, how satisfied are you with the lessons?',
    scale: SATISFACTION_SCALE,
  },
  statement(
    'organisation',
    0,
    { de: 'Organisation', en: 'organisation' },
    'Der Unterricht war gut organisiert.',
    'The lessons were well organised.'
  ),
  statement(
    'teaching',
    0,
    { de: 'Erklärungen', en: 'explanations' },
    'Die Lehrperson hat die Inhalte klar erklärt.',
    'The teacher explained concepts clearly.'
  ),
  statement(
    'comfort',
    0,
    { de: 'Fragen stellen', en: 'asking questions' },
    'Ich habe mich wohl gefühlt, Fragen zu stellen.',
    'I felt comfortable asking questions.'
  ),
  statement(
    'pace',
    0,
    { de: 'Tempo', en: 'pace' },
    'Das Tempo des Unterrichts war meinem Niveau angemessen.',
    'The pace of the lesson was appropriate for my level.'
  ),
  statement(
    'materials',
    0,
    { de: 'Materialien', en: 'materials' },
    'Die Materialien waren nützlich.',
    'The materials were useful.'
  ),
  statement(
    'speaking',
    0,
    { de: 'Sprechzeit', en: 'speaking time' },
    'Ich hatte genug Gelegenheit zu sprechen.',
    'I had enough opportunities to speak.',
    { profiles: ['language'] }
  ),
  statement(
    'vocabulary',
    0,
    { de: 'Wortschatz', en: 'vocabulary' },
    'Ich habe Wortschatz gelernt, den ich im Alltag brauchen kann.',
    'I learned vocabulary that I can use in everyday life.',
    { profiles: ['language'] }
  ),
  statement(
    'exam_ready',
    0,
    { de: 'Prüfungsvorbereitung', en: 'exam readiness' },
    'Ich fühle mich gut auf die Prüfung vorbereitet.',
    'I feel well prepared for the exam.',
    { profiles: ['exam'] }
  ),

  // step 1 — progress
  {
    id: 'progress',
    type: 'choice',
    step: 1,
    required: true,
    short: { de: 'Fortschritt', en: 'progress' },
    de: 'Haben Sie das Gefühl, Fortschritte gemacht zu haben?',
    en: 'Do you feel you have made progress?',
    options: [
      { value: 'a_lot', de: 'Sehr grosse Fortschritte', en: 'A lot of progress' },
      { value: 'good', de: 'Gute Fortschritte', en: 'Good progress' },
      { value: 'some', de: 'Einige Fortschritte', en: 'Some progress' },
      { value: 'little', de: 'Sehr wenig Fortschritt', en: 'Very little progress' },
      { value: 'none', de: 'Noch keine Fortschritte', en: 'No progress yet' },
    ],
  },
  {
    id: 'progress_note',
    type: 'text',
    step: 1,
    showIf: { id: 'progress', values: ['some', 'little', 'none'] },
    short: { de: 'Zum Fortschritt', en: 'on progress' },
    de: 'Was hätte Ihnen geholfen, mehr Fortschritte zu machen?',
    en: 'What would have helped you make more progress?',
  },
  {
    id: 'activities',
    type: 'multi',
    step: 1,
    other: true,
    short: { de: 'Aktivitäten', en: 'activities' },
    de: 'Welche Aktivitäten haben Ihnen am meisten beim Lernen geholfen?',
    en: 'Which activities helped you learn the most?',
    hint: { de: 'Mehrfachauswahl möglich.', en: 'Select all that apply.' },
    options: [
      { value: 'speaking', de: 'Sprechübungen', en: 'Speaking practice', profiles: ['language'] },
      {
        value: 'grammar',
        de: 'Grammatikerklärungen',
        en: 'Grammar explanations',
        profiles: ['language'],
      },
      {
        value: 'vocabulary',
        de: 'Wortschatzübungen',
        en: 'Vocabulary exercises',
        profiles: ['language'],
      },
      { value: 'listening', de: 'Hörübungen', en: 'Listening exercises', profiles: ['language'] },
      { value: 'reading', de: 'Lesetexte', en: 'Reading texts', profiles: ['language'] },
      { value: 'writing', de: 'Schreibübungen', en: 'Writing exercises', profiles: ['language'] },
      { value: 'roleplay', de: 'Rollenspiele', en: 'Role plays', profiles: ['language'] },
      {
        value: 'theory',
        de: 'Erklärungen der Theorie',
        en: 'Having the theory explained',
        profiles: ['academic'],
      },
      {
        value: 'exercises',
        de: 'Aufgaben gemeinsam lösen',
        en: 'Working through exercises together',
        profiles: ['academic'],
      },
      {
        value: 'past_papers',
        de: 'Alte Prüfungen und Probeprüfungen',
        en: 'Past exams and mock tests',
        profiles: ['academic', 'exam'],
      },
      { value: 'games', de: 'Spiele', en: 'Games' },
      { value: 'homework', de: 'Hausaufgaben', en: 'Homework' },
      OTHER_OPTION,
    ],
  },

  // step 2 — in your words
  {
    id: 'positive',
    type: 'text',
    step: 2,
    short: { de: 'Positiv', en: 'went well' },
    de: 'Was hat Ihnen am Unterricht am besten gefallen?',
    en: 'What did you enjoy most about the lessons?',
  },
  {
    id: 'improve',
    type: 'text',
    step: 2,
    short: { de: 'Verbesserung', en: 'to improve' },
    de: 'Was können wir verbessern?',
    en: 'What could we improve?',
    hint: {
      de: 'Auch Schwieriges oder Frustrierendes gehört hierher. Über konstruktive Kritik freuen wir uns besonders.',
      en: 'Anything you found difficult or frustrating belongs here too. We especially appreciate constructive criticism.',
    },
  },

  // step 3 — what next
  {
    id: 'recommend',
    type: 'nps',
    step: 3,
    required: true,
    short: { de: 'Weiterempfehlung', en: 'recommendation' },
    de: 'Wie wahrscheinlich ist es, dass Sie unseren Unterricht weiterempfehlen?',
    en: 'How likely are you to recommend these lessons to a friend or colleague?',
    scale: {
      min: { de: 'überhaupt nicht', en: 'not at all likely' },
      max: { de: 'sehr wahrscheinlich', en: 'extremely likely' },
    },
  },
  {
    id: 'continue',
    type: 'choice',
    step: 3,
    short: { de: 'Weitermachen', en: 'continue' },
    de: 'Möchten Sie mit einem weiteren Kurs weitermachen?',
    en: 'Would you like to continue with another course?',
    options: [
      { value: 'yes', de: 'Ja', en: 'Yes' },
      { value: 'maybe', de: 'Vielleicht', en: 'Maybe' },
      { value: 'no', de: 'Nein', en: 'No' },
    ],
  },
  {
    id: 'next_topic',
    type: 'text',
    step: 3,
    showIf: { id: 'continue', values: ['yes', 'maybe'] },
    short: { de: 'Als Nächstes', en: 'next course' },
    de: 'Was möchten Sie als Nächstes lernen?',
    en: 'What would you like to learn next?',
  },
  {
    id: 'anything_else',
    type: 'text',
    step: 3,
    short: { de: 'Sonstiges', en: 'anything else' },
    de: 'Möchten Sie uns sonst noch etwas sagen?',
    en: 'Anything else you would like to tell us?',
  },
];

/* ── Mid-course form ────────────────────────────────────────────────── */
const MIDTERM_FIELDS = [
  // step 0 — so far
  {
    id: 'satisfaction',
    type: 'scale',
    step: 0,
    required: true,
    short: { de: 'Bisher', en: 'so far' },
    de: 'Wie zufrieden sind Sie bisher mit dem Unterricht?',
    en: 'How satisfied are you with the lessons so far?',
    scale: SATISFACTION_SCALE,
  },
  statement(
    'pace',
    0,
    { de: 'Tempo', en: 'pace' },
    'Das Tempo des Unterrichts ist meinem Niveau angemessen.',
    'The pace of the lessons is appropriate for my level.'
  ),

  // step 1 — materials and classroom
  {
    id: 'materials_liked',
    type: 'multi',
    step: 1,
    other: true,
    short: { de: 'Materialien', en: 'materials liked' },
    de: 'Welche Materialien gefallen Ihnen besonders?',
    en: 'Which materials do you like most?',
    hint: { de: 'Mehrfachauswahl möglich.', en: 'Select all that apply.' },
    options: [
      { value: 'textbook', de: 'Lehrbuch', en: 'Textbook' },
      { value: 'worksheets', de: 'Arbeitsblätter', en: 'Worksheets' },
      {
        value: 'audio_video',
        de: 'Audio und Video',
        en: 'Audio and video',
        profiles: ['language'],
      },
      {
        value: 'authentic',
        de: 'Authentische Texte, z. B. Zeitungen oder Alltagstexte',
        en: 'Authentic texts such as newspapers or everyday texts',
        profiles: ['language'],
      },
      {
        value: 'past_papers',
        de: 'Alte Prüfungen und Probeprüfungen',
        en: 'Past exams and mock tests',
        profiles: ['academic', 'exam'],
      },
      { value: 'online', de: 'Online-Übungen und Apps', en: 'Online exercises and apps' },
      { value: 'games', de: 'Spiele', en: 'Games' },
      OTHER_OPTION,
    ],
  },
  {
    id: 'materials_wish',
    type: 'text',
    step: 1,
    short: { de: 'Materialwunsch', en: 'materials wanted' },
    de: 'Gibt es Materialien, die Sie sich zusätzlich wünschen?',
    en: 'Are there materials you would like us to add?',
  },
  {
    id: 'class_style',
    type: 'multi',
    step: 1,
    other: true,
    short: { de: 'Arbeitsweise', en: 'class style' },
    de: 'Wie arbeiten Sie im Unterricht am liebsten?',
    en: 'How do you prefer to work in class?',
    hint: { de: 'Mehrfachauswahl möglich.', en: 'Select all that apply.' },
    options: [
      {
        value: 'conversation',
        de: 'Im Gespräch mit der Lehrperson',
        en: 'In conversation with the teacher',
      },
      { value: 'pairs', de: 'In Partnerarbeit', en: 'In pairs' },
      { value: 'groups', de: 'In Kleingruppen', en: 'In small groups' },
      {
        value: 'alone_then_discuss',
        de: 'Zuerst allein, dann gemeinsam besprechen',
        en: 'On my own first, then discussing together',
      },
      { value: 'board', de: 'Mit Erklärungen an der Tafel', en: 'With explanations at the board' },
      {
        value: 'games_roleplay',
        de: 'Mit Spielen und Rollenspielen',
        en: 'With games and role plays',
        profiles: ['language'],
      },
      {
        value: 'exercises',
        de: 'Mit vielen Übungsaufgaben',
        en: 'With plenty of practice exercises',
      },
      OTHER_OPTION,
    ],
  },

  // step 2 — studying at home
  {
    id: 'home_study',
    type: 'multi',
    step: 2,
    other: true,
    short: { de: 'Lernen zu Hause', en: 'home study' },
    de: 'Wie lernen Sie zu Hause am liebsten?',
    en: 'How do you like to study at home?',
    hint: { de: 'Mehrfachauswahl möglich.', en: 'Select all that apply.' },
    options: [
      {
        value: 'homework',
        de: 'Mit den Hausaufgaben aus dem Unterricht',
        en: 'With the homework from the lesson',
      },
      { value: 'apps', de: 'Mit Apps oder Online-Übungen', en: 'With apps or online exercises' },
      {
        value: 'media',
        de: 'Mit Filmen, Podcasts oder Musik',
        en: 'With films, podcasts or music',
        profiles: ['language'],
      },
      { value: 'reading', de: 'Mit Lesen', en: 'By reading', profiles: ['language'] },
      {
        value: 'talking',
        de: 'Im Gespräch mit anderen',
        en: 'By talking to others',
        profiles: ['language'],
      },
      { value: 'notes', de: 'Mit dem Wiederholen meiner Notizen', en: 'By going over my notes' },
      {
        value: 'extra_exercises',
        de: 'Mit zusätzlichen Übungsaufgaben',
        en: 'With extra practice exercises',
      },
      { value: 'rarely', de: 'Ich lerne kaum zu Hause', en: 'I hardly study at home' },
      OTHER_OPTION,
    ],
  },
  {
    id: 'home_time',
    type: 'choice',
    step: 2,
    short: { de: 'Zeit pro Woche', en: 'time per week' },
    de: 'Wie viel Zeit können Sie pro Woche für das selbstständige Lernen einplanen?',
    en: 'How much time can you dedicate to independent study per week?',
    options: [
      { value: 'under_1h', de: 'Unter 1 Stunde', en: 'Under 1 hour' },
      { value: '1_2h', de: '1–2 Stunden', en: '1–2 hours' },
      { value: '2_4h', de: '2–4 Stunden', en: '2–4 hours' },
      { value: 'over_4h', de: 'Mehr als 4 Stunden', en: 'More than 4 hours' },
    ],
  },

  // step 3 — schedule
  {
    id: 'frequency',
    type: 'choice',
    step: 3,
    required: true,
    short: { de: 'Häufigkeit', en: 'frequency' },
    de: 'Wie empfinden Sie die Häufigkeit der Lektionen?',
    en: 'How do you find the frequency of the lessons?',
    options: [
      { value: 'too_rare', de: 'Zu selten', en: 'Too infrequent' },
      { value: 'right', de: 'Genau richtig', en: 'Just right' },
      { value: 'too_often', de: 'Zu häufig', en: 'Too frequent' },
    ],
  },
  {
    id: 'frequency_note',
    type: 'text',
    step: 3,
    showIf: { id: 'frequency', values: ['too_rare', 'too_often'] },
    short: { de: 'Wunschfrequenz', en: 'preferred frequency' },
    de: 'Welche Häufigkeit und Lektionsdauer wären für Sie ideal?',
    en: 'What frequency and lesson length would suit you best?',
    hint: {
      de: 'Zum Beispiel: zweimal pro Woche, je 60 Minuten.',
      en: 'For example: twice a week, 60 minutes each.',
    },
  },
  {
    id: 'breaks',
    type: 'choice',
    step: 3,
    required: true,
    short: { de: 'Unterbrüche', en: 'breaks' },
    de: 'Stören Sie Unterbrüche im Kurs, z. B. durch Ferien oder ausgefallene Lektionen?',
    en: 'Do breaks in the course, for example holidays or cancelled lessons, bother you?',
    options: [
      { value: 'no', de: 'Nein, das ist in Ordnung', en: 'No, that is fine' },
      { value: 'a_little', de: 'Ein wenig', en: 'A little' },
      { value: 'yes', de: 'Ja, ich verliere dann den Anschluss', en: 'Yes, I lose momentum' },
    ],
  },
  {
    id: 'substitute',
    type: 'choice',
    step: 3,
    required: true,
    short: { de: 'Ersatz', en: 'substitute' },
    de: 'Wenn Ihre Lehrperson eine Lektion nicht halten kann: Was ist Ihnen lieber?',
    en: 'If your teacher is unable to teach a lesson, what would you prefer?',
    options: [
      { value: 'substitute', de: 'Eine Ersatzlehrperson', en: 'A substitute teacher' },
      {
        value: 'reschedule',
        de: 'Die Lektion auf einen späteren Termin verschieben',
        en: 'Rescheduling the lesson for a later date',
      },
      { value: 'other', de: 'Anderes', en: 'Other' },
    ],
  },
  {
    id: 'substitute_note',
    type: 'text',
    step: 3,
    showIf: { id: 'substitute', values: ['other'] },
    short: { de: 'Ersatz, Details', en: 'substitute, details' },
    de: 'Bitte präzisieren Sie.',
    en: 'Please specify',
  },
  {
    id: 'anything_else',
    type: 'text',
    step: 3,
    short: { de: 'Sonstiges', en: 'anything else' },
    de: 'Gibt es sonst etwas, das wir für die zweite Kurshälfte wissen sollten?',
    en: 'Is there anything else we should know for the second half of the course?',
  },
];

/** Both forms, keyed by kind. `minutes` is what the page quotes as duration. */
export const FEEDBACK_FORMS = {
  midterm: { fields: MIDTERM_FIELDS, minutes: { de: '3 Minuten', en: '3 minutes' } },
  final: { fields: FINAL_FIELDS, minutes: { de: '3–5 Minuten', en: '3–5 minutes' } },
};

/** The fields of one form; throws on an unknown kind so callers fail loudly. */
export function feedbackFields(kind) {
  const form = FEEDBACK_FORMS[kind];
  if (!form) throw new Error(`Unknown feedback kind: ${kind}`);
  return form.fields;
}

/** 1-10 rating questions — the ones that feed the averages. */
export function ratingFields(kind) {
  return feedbackFields(kind).filter((f) => f.type === 'scale');
}

/** The recommendation question, or null for a form without one. */
export function npsField(kind) {
  return feedbackFields(kind).find((f) => f.type === 'nps') || null;
}

/** Free-text questions. */
export function commentFields(kind) {
  return feedbackFields(kind).filter((f) => f.type === 'text');
}

/** Single- and multiple-choice questions. */
export function choiceFields(kind) {
  return feedbackFields(kind).filter((f) => f.type === 'choice' || f.type === 'multi');
}

/** The key an "other: ___" answer is stored under. */
export function otherKey(field) {
  return field.id + '_other';
}

function pick(value, lang) {
  if (!value) return null;
  return value[lang] ?? value.de ?? null;
}

/** Does this question or option belong to any of a course's profiles? */
function inProfiles(entry, profiles) {
  return !entry.profiles || entry.profiles.some((p) => profiles.includes(p));
}

/** The questions actually asked about a course, in form order. */
export function fieldsForCourse(kind, course) {
  const profiles = courseFeedbackProfiles(course);
  return feedbackFields(kind).filter((field) => inProfiles(field, profiles));
}

/** The options actually offered for a course, in question order. */
export function optionsForCourse(field, course) {
  const profiles = courseFeedbackProfiles(course);
  return (field.options || []).filter((option) => inProfiles(option, profiles));
}

/** Is a conditional question shown, given the answers so far? */
export function conditionMet(field, answers) {
  if (!field.showIf) return true;
  return field.showIf.values.includes(answers?.[field.showIf.id]);
}

/**
 * The question set as it is sent to the public form, in one language and
 * tailored to one course, grouped into the steps the form pages through.
 * Steps carry no titles. Passing no course gives the default (language)
 * question set.
 */
export function feedbackQuestionsForLanguage(kind, language, course = null) {
  const lang = language === 'en' ? 'en' : 'de';
  const profile = courseFeedbackProfile(course);
  const profiles = courseFeedbackProfiles(course);
  const subject = subjectWord(course, profile, lang);
  const label = (field) =>
    (field.byProfile?.[profile]?.[lang] ?? field[lang]).replace('{subject}', subject);

  const question = (field) => {
    const out = {
      id: field.id,
      type: field.type,
      label: label(field),
      required: Boolean(field.required),
    };
    if (field.hint) out.hint = pick(field.hint, lang);
    if (field.showIf) out.showIf = { id: field.showIf.id, values: [...field.showIf.values] };
    if (field.type === 'scale' || field.type === 'nps') {
      const scale = field.scale || RATING_SCALE_LABELS;
      out.min = field.type === 'nps' ? NPS_MIN : RATING_MIN;
      out.max = field.type === 'nps' ? NPS_MAX : RATING_MAX;
      out.minLabel = (scale.min || RATING_SCALE_LABELS.min)[lang];
      out.maxLabel = (scale.max || RATING_SCALE_LABELS.max)[lang];
    }
    if (field.options) {
      out.options = optionsForCourse(field, course).map((o) => ({
        value: o.value,
        label: o[lang],
      }));
    }
    if (field.other) out.other = true;
    if (field.type === 'text') out.maxLength = COMMENT_MAX_LENGTH;
    return out;
  };

  const asked = fieldsForCourse(kind, course);
  const stepCount = Math.max(...asked.map((f) => f.step)) + 1;
  const steps = [];
  for (let i = 0; i < stepCount; i += 1) {
    const questions = asked.filter((f) => f.step === i).map(question);
    if (questions.length) steps.push({ questions });
  }

  return {
    kind,
    profiles,
    steps,
    minutes: FEEDBACK_FORMS[kind].minutes[lang],
    otherMaxLength: OTHER_MAX_LENGTH,
  };
}

/** The label of one option value, for the admin and the notification email. */
export function optionLabel(field, value, language = 'en') {
  const lang = language === 'de' ? 'de' : 'en';
  const option = (field.options || []).find((o) => o.value === value);
  return option ? option[lang] : value;
}

function validateText(field, raw) {
  if (raw === undefined || raw === null || raw === '') return { value: null };
  if (typeof raw !== 'string') return { error: `${field.id} must be a string` };
  const text = raw.trim();
  if (text.length > COMMENT_MAX_LENGTH) {
    return { error: `${field.id} must be at most ${COMMENT_MAX_LENGTH} characters` };
  }
  return { value: text || null };
}

function validateOther(field, raw) {
  if (raw === undefined || raw === null || raw === '') return { value: null };
  if (typeof raw !== 'string') return { error: `${field.id}_other must be a string` };
  const text = raw.trim();
  if (text.length > OTHER_MAX_LENGTH) {
    return { error: `${field.id}_other must be at most ${OTHER_MAX_LENGTH} characters` };
  }
  return { value: text || null };
}

function validateNumeric(field, raw, min, max, label) {
  if (raw === undefined || raw === null || raw === '') {
    if (field.required) return { error: `Please answer: ${label}` };
    return { value: null };
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    return { error: `${field.id} must be a whole number between ${min} and ${max}` };
  }
  return { value };
}

/**
 * Validate a submitted form body of the shape
 *   { answers: { satisfaction: 5, activities: ['speaking'], positive: '...' },
 *     other:   { activities: 'karaoke' } }
 * against one form. Only the questions marked `required` must be answered,
 * and only the questions this course's profiles actually ask (and whose
 * showIf condition is met) are considered — anything outside them is stored
 * as null whatever the client posted. Returns { error } or { answers } keyed
 * by question id, one entry per asked question, ready to store as JSON.
 */
export function validateFeedbackSubmission(kind, body, course = null) {
  if (!isFeedbackKind(kind)) return { error: 'Unknown feedback kind' };
  if (!body || typeof body !== 'object') return { error: 'Request body must be a JSON object' };

  const isPlainObject = (v) => v && typeof v === 'object' && !Array.isArray(v);
  for (const key of ['answers', 'other']) {
    if (body[key] !== undefined && !isPlainObject(body[key])) {
      return { error: `${key} must be an object` };
    }
  }
  const posted = body.answers || {};
  const others = body.other || {};

  const profile = courseFeedbackProfile(course);
  const profiles = courseFeedbackProfiles(course);
  const subject = subjectWord(course, profile, 'en');
  const ask = (field) => (field.byProfile?.[profile]?.en ?? field.en).replace('{subject}', subject);

  const answers = {};

  for (const field of feedbackFields(kind)) {
    // A question this course never asked, or one hidden by an earlier
    // answer, cannot carry an answer, even if the client posted one.
    // Conditions are checked against already-validated answers, so the
    // controlling question has to come earlier in the registry.
    if (!inProfiles(field, profiles) || !conditionMet(field, answers)) {
      answers[field.id] = null;
      if (field.other) answers[otherKey(field)] = null;
      continue;
    }

    const raw = posted[field.id];

    if (field.type === 'scale' || field.type === 'nps') {
      const isNps = field.type === 'nps';
      const { error, value } = validateNumeric(
        field,
        raw,
        isNps ? NPS_MIN : RATING_MIN,
        isNps ? NPS_MAX : RATING_MAX,
        ask(field)
      );
      if (error) return { error };
      answers[field.id] = value;
      continue;
    }

    if (field.type === 'text') {
      const { error, value } = validateText(field, raw);
      if (error) return { error };
      if (field.required && value === null) return { error: `Please answer: ${ask(field)}` };
      answers[field.id] = value;
      continue;
    }

    const allowed = optionsForCourse(field, course).map((o) => o.value);

    if (field.type === 'choice') {
      if (raw === undefined || raw === null || raw === '') {
        if (field.required) return { error: `Please answer: ${ask(field)}` };
        answers[field.id] = null;
      } else if (typeof raw !== 'string' || !allowed.includes(raw)) {
        return { error: `${field.id} is not a valid choice` };
      } else {
        answers[field.id] = raw;
      }
    } else {
      // multi
      if (raw === undefined || raw === null) {
        if (field.required) return { error: `Please answer: ${ask(field)}` };
        answers[field.id] = null;
      } else if (!Array.isArray(raw)) {
        return { error: `${field.id} must be an array` };
      } else {
        const chosen = [...new Set(raw)];
        for (const entry of chosen) {
          if (typeof entry !== 'string' || !allowed.includes(entry)) {
            return { error: `${field.id} is not a valid choice` };
          }
        }
        if (field.required && !chosen.length) return { error: `Please answer: ${ask(field)}` };
        // Keep the stored order the same as the question, not the click order.
        answers[field.id] = chosen.length ? allowed.filter((v) => chosen.includes(v)) : null;
      }
    }

    if (field.other) {
      const { error, value } = validateOther(field, others[field.id]);
      if (error) return { error };
      // "Other: ___" only means anything when "other" was actually picked.
      const stored = answers[field.id];
      const pickedOther = Array.isArray(stored) ? stored.includes('other') : stored === 'other';
      answers[otherKey(field)] = pickedOther ? value : null;
    }
  }

  return { answers };
}

/**
 * Turn the averages object from summariseFeedback into a display-ready
 * list, so the admin never has to keep its own copy of the labels.
 */
export function labelledAverages(kind, averages, language = 'en') {
  const lang = language === 'de' ? 'de' : 'en';
  return ratingFields(kind).map((q) => ({
    id: q.id,
    label: q.short[lang],
    value: averages?.[q.id] ?? null,
  }));
}

function roundToOneDecimal(value) {
  return Math.round(value * 10) / 10;
}

/** Scores of one question across the response rows, ignoring blanks. */
function scoresFor(rows, id) {
  return (
    rows
      .map((row) => row?.answers?.[id])
      // Number(null) is 0, so drop empty answers before coercing.
      .filter((value) => value !== null && value !== undefined)
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value))
  );
}

/**
 * Net promoter score over the 1-10 recommendation answers, with the usual
 * cut-offs: share of 9-10 minus share of 6 and below, as a whole number
 * from -100 to 100.
 */
function summariseNps(rows, field) {
  const scores = scoresFor(rows, field.id);
  if (!scores.length) return { responses: 0, average: null, score: null };
  const promoters = scores.filter((s) => s >= 9).length;
  const detractors = scores.filter((s) => s <= 6).length;
  return {
    responses: scores.length,
    average: roundToOneDecimal(scores.reduce((a, b) => a + b, 0) / scores.length),
    score: Math.round(((promoters - detractors) / scores.length) * 100),
  };
}

/**
 * Aggregate one form's request rows and anonymous response rows.
 * Returns { requested, submitted, averages: { <questionId>: number|null },
 * nps } — `nps` is null for a form without a recommendation question.
 * Averages are rounded to one decimal.
 *
 * `submitted` counts response rows, never request rows, so the summary
 * reveals nothing about which request was answered.
 *
 * There is deliberately no single headline average: which questions a
 * student was asked depends on their course, so a mean across all of them
 * would compare courses that answered different questions.
 */
export function summariseFeedback(kind, requestRows, responseRows) {
  const requests = Array.isArray(requestRows) ? requestRows : [];
  const responses = (Array.isArray(responseRows) ? responseRows : []).filter(Boolean);

  const averages = {};
  for (const question of ratingFields(kind)) {
    const scores = scoresFor(responses, question.id);
    averages[question.id] = scores.length
      ? roundToOneDecimal(scores.reduce((a, b) => a + b, 0) / scores.length)
      : null;
  }

  const nps = npsField(kind);
  return {
    requested: requests.length,
    submitted: responses.length,
    averages,
    nps: nps ? summariseNps(responses, nps) : null,
  };
}

/**
 * Both forms summarised at once, with display-ready averages:
 *   { midterm: { requested, submitted, averages: [...], nps },
 *     final:   { ... } }
 * Request rows from before the two-form split carry no kind and count as
 * end-of-course requests.
 */
export function summariseByKind(requestRows, responseRows, language = 'en') {
  const requests = Array.isArray(requestRows) ? requestRows : [];
  const responses = Array.isArray(responseRows) ? responseRows : [];
  const summary = {};
  for (const kind of FEEDBACK_KINDS) {
    const s = summariseFeedback(
      kind,
      requests.filter((r) => (isFeedbackKind(r?.kind) ? r.kind : DEFAULT_KIND) === kind),
      responses.filter((r) => r?.kind === kind)
    );
    summary[kind] = { ...s, averages: labelledAverages(kind, s.averages, language) };
  }
  return summary;
}

/**
 * The question labels the admin needs to render stored answers, in one
 * language: ratings (with their max), choices (with option labels, so a
 * stored 'a_lot' reads as the text the student saw) and comments.
 */
export function feedbackQuestionLabels(kind, language = 'en') {
  const lang = language === 'de' ? 'de' : 'en';
  const nps = npsField(kind);
  return {
    ratings: [...ratingFields(kind), ...(nps ? [nps] : [])].map((q) => ({
      id: q.id,
      label: q.short[lang],
      max: q.type === 'nps' ? NPS_MAX : RATING_MAX,
    })),
    choices: choiceFields(kind).map((q) => ({
      id: q.id,
      otherKey: q.other ? otherKey(q) : null,
      label: q.short[lang],
      options: q.options.map((o) => ({ value: o.value, label: o[lang] })),
    })),
    comments: commentFields(kind).map((q) => ({ id: q.id, label: q.short[lang] })),
  };
}
