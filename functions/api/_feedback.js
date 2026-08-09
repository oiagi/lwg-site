// functions/api/_feedback.js
// Single source of truth for the course feedback questions plus the pure
// helpers that validate a submission and summarise a set of responses.
// Shared by feedback.js (public form API), send-feedback-request.js and
// get-courses.js, so the form, the email preview and the stored columns
// can never drift apart. Keep this file free of I/O — it is unit tested
// directly (tests/feedback.test.mjs).
//
// Adding a question: add one entry to FEEDBACK_FIELDS with its `column`,
// add that column in supabase/migrations/add_course_feedback.sql, and both
// the public form and the admin views pick it up automatically.

/** Feedback links stay valid for 90 days, same as the intake links. */
export const TOKEN_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

/** Maximum length of each free-text answer. */
export const COMMENT_MAX_LENGTH = 2000;

/** Maximum length of an "other: ___" answer next to a choice. */
export const OTHER_MAX_LENGTH = 120;

/** Statement ratings run 1-5; the recommendation question is a 0-10 NPS. */
export const RATING_MIN = 1;
export const RATING_MAX = 5;
export const NPS_MIN = 0;
export const NPS_MAX = 10;

/** Default endpoint labels for the ends of a 1-5 scale. */
export const RATING_SCALE_LABELS = {
  min: { de: 'schlecht', en: 'poor' },
  max: { de: 'ausgezeichnet', en: 'excellent' },
};

/** Form sections, in the order the public form renders them. */
export const FEEDBACK_SECTIONS = [
  { id: 'ratings', de: 'Wie war es?', en: 'how did it go?' },
  { id: 'words', de: 'In deinen Worten', en: 'in your words' },
  { id: 'progress', de: 'Dein Fortschritt', en: 'your progress' },
  { id: 'next', de: 'Und weiter?', en: 'what next' },
];

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

/** Shorthand for the statements of question 3, which share a scale. */
function statement(id, column, short, de, en, extra) {
  return { id, column, type: 'scale', section: 'ratings', required: true, short, de, en, ...extra };
}

/**
 * Every question, in form order.
 *
 *   type      'scale' (1-5) | 'nps' (0-10) | 'choice' | 'multi' | 'text'
 *   column    the course_feedback column it is stored in
 *   short     label used in the admin views and summaries
 *   de / en   the question as the student reads it
 *   hint      optional helper line under the question
 *   options   for choice/multi: { value, de, en }
 *   other     for choice/multi: column holding the free-text "other" answer
 *   required  blocks submission when unanswered
 *   profiles  course profiles this question (or option) applies to
 *   byProfile per-profile overrides of the de/en wording
 *
 * A question is never asked about which course this is — the form header
 * already says so — so there is no course_type field here.
 */
export const FEEDBACK_FIELDS = [
  {
    id: 'satisfaction',
    column: 'rating_satisfaction',
    type: 'scale',
    section: 'ratings',
    required: true,
    short: { de: 'Gesamt', en: 'overall' },
    de: 'Wie zufrieden bist du insgesamt mit dem Unterricht?',
    en: 'Overall, how satisfied are you with the lessons?',
    scale: {
      min: { de: 'sehr unzufrieden', en: 'very dissatisfied' },
      max: { de: 'sehr zufrieden', en: 'very satisfied' },
    },
  },
  statement(
    'organisation',
    'rating_organisation',
    { de: 'Organisation', en: 'organisation' },
    'Der Unterricht war gut organisiert.',
    'The lessons were well organised.'
  ),
  statement(
    'teaching',
    'rating_teaching',
    { de: 'Erklärungen', en: 'explanations' },
    'Die Lehrperson hat die Inhalte klar erklärt.',
    'The teacher explained concepts clearly.'
  ),
  statement(
    'comfort',
    'rating_comfort',
    { de: 'Fragen stellen', en: 'asking questions' },
    'Ich habe mich wohl gefühlt, Fragen zu stellen.',
    'I felt comfortable asking questions.'
  ),
  statement(
    'pace',
    'rating_pace',
    { de: 'Tempo', en: 'pace' },
    'Das Tempo hat zu meinem Niveau gepasst.',
    'The lesson pace suited my level.'
  ),
  statement(
    'materials',
    'rating_materials',
    { de: 'Materialien', en: 'materials' },
    'Die Materialien waren nützlich.',
    'The materials were useful.'
  ),
  statement(
    'speaking',
    'rating_speaking',
    { de: 'Sprechzeit', en: 'speaking time' },
    'Ich hatte genug Gelegenheit zu sprechen.',
    'I had enough opportunities to speak.',
    { profiles: ['language'] }
  ),
  statement(
    'vocabulary',
    'rating_vocabulary',
    { de: 'Wortschatz', en: 'vocabulary' },
    'Ich habe Wortschatz gelernt, den ich im Alltag brauchen kann.',
    'I learned vocabulary that I can use in everyday life.',
    { profiles: ['language'] }
  ),
  statement(
    'independence',
    'rating_independence',
    { de: 'Selbstständigkeit', en: 'working independently' },
    'Ich kann Aufgaben jetzt selbstständiger lösen.',
    'I can now work through exercises on my own.',
    { profiles: ['academic'] }
  ),
  statement(
    'confidence',
    'rating_confidence',
    { de: 'Selbstvertrauen', en: 'confidence' },
    'Ich spreche {subject} jetzt selbstsicherer.',
    'I feel more confident speaking {subject}.',
    {
      byProfile: {
        academic: {
          de: 'Ich fühle mich in {subject} jetzt sicherer.',
          en: 'I feel more confident in {subject}.',
        },
      },
    }
  ),
  statement(
    'exam_ready',
    'rating_exam_ready',
    { de: 'Prüfungsvorbereitung', en: 'exam readiness' },
    'Ich fühle mich gut auf die Prüfung vorbereitet.',
    'I feel well prepared for the exam.',
    { profiles: ['exam'] }
  ),
  {
    id: 'positive',
    column: 'comment_positive',
    type: 'text',
    section: 'words',
    short: { de: 'Positiv', en: 'went well' },
    de: 'Was hat dir am Unterricht am besten gefallen?',
    en: 'What did you enjoy most about the lessons?',
  },
  {
    id: 'improve',
    column: 'comment_improve',
    type: 'text',
    section: 'words',
    short: { de: 'Verbesserung', en: 'to improve' },
    de: 'Was könnten wir besser machen?',
    en: 'What could be improved?',
    hint: {
      de: 'Über konstruktive Kritik freuen wir uns besonders.',
      en: 'We especially appreciate constructive criticism.',
    },
  },
  {
    id: 'difficult',
    column: 'comment_difficult',
    type: 'text',
    section: 'words',
    short: { de: 'Schwierig', en: 'difficult' },
    de: 'Gab es etwas, das du schwierig oder frustrierend fandest?',
    en: 'Was there anything you found difficult or frustrating?',
  },
  {
    id: 'progress',
    column: 'progress_level',
    type: 'choice',
    section: 'progress',
    short: { de: 'Fortschritt', en: 'progress' },
    de: 'Hast du das Gefühl, Fortschritte gemacht zu haben?',
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
    column: 'comment_progress',
    type: 'text',
    section: 'progress',
    short: { de: 'Zum Fortschritt', en: 'on progress' },
    de: 'Magst du das kurz erklären?',
    en: 'Please explain if you wish.',
  },
  {
    id: 'activities',
    column: 'activities_helpful',
    type: 'multi',
    section: 'progress',
    other: 'activities_other',
    short: { de: 'Aktivitäten', en: 'activities' },
    de: 'Welche Aktivitäten haben dir am meisten beim Lernen geholfen?',
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
      { value: 'other', de: 'Anderes', en: 'Other' },
    ],
  },
  {
    id: 'recommend',
    column: 'nps_recommend',
    type: 'nps',
    section: 'next',
    required: true,
    short: { de: 'Weiterempfehlung', en: 'recommendation' },
    de: 'Wie wahrscheinlich ist es, dass du unseren Unterricht weiterempfiehlst?',
    en: 'How likely are you to recommend these lessons to a friend or colleague?',
    scale: {
      min: { de: 'überhaupt nicht', en: 'not at all likely' },
      max: { de: 'sehr wahrscheinlich', en: 'extremely likely' },
    },
  },
  {
    id: 'one_change',
    column: 'comment_one_change',
    type: 'text',
    section: 'next',
    short: { de: 'Eine Sache', en: 'one change' },
    de: 'Wenn du eine Sache am Kurs ändern könntest – welche wäre das?',
    en: 'If you could change one thing about the course, what would it be?',
  },
  {
    id: 'continue',
    column: 'continue_interest',
    type: 'choice',
    section: 'next',
    short: { de: 'Weitermachen', en: 'continue' },
    de: 'Möchtest du mit einem weiteren Kurs weitermachen?',
    en: 'Would you like to continue with another course?',
    options: [
      { value: 'yes', de: 'Ja', en: 'Yes' },
      { value: 'maybe', de: 'Vielleicht', en: 'Maybe' },
      { value: 'no', de: 'Nein', en: 'No' },
    ],
  },
  {
    id: 'next_topic',
    column: 'comment_next',
    type: 'text',
    section: 'next',
    short: { de: 'Als Nächstes', en: 'next course' },
    de: 'Wenn ja: Was möchtest du als Nächstes lernen?',
    en: 'If yes, what would you like to learn next?',
  },
  {
    id: 'anything_else',
    column: 'comment_other',
    type: 'text',
    section: 'next',
    short: { de: 'Sonstiges', en: 'anything else' },
    de: 'Möchtest du uns sonst noch etwas sagen?',
    en: "Anything else you'd like to tell us?",
  },
];

/** 1-5 rating questions — the ones that feed the averages. */
export const FEEDBACK_QUESTIONS = FEEDBACK_FIELDS.filter((f) => f.type === 'scale');

/** The 0-10 recommendation question. */
export const FEEDBACK_NPS = FEEDBACK_FIELDS.find((f) => f.type === 'nps');

/** Free-text questions. */
export const FEEDBACK_COMMENTS = FEEDBACK_FIELDS.filter((f) => f.type === 'text');

/** Single- and multiple-choice questions. */
export const FEEDBACK_CHOICES = FEEDBACK_FIELDS.filter(
  (f) => f.type === 'choice' || f.type === 'multi'
);

/** Columns to select when reading feedback rows, including "other" columns. */
export const FEEDBACK_COLUMNS = FEEDBACK_FIELDS.flatMap((f) =>
  f.other ? [f.column, f.other] : [f.column]
);

/** Columns needed to compute a summary — cheaper than selecting every answer. */
export const FEEDBACK_SUMMARY_COLUMNS = [
  ...FEEDBACK_QUESTIONS.map((q) => q.column),
  FEEDBACK_NPS.column,
];

function pick(value, lang) {
  if (!value) return null;
  return value[lang] ?? value.de ?? null;
}

/** Does this question or option belong to any of a course's profiles? */
function inProfiles(entry, profiles) {
  return !entry.profiles || entry.profiles.some((p) => profiles.includes(p));
}

/** The questions actually asked about a course, in form order. */
export function fieldsForCourse(course) {
  const profiles = courseFeedbackProfiles(course);
  return FEEDBACK_FIELDS.filter((field) => inProfiles(field, profiles));
}

/** The options actually offered for a course, in question order. */
export function optionsForCourse(field, course) {
  const profiles = courseFeedbackProfiles(course);
  return (field.options || []).filter((option) => inProfiles(option, profiles));
}

/**
 * The question set as it is sent to the public form, in one language and
 * tailored to one course, grouped into the sections the form renders.
 * Passing no course gives the default (language) question set.
 */
export function feedbackQuestionsForLanguage(language, course = null) {
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

  const asked = fieldsForCourse(course);
  const sections = FEEDBACK_SECTIONS.map((section) => ({
    id: section.id,
    title: section[lang],
    questions: asked.filter((f) => f.section === section.id).map(question),
  })).filter((section) => section.questions.length);

  return {
    profiles,
    sections,
    // Kept for callers that only need the flat 1-5 set (e.g. the email preview).
    ratings: asked.filter((f) => f.type === 'scale').map((q) => ({ id: q.id, label: label(q) })),
    comments: asked.filter((f) => f.type === 'text').map((q) => ({ id: q.id, label: label(q) })),
    scale: { min: RATING_SCALE_LABELS.min[lang], max: RATING_SCALE_LABELS.max[lang] },
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
 * Only the questions marked `required` must be answered, and only the
 * questions this course's profiles actually ask are considered — anything
 * outside them is stored as null whatever the client posted. Returns
 * { error } or { values } keyed by DB column, one entry per column so a
 * PATCH never leaves a stale answer behind.
 */
export function validateFeedbackSubmission(body, course = null) {
  if (!body || typeof body !== 'object') return { error: 'Request body must be a JSON object' };

  const isPlainObject = (v) => v && typeof v === 'object' && !Array.isArray(v);

  // `ratings` / `comments` are the shape the first version of the form
  // posted; both fold into the flat `answers` map.
  for (const key of ['answers', 'ratings', 'comments', 'other']) {
    if (body[key] !== undefined && !isPlainObject(body[key])) {
      return { error: `${key} must be an object` };
    }
  }
  const answers = { ...(body.ratings || {}), ...(body.comments || {}), ...(body.answers || {}) };
  const others = body.other || {};

  const profile = courseFeedbackProfile(course);
  const profiles = courseFeedbackProfiles(course);
  const subject = subjectWord(course, profile, 'en');
  const ask = (field) => (field.byProfile?.[profile]?.en ?? field.en).replace('{subject}', subject);

  const values = {};

  for (const field of FEEDBACK_FIELDS) {
    // A question this course never asked cannot carry an answer, even if
    // the client posted one.
    if (!inProfiles(field, profiles)) {
      values[field.column] = null;
      if (field.other) values[field.other] = null;
      continue;
    }

    const raw = answers[field.id];

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
      values[field.column] = value;
      continue;
    }

    if (field.type === 'text') {
      const { error, value } = validateText(field, raw);
      if (error) return { error };
      if (field.required && value === null) return { error: `Please answer: ${ask(field)}` };
      values[field.column] = value;
      continue;
    }

    const allowed = optionsForCourse(field, course).map((o) => o.value);

    if (field.type === 'choice') {
      if (raw === undefined || raw === null || raw === '') {
        if (field.required) return { error: `Please answer: ${ask(field)}` };
        values[field.column] = null;
      } else if (typeof raw !== 'string' || !allowed.includes(raw)) {
        return { error: `${field.id} is not a valid choice` };
      } else {
        values[field.column] = raw;
      }
    } else {
      // multi
      if (raw === undefined || raw === null) {
        if (field.required) return { error: `Please answer: ${ask(field)}` };
        values[field.column] = null;
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
        values[field.column] = chosen.length ? allowed.filter((v) => chosen.includes(v)) : null;
      }
    }

    if (field.other) {
      const { error, value } = validateOther(field, others[field.id]);
      if (error) return { error };
      // "Other: ___" only means anything when "other" was actually picked.
      const stored = values[field.column];
      const pickedOther = Array.isArray(stored) ? stored.includes('other') : stored === 'other';
      values[field.other] = pickedOther ? value : null;
    }
  }

  return { values };
}

/**
 * Turn the averages object from summariseFeedback into a display-ready
 * list, so the admin never has to keep its own copy of the labels.
 */
export function labelledAverages(averages, language = 'en') {
  const lang = language === 'de' ? 'de' : 'en';
  return FEEDBACK_QUESTIONS.map((q) => ({
    id: q.id,
    label: q.short[lang],
    value: averages?.[q.id] ?? null,
  }));
}

function roundToOneDecimal(value) {
  return Math.round(value * 10) / 10;
}

/** Scores of one column across the submitted rows, ignoring blanks. */
function scoresFor(rows, column) {
  return (
    rows
      // Number(null) is 0, so drop empty answers before coercing.
      .filter((row) => row[column] !== null && row[column] !== undefined)
      .map((row) => Number(row[column]))
      .filter((value) => Number.isFinite(value))
  );
}

/**
 * Net promoter score over the 0-10 recommendation answers:
 * share of 9-10 minus share of 0-6, as a whole number from -100 to 100.
 */
function summariseNps(rows) {
  const scores = scoresFor(rows, FEEDBACK_NPS.column);
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
 * Aggregate a set of course_feedback rows.
 * Returns { requested, submitted, averages: { <questionId>: number|null },
 * nps }. Averages are taken over submitted rows only and rounded to one
 * decimal; the 0-10 recommendation stays out of the /5 averages.
 *
 * There is deliberately no single headline average: which questions a
 * student was asked depends on their course, so a mean across all of them
 * would compare courses that answered different questions. The NPS is the
 * one number every response contributes to.
 */
export function summariseFeedback(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const submittedRows = list.filter((row) => row && row.submitted_at);

  const averages = {};
  for (const question of FEEDBACK_QUESTIONS) {
    const scores = scoresFor(submittedRows, question.column);
    averages[question.id] = scores.length
      ? roundToOneDecimal(scores.reduce((a, b) => a + b, 0) / scores.length)
      : null;
  }

  return {
    requested: list.length,
    submitted: submittedRows.length,
    averages,
    nps: summariseNps(submittedRows),
  };
}
