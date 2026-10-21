// Run with: node --test tests/
// Covers the pre-course questionnaire in functions/api/_questionnaire.js
// and its email in functions/api/_questionnaire-email.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  QUESTIONNAIRE_FIELDS,
  answerText,
  labelledAnswers,
  planningAnswers,
  questionnaireForLanguage,
  syncStudentFields,
  validateQuestionnaire,
} from '../functions/api/_questionnaire.js';
import {
  buildQuestionnaireEmail,
  questionnaireEmailCopy,
} from '../functions/api/_questionnaire-email.js';

const german = {
  course_code: 'LWG-1',
  course_type: 'language course',
  subject: 'German',
  level: 'B1',
};
const english = {
  course_code: 'LWG-2',
  course_type: 'language course',
  subject: 'English',
  level: 'B2',
};
const maths = { course_code: 'LWG-3', course_type: 'tutoring', subject: 'Mathematics' };

const ids = (set) => set.steps.flatMap((s) => s.questions.map((q) => q.id));
const question = (set, id) => set.steps.flatMap((s) => s.questions).find((q) => q.id === id);

const INFORMAL_DE = /\b(du|dich|dir|dein|deine|deinen|deinem|deiner|hast|bist|magst)\b/i;

/** A complete, valid set of answers for a German course. */
function germanAnswers(overrides = {}) {
  return {
    prior_experience: '1_3y',
    self_level: 'B1',
    goals: 'Talk to my neighbours',
    focus_skills: ['speaking', 'grammar'],
    instruction_language: 'target_only',
    correction_style: 'after_activity',
    coursebook: 'coursebook_plus',
    documents_format: 'printed',
    contact_channel: 'whatsapp',
    homework_time: '30_60m',
    homework_delivery: 'email',
    absences: '  3 and 10 March  ',
    ...overrides,
  };
}

test('question ids are unique', () => {
  const all = QUESTIONNAIRE_FIELDS.map((f) => f.id);
  assert.equal(new Set(all).size, all.length);
});

test('every question and option has German and English wording, formal German only', () => {
  for (const field of QUESTIONNAIRE_FIELDS) {
    assert.ok(field.de && field.en && field.short?.de && field.short?.en, field.id);
    assert.doesNotMatch(field.de, INFORMAL_DE, field.id);
    for (const option of field.options || []) {
      assert.ok(option.de && option.en, `${field.id}.${option.value}`);
      assert.doesNotMatch(option.de, INFORMAL_DE, `${field.id}.${option.value}`);
    }
    if (field.hint) assert.doesNotMatch(field.hint.de, INFORMAL_DE, field.id);
  }
});

test('German spelling is Swiss: no ß anywhere', () => {
  for (const field of QUESTIONNAIRE_FIELDS) {
    const strings = [
      field.de,
      field.short.de,
      field.hint?.de,
      ...(field.options || []).map((o) => o.de),
    ];
    for (const s of strings.filter(Boolean)) assert.ok(!s.includes('ß'), `${field.id}: ${s}`);
  }
});

test('a German course gets the language questions, Swiss German and the German exams', () => {
  const set = questionnaireForLanguage('en', german);
  const asked = ids(set);
  for (const id of [
    'self_level',
    'instruction_language',
    'focus_skills',
    'swiss_german',
    'documents_format',
    'absences',
  ]) {
    assert.ok(asked.includes(id), id);
  }
  const exams = question(set, 'exam').options.map((o) => o.value);
  assert.deepEqual(exams, ['no', 'goethe', 'telc', 'osd', 'fide', 'other']);
});

test('an English course skips Swiss German and the German exams, and explains in German', () => {
  const set = questionnaireForLanguage('en', english);
  assert.ok(!ids(set).includes('swiss_german'));
  assert.deepEqual(
    question(set, 'exam').options.map((o) => o.value),
    ['no', 'other']
  );
  const option = question(set, 'instruction_language').options[0].label;
  assert.equal(option, 'Only English. German only to translate a specific word or phrase.');
});

test('the teaching-language options name the course language and English', () => {
  const de = question(questionnaireForLanguage('de', german), 'instruction_language');
  assert.equal(
    de.options[0].label,
    'Nur Deutsch. Englisch nur, um ein bestimmtes Wort oder eine Wendung zu übersetzen.'
  );
  const en = question(questionnaireForLanguage('en', german), 'instruction_language');
  assert.equal(
    en.options[1].label,
    'As much German as possible, but explanations in English when needed.'
  );
});

test('a maths course only gets the general questions', () => {
  const asked = ids(questionnaireForLanguage('de', maths));
  assert.deepEqual(asked, [
    'past_difficulties',
    'goals',
    'correction_style',
    'coursebook',
    'documents_format',
    'contact_channel',
    'homework_time',
    'homework_delivery',
    'learning_needs',
    'absences',
    'anything_else',
  ]);
});

test('the absences question carries the no-postponement disclaimer in both languages', () => {
  const en = question(questionnaireForLanguage('en', german), 'absences');
  const de = question(questionnaireForLanguage('de', german), 'absences');
  assert.match(en.hint, /cannot be postponed/);
  assert.match(de.hint, /nicht verschoben/);
});

test('the form runs over four steps with the planning questions last', () => {
  const set = questionnaireForLanguage('en', german);
  assert.equal(set.steps.length, 4);
  assert.deepEqual(
    set.steps[3].questions.map((q) => q.id),
    ['absences', 'anything_else']
  );
  assert.equal(set.minutes, '5 minutes');
});

test('a complete submission validates and trims text', () => {
  const { error, answers } = validateQuestionnaire({ answers: germanAnswers() }, german);
  assert.equal(error, undefined);
  assert.equal(answers.absences, '3 and 10 March');
  assert.equal(answers.documents_format, 'printed');
  assert.equal(answers.swiss_german, null);
});

test('required questions block submission', () => {
  for (const id of [
    'goals',
    'documents_format',
    'contact_channel',
    'homework_time',
    'homework_delivery',
    'instruction_language',
  ]) {
    const { error } = validateQuestionnaire(
      { answers: germanAnswers({ [id]: undefined }) },
      german
    );
    assert.match(error, /^Please answer/, id);
  }
});

test('language questions are neither required nor stored for a maths course', () => {
  const { error, answers } = validateQuestionnaire(
    {
      answers: {
        goals: 'Pass the Gymi exam',
        correction_style: 'immediately',
        coursebook: 'no_preference',
        documents_format: 'electronic',
        contact_channel: 'admin_only',
        homework_time: '1_2h',
        homework_delivery: 'end_of_lesson',
        self_level: 'B2',
      },
    },
    maths
  );
  assert.equal(error, undefined);
  assert.equal(answers.self_level, null);
});

test('an option the course does not offer is rejected', () => {
  const { error } = validateQuestionnaire({ answers: germanAnswers({ exam: 'goethe' }) }, english);
  assert.match(error, /exam is not a valid choice/);
});

test('prior_where is only kept when the student has learned before', () => {
  const never = validateQuestionnaire(
    { answers: germanAnswers({ prior_experience: 'never', prior_where: 'school' }) },
    german
  );
  assert.equal(never.answers.prior_where, null);
  const some = validateQuestionnaire({ answers: germanAnswers({ prior_where: 'school' }) }, german);
  assert.equal(some.answers.prior_where, 'school');
});

test('planningAnswers picks out documents and absences, blank absences as null', () => {
  assert.deepEqual(
    planningAnswers({
      documents_format: 'both',
      absences: ' 1 May ',
      contact_channel: 'email',
      homework_delivery: 'whatsapp',
      goals: 'not a planning answer',
    }),
    {
      documents_format: 'both',
      absences: '1 May',
      contact_channel: 'email',
      homework_delivery: 'whatsapp',
    }
  );
  assert.deepEqual(planningAnswers({ documents_format: 'printed', absences: '   ' }), {
    documents_format: 'printed',
    absences: null,
    contact_channel: null,
    homework_delivery: null,
  });
  assert.deepEqual(planningAnswers(null), {
    documents_format: null,
    absences: null,
    contact_channel: null,
    homework_delivery: null,
  });
});

test('labelledAnswers reads stored values as the student saw them, skipping blanks', () => {
  const { answers } = validateQuestionnaire(
    { answers: germanAnswers({ exam: 'other' }), other: { exam: 'TOEFL' } },
    german
  );
  const rows = labelledAnswers(answers, german, 'en');
  const byId = Object.fromEntries(rows.map((r) => [r.id, r.text]));
  assert.equal(byId.documents_format, 'Printed');
  assert.equal(byId.focus_skills, 'Speaking, Grammar');
  assert.equal(byId.exam, 'Another exam (TOEFL)');
  assert.equal(
    byId.instruction_language,
    'Only German. English only to translate a specific word or phrase.'
  );
  assert.ok(!('vocab_topics' in byId));
  assert.equal(answerText('nope', answers), null);
});

test('syncStudentFields fills only empty goals and level', () => {
  const answers = { goals: '  Talk to my neighbours ', self_level: 'A2' };
  assert.deepEqual(syncStudentFields(answers, { learning_goals: null, current_level: '' }), {
    learning_goals: 'Talk to my neighbours',
    current_level: 'A2',
  });
  assert.deepEqual(
    syncStudentFields(answers, { learning_goals: 'Teacher notes', current_level: 'B1.1' }),
    {}
  );
  assert.deepEqual(syncStudentFields({ goals: null, self_level: 'unsure' }, {}), {});
});

test('the email greets by first name and links to the form, in both languages', () => {
  const url = 'https://learningwithgioia.ch/de/fragebogen?token=abc&lang=de';
  const de = buildQuestionnaireEmail({
    course: german,
    firstName: 'Ana',
    questionnaireUrl: url,
    language: 'de',
  });
  assert.equal(de.subject, 'Vor Ihrem Kursbeginn (LWG-1) — learning with gioia');
  assert.match(de.html, /Guten Tag Ana/);
  assert.match(de.html, /Deutsch B1 Kurs LWG-1/);
  assert.ok(de.html.includes(url.replace(/&/g, '&amp;')));
  assert.doesNotMatch(de.html, INFORMAL_DE);

  const en = questionnaireEmailCopy('en', german, '');
  assert.equal(en.greeting, 'Hello :)');
  assert.match(en.intro, /German B1 course LWG-1/);
});

test('the email escapes the first name', () => {
  const email = buildQuestionnaireEmail({
    course: german,
    firstName: '<b>x</b>',
    questionnaireUrl: 'https://example.test',
    language: 'en',
  });
  assert.ok(!email.html.includes('<b>x</b>'));
  assert.ok(email.html.includes('&lt;b&gt;x&lt;/b&gt;'));
});

test('homework delivery is only asked, and only required, when there is homework time', () => {
  const none = validateQuestionnaire(
    { answers: germanAnswers({ homework_time: 'none', homework_delivery: 'email' }) },
    german
  );
  assert.equal(none.error, undefined);
  assert.equal(none.answers.homework_delivery, null);

  const some = validateQuestionnaire(
    { answers: germanAnswers({ homework_delivery: undefined }) },
    german
  );
  assert.match(some.error, /^Please answer: How would you like to receive your homework/);
});

test('contact and homework options read "via" in English and "per" in German', () => {
  const en = questionnaireForLanguage('en', german);
  const de = questionnaireForLanguage('de', german);
  assert.deepEqual(
    question(en, 'contact_channel').options.map((o) => o.label),
    ['Via WhatsApp', 'Via email', 'No contact outside of class, except about course administration']
  );
  assert.deepEqual(
    question(de, 'homework_delivery').options.map((o) => o.label),
    ['Am Ende der Lektion', 'Per WhatsApp', 'Per E-Mail']
  );
});

test('contact and homework questions explain the group majority rule', () => {
  for (const lang of ['de', 'en']) {
    const set = questionnaireForLanguage(lang, german);
    for (const id of ['contact_channel', 'homework_delivery']) {
      const q = question(set, id);
      assert.equal(q.type, 'choice', id);
      assert.match(q.hint, lang === 'en' ? /most students applies to everyone/ : /Mehrheit/, id);
    }
  }
});
