// Run with: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COMMENT_MAX_LENGTH,
  FEEDBACK_CHOICES,
  FEEDBACK_COLUMNS,
  FEEDBACK_COMMENTS,
  FEEDBACK_FIELDS,
  FEEDBACK_NPS,
  FEEDBACK_QUESTIONS,
  FEEDBACK_SECTIONS,
  OTHER_MAX_LENGTH,
  courseDisplayName,
  courseFeedbackProfile,
  courseFeedbackProfiles,
  feedbackQuestionsForLanguage,
  fieldsForCourse,
  labelledAverages,
  optionLabel,
  summariseFeedback,
  validateFeedbackSubmission,
} from '../functions/api/_feedback.js';

/** A German B1 course — the profile everything defaults to. */
const LANGUAGE_COURSE = { subject: 'German', level: 'B1', course_type: 'language course' };
/** Maths tutoring — no speaking, no vocabulary. */
const MATHS_COURSE = { subject: 'Mathematics', level: null, course_type: 'tutoring' };
/** Gymi prep in German — a language course that also prepares for an exam. */
const GYMI_COURSE = { subject: 'German', level: null, course_type: 'gymivorbereitung' };

/** The smallest body the API accepts: every required question answered. */
function requiredAnswers(overrides = {}, course = null) {
  const answers = {};
  for (const field of fieldsForCourse(course)) {
    if (!field.required) continue;
    answers[field.id] = field.type === 'nps' ? 9 : 4;
  }
  return { ...answers, ...overrides };
}

/** The questions one course actually shows, flattened out of its sections. */
function askedQuestions(course, language = 'en') {
  return feedbackQuestionsForLanguage(language, course).sections.flatMap((s) => s.questions);
}

test('the registry, the columns and the sections line up', () => {
  // Every field is stored somewhere, and no two share a column.
  assert.equal(new Set(FEEDBACK_COLUMNS).size, FEEDBACK_COLUMNS.length);
  assert.equal(new Set(FEEDBACK_FIELDS.map((f) => f.id)).size, FEEDBACK_FIELDS.length);

  const sectionIds = new Set(FEEDBACK_SECTIONS.map((s) => s.id));
  for (const field of FEEDBACK_FIELDS) {
    assert.ok(sectionIds.has(field.section), `${field.id} has an unknown section`);
    assert.ok(field.de && field.en, `${field.id} is missing a label`);
    assert.ok(field.short.de && field.short.en, `${field.id} is missing a short label`);
    if (field.type === 'choice' || field.type === 'multi') {
      assert.ok(field.options.length, `${field.id} has no options`);
      assert.equal(
        new Set(field.options.map((o) => o.value)).size,
        field.options.length,
        `${field.id} has duplicate option values`
      );
    }
    if (field.other) {
      assert.ok(
        field.options.some((o) => o.value === 'other'),
        `${field.id} has an other column but no "other" option`
      );
    }
  }

  assert.equal(FEEDBACK_QUESTIONS.length, 11);
  assert.equal(FEEDBACK_COMMENTS.length, 7);
  assert.equal(FEEDBACK_CHOICES.length, 3);
  assert.equal(FEEDBACK_NPS.column, 'nps_recommend');

  // Questions we deliberately no longer ask: the course (the header names
  // it), the lesson count (enrolments know it) and permission to publish.
  for (const column of ['course_type', 'attendance_count', 'consent_publish']) {
    assert.equal(
      FEEDBACK_FIELDS.some((f) => f.column === column),
      false,
      `${column} should no longer be asked`
    );
  }
});

test('a course picks the profiles its questions are tailored to', () => {
  assert.equal(courseFeedbackProfile(LANGUAGE_COURSE), 'language');
  assert.equal(courseFeedbackProfile(MATHS_COURSE), 'academic');
  assert.equal(courseFeedbackProfile({ subject: 'Swiss German' }), 'language');
  assert.equal(courseFeedbackProfile({ subject: 'Physics' }), 'academic');
  // no subject: the course type, then a CEFR level, then the default
  assert.equal(courseFeedbackProfile({ course_type: 'gymivorbereitung' }), 'academic');
  assert.equal(courseFeedbackProfile({ course_type: 'language course' }), 'language');
  assert.equal(courseFeedbackProfile({ level: 'CH-B1' }), 'language');
  // a course that says nothing useful gets the default set
  assert.equal(courseFeedbackProfile({ level: '3. Sek' }), 'language');
  assert.equal(courseFeedbackProfile(null), 'language');

  // exam prep layers on top of the subject profile rather than replacing it
  assert.deepEqual(courseFeedbackProfiles(LANGUAGE_COURSE), ['language']);
  assert.deepEqual(courseFeedbackProfiles(MATHS_COURSE), ['academic']);
  assert.deepEqual(courseFeedbackProfiles(GYMI_COURSE), ['language', 'exam']);
  assert.deepEqual(
    courseFeedbackProfiles({ subject: 'Mathematics', course_type: 'gymivorbereitung' }),
    ['academic', 'exam']
  );
  assert.deepEqual(courseFeedbackProfiles({ subject: 'German', course_type: 'exam preparation' }), [
    'language',
    'exam',
  ]);
});

test('each profile gets its own questions and only its own', () => {
  const asked = (course) => fieldsForCourse(course).map((f) => f.id);

  assert.ok(asked(LANGUAGE_COURSE).includes('speaking'));
  assert.ok(asked(LANGUAGE_COURSE).includes('vocabulary'));
  assert.ok(!asked(LANGUAGE_COURSE).includes('independence'));
  assert.ok(!asked(LANGUAGE_COURSE).includes('exam_ready'));

  assert.ok(!asked(MATHS_COURSE).includes('speaking'));
  assert.ok(!asked(MATHS_COURSE).includes('vocabulary'));
  assert.ok(asked(MATHS_COURSE).includes('independence'));
  assert.ok(!asked(MATHS_COURSE).includes('exam_ready'));

  // Gymi-Deutsch keeps the language questions and gains the exam one
  assert.ok(asked(GYMI_COURSE).includes('speaking'));
  assert.ok(asked(GYMI_COURSE).includes('exam_ready'));
  assert.ok(!asked(GYMI_COURSE).includes('independence'));

  assert.equal(
    askedQuestions(GYMI_COURSE).find((q) => q.id === 'exam_ready').label,
    'I feel well prepared for the exam.'
  );
});

test('the question set names the subject it is about', () => {
  const confidence = (course, lang) =>
    askedQuestions(course, lang).find((q) => q.id === 'confidence').label;

  assert.equal(confidence(LANGUAGE_COURSE, 'de'), 'Ich spreche Deutsch jetzt selbstsicherer.');
  assert.equal(confidence(LANGUAGE_COURSE, 'en'), 'I feel more confident speaking German.');
  assert.equal(confidence(MATHS_COURSE, 'de'), 'Ich fühle mich in Mathematik jetzt sicherer.');
  assert.equal(confidence(MATHS_COURSE, 'en'), 'I feel more confident in Mathematics.');
  // an unknown subject falls back to a placeholder, never a stray {subject}
  assert.equal(
    confidence({ subject: 'Other' }, 'de'),
    'Ich fühle mich in diesem Fach jetzt sicherer.'
  );
  assert.equal(confidence(null, 'en'), 'I feel more confident speaking the language.');
});

test('activity options follow the profiles too', () => {
  const activities = (course) =>
    askedQuestions(course)
      .find((q) => q.id === 'activities')
      .options.map((o) => o.value);

  assert.deepEqual(activities(LANGUAGE_COURSE), [
    'speaking',
    'grammar',
    'vocabulary',
    'listening',
    'reading',
    'writing',
    'roleplay',
    'games',
    'homework',
    'other',
  ]);
  assert.deepEqual(activities(MATHS_COURSE), [
    'theory',
    'exercises',
    'past_papers',
    'games',
    'homework',
    'other',
  ]);
  // Gymi-Deutsch: the language activities plus past papers
  assert.deepEqual(activities(GYMI_COURSE), [
    'speaking',
    'grammar',
    'vocabulary',
    'listening',
    'reading',
    'writing',
    'roleplay',
    'past_papers',
    'games',
    'homework',
    'other',
  ]);
});

test('a non-language course neither requires nor stores language answers', () => {
  const { error, values } = validateFeedbackSubmission(
    { answers: requiredAnswers({}, MATHS_COURSE) },
    MATHS_COURSE
  );
  assert.equal(error, undefined);
  assert.equal(values.rating_independence, 4);
  assert.equal(values.rating_speaking, null);
  assert.equal(values.rating_vocabulary, null);
  // every column is still written, so a PATCH clears anything stale
  for (const column of FEEDBACK_COLUMNS) assert.ok(column in values, `${column} missing`);

  // an answer to a question that was never shown is dropped, not stored
  const smuggled = validateFeedbackSubmission(
    { answers: requiredAnswers({ speaking: 5 }, MATHS_COURSE) },
    MATHS_COURSE
  );
  assert.equal(smuggled.error, undefined);
  assert.equal(smuggled.values.rating_speaking, null);

  // and an option only the other profile offers is rejected
  const wrongOption = validateFeedbackSubmission(
    { answers: requiredAnswers({ activities: ['grammar'] }, MATHS_COURSE) },
    MATHS_COURSE
  );
  assert.match(wrongOption.error, /activities is not a valid choice/);

  // the language course still has to answer its own questions
  const missing = validateFeedbackSubmission(
    { answers: requiredAnswers({}, MATHS_COURSE) },
    LANGUAGE_COURSE
  );
  assert.match(missing.error, /Please answer/);

  // an exam course has to answer the exam question, others must not store it
  const gymi = validateFeedbackSubmission(
    { answers: requiredAnswers({}, GYMI_COURSE) },
    GYMI_COURSE
  );
  assert.equal(gymi.error, undefined);
  assert.equal(gymi.values.rating_exam_ready, 4);
  assert.equal(gymi.values.rating_independence, null);

  const noExamAnswer = validateFeedbackSubmission(
    { answers: requiredAnswers({ exam_ready: undefined }, GYMI_COURSE) },
    GYMI_COURSE
  );
  assert.match(noExamAnswer.error, /Please answer: I feel well prepared for the exam\./);

  const notAnExamCourse = validateFeedbackSubmission(
    { answers: requiredAnswers({ exam_ready: 5 }, LANGUAGE_COURSE) },
    LANGUAGE_COURSE
  );
  assert.equal(notAnExamCourse.values.rating_exam_ready, null);
});

test('courseDisplayName names the course for the form header', () => {
  assert.equal(courseDisplayName(LANGUAGE_COURSE, 'de'), 'Deutsch B1 · Sprachkurs');
  assert.equal(courseDisplayName(LANGUAGE_COURSE, 'en'), 'German B1 · language course');
  assert.equal(courseDisplayName(MATHS_COURSE, 'de'), 'Mathematik · Nachhilfe');
  assert.equal(courseDisplayName({ subject: 'Chemistry' }, 'de'), 'Chemistry');
  assert.equal(courseDisplayName(null, 'de'), '');
});

test('accepts a complete submission and maps it to DB columns', () => {
  const { error, values } = validateFeedbackSubmission({
    answers: requiredAnswers({
      satisfaction: 5,
      recommend: 10,
      positive: '  the pace was great  ',
      improve: 'more homework',
      progress: 'good',
      activities: ['grammar', 'speaking'],
      continue: 'yes',
    }),
  });
  assert.equal(error, undefined);
  assert.equal(values.rating_satisfaction, 5);
  assert.equal(values.nps_recommend, 10);
  assert.equal(values.comment_positive, 'the pace was great');
  assert.equal(values.comment_improve, 'more homework');
  assert.equal(values.progress_level, 'good');
  assert.equal(values.continue_interest, 'yes');
  // Stored in question order, not click order.
  assert.deepEqual(values.activities_helpful, ['speaking', 'grammar']);
  // Every column is written, so a PATCH never leaves a stale answer behind.
  for (const column of FEEDBACK_COLUMNS) {
    assert.ok(column in values, `${column} missing from the patch`);
  }
});

test('only the ratings and the recommendation are required', () => {
  const asked = fieldsForCourse(LANGUAGE_COURSE);
  const required = asked.filter((f) => f.required).map((f) => f.id);
  assert.deepEqual(required.sort(), [
    'comfort',
    'confidence',
    'materials',
    'organisation',
    'pace',
    'recommend',
    'satisfaction',
    'speaking',
    'teaching',
    'vocabulary',
  ]);

  for (const field of asked) {
    const answers = requiredAnswers();
    delete answers[field.id];
    const { error } = validateFeedbackSubmission({ answers });
    if (field.required) assert.match(error, /^Please answer: /);
    else assert.equal(error, undefined, `${field.id} should be optional`);
  }
});

test('optional answers normalise to null', () => {
  const { values } = validateFeedbackSubmission({ answers: requiredAnswers() });
  for (const field of FEEDBACK_COMMENTS) assert.equal(values[field.column], null);
  for (const field of FEEDBACK_CHOICES) assert.equal(values[field.column], null);

  const blank = validateFeedbackSubmission({
    answers: requiredAnswers({ positive: '   ', improve: '', activities: [] }),
  });
  assert.equal(blank.values.comment_positive, null);
  assert.equal(blank.values.comment_improve, null);
  assert.equal(blank.values.activities_helpful, null);
});

test('rejects malformed bodies', () => {
  assert.match(validateFeedbackSubmission(null).error, /JSON object/);
  assert.match(validateFeedbackSubmission({ answers: [] }).error, /answers must be an object/);
  assert.match(
    validateFeedbackSubmission({ answers: requiredAnswers(), other: 'nope' }).error,
    /other must be an object/
  );
  assert.match(
    validateFeedbackSubmission({ answers: requiredAnswers({ activities: 'speaking' }) }).error,
    /activities must be an array/
  );
});

test('the first version of the form still posts successfully', () => {
  // { ratings, comments } instead of a flat { answers }.
  const { error, values } = validateFeedbackSubmission({
    ratings: requiredAnswers(),
    comments: { positive: 'good stuff' },
  });
  assert.equal(error, undefined);
  assert.equal(values.comment_positive, 'good stuff');
  assert.equal(values.rating_teaching, 4);
});

test('ratings are 1-5 whole numbers and the NPS is 0-10', () => {
  for (const bad of [0, 6, 2.5, -1, 'high', NaN]) {
    const { error } = validateFeedbackSubmission({ answers: requiredAnswers({ pace: bad }) });
    assert.match(error, /pace must be a whole number between 1 and 5/, `accepted ${bad}`);
  }
  for (const bad of [11, -1, 7.5, 'ten']) {
    const { error } = validateFeedbackSubmission({ answers: requiredAnswers({ recommend: bad }) });
    assert.match(error, /recommend must be a whole number between 0 and 10/, `accepted ${bad}`);
  }
  // 0 is a real NPS answer, not a missing one.
  const zero = validateFeedbackSubmission({ answers: requiredAnswers({ recommend: 0 }) });
  assert.equal(zero.error, undefined);
  assert.equal(zero.values.nps_recommend, 0);

  // numeric strings from a form post are fine
  const { error, values } = validateFeedbackSubmission({ answers: requiredAnswers({ pace: '4' }) });
  assert.equal(error, undefined);
  assert.equal(values.rating_pace, 4);
});

test('choices must be one of the offered options', () => {
  assert.match(
    validateFeedbackSubmission({ answers: requiredAnswers({ progress: 'loads' }) }).error,
    /progress is not a valid choice/
  );
  assert.match(
    validateFeedbackSubmission({ answers: requiredAnswers({ activities: ['naps'] }) }).error,
    /activities is not a valid choice/
  );
  assert.match(
    validateFeedbackSubmission({ answers: requiredAnswers({ continue: 42 }) }).error,
    /continue is not a valid choice/
  );
});

test('duplicate multi-select values collapse to one', () => {
  const { values } = validateFeedbackSubmission({
    answers: requiredAnswers({ activities: ['games', 'games', 'reading'] }),
  });
  assert.deepEqual(values.activities_helpful, ['reading', 'games']);
});

test('an "other" answer is only kept when "other" was picked', () => {
  const picked = validateFeedbackSubmission({
    answers: requiredAnswers({ activities: ['other'] }),
    other: { activities: '  karaoke  ' },
  });
  assert.equal(picked.values.activities_other, 'karaoke');

  const notPicked = validateFeedbackSubmission({
    answers: requiredAnswers({ activities: ['games'] }),
    other: { activities: 'karaoke' },
  });
  assert.equal(notPicked.values.activities_other, null);

  const tooLong = validateFeedbackSubmission({
    answers: requiredAnswers({ activities: ['other'] }),
    other: { activities: 'x'.repeat(OTHER_MAX_LENGTH + 1) },
  });
  assert.match(tooLong.error, /at most 120 characters/);
});

test('comments are length limited and must be strings', () => {
  const tooLong = 'x'.repeat(COMMENT_MAX_LENGTH + 1);
  assert.match(
    validateFeedbackSubmission({ answers: requiredAnswers({ positive: tooLong }) }).error,
    /at most 2000 characters/
  );
  assert.match(
    validateFeedbackSubmission({ answers: requiredAnswers({ improve: 42 }) }).error,
    /improve must be a string/
  );
});

test('summariseFeedback counts requests and averages submitted rows only', () => {
  const summary = summariseFeedback([
    {
      submitted_at: '2026-08-01T10:00:00Z',
      rating_teaching: 5,
      rating_materials: 4,
      rating_pace: 4,
      nps_recommend: 10,
    },
    {
      submitted_at: '2026-08-02T10:00:00Z',
      rating_teaching: 4,
      rating_materials: 3,
      rating_pace: 3,
      nps_recommend: 4,
    },
    { submitted_at: null, rating_teaching: 1, nps_recommend: 0 },
  ]);
  assert.equal(summary.requested, 3);
  assert.equal(summary.submitted, 2);
  assert.equal(summary.averages.teaching, 4.5);
  assert.equal(summary.averages.materials, 3.5);
  assert.equal(summary.averages.pace, 3.5);
  assert.equal(summary.averages.confidence, null);
  assert.equal(summary.nps.responses, 2);
  assert.equal(summary.nps.average, 7);
  // one promoter, one detractor
  assert.equal(summary.nps.score, 0);
  // No headline average: courses are asked different questions, so the NPS
  // is the only figure every response contributes to.
  assert.equal('overall' in summary, false);
});

test('summariseFeedback handles empty and unanswered input', () => {
  const empty = summariseFeedback([]);
  assert.equal(empty.requested, 0);
  assert.equal(empty.submitted, 0);
  assert.equal(empty.nps.score, null);
  assert.equal(Object.keys(empty.averages).length, FEEDBACK_QUESTIONS.length);
  for (const value of Object.values(empty.averages)) assert.equal(value, null);

  assert.equal(summariseFeedback(undefined).requested, 0);
  assert.equal(summariseFeedback([{ submitted_at: null }]).submitted, 0);
});

test('summariseFeedback rounds to one decimal', () => {
  const rows = [1, 2, 2].map((n) => ({ submitted_at: 'x', rating_teaching: n }));
  assert.equal(summariseFeedback(rows).averages.teaching, 1.7);
});

test('labelledAverages pairs every question with its value', () => {
  const { averages } = summariseFeedback([
    { submitted_at: 'x', rating_teaching: 5, rating_materials: 4, rating_pace: null },
  ]);
  const labelled = labelledAverages(averages);
  assert.equal(labelled.length, FEEDBACK_QUESTIONS.length);
  assert.equal(labelled.find((a) => a.id === 'teaching').value, 5);
  assert.equal(labelled.find((a) => a.id === 'pace').value, null);
  assert.equal(labelledAverages(averages, 'de').find((a) => a.id === 'pace').label, 'Tempo');
  // no averages at all still yields one entry per question
  assert.equal(labelledAverages(undefined).length, FEEDBACK_QUESTIONS.length);
  assert.equal(labelledAverages(undefined)[0].value, null);
});

test('feedbackQuestionsForLanguage returns one language and defaults to German', () => {
  const en = feedbackQuestionsForLanguage('en');
  const flat = en.sections.flatMap((s) => s.questions);
  assert.deepEqual(en.profiles, ['language']);
  assert.equal(flat.length, fieldsForCourse(null).length);
  assert.deepEqual(
    en.sections.map((s) => s.id),
    ['ratings', 'words', 'progress', 'next']
  );

  const satisfaction = flat.find((q) => q.id === 'satisfaction');
  assert.equal(satisfaction.label, 'Overall, how satisfied are you with the lessons?');
  assert.equal(satisfaction.min, 1);
  assert.equal(satisfaction.max, 5);
  assert.equal(satisfaction.maxLabel, 'very satisfied');
  assert.equal(satisfaction.required, true);

  // statements fall back to the shared poor/excellent endpoints
  assert.equal(flat.find((q) => q.id === 'pace').maxLabel, 'excellent');

  const recommend = flat.find((q) => q.id === 'recommend');
  assert.equal(recommend.min, 0);
  assert.equal(recommend.max, 10);

  const activities = flat.find((q) => q.id === 'activities');
  assert.equal(activities.options.length, 10);
  assert.equal(activities.options.at(-1).label, 'Other');
  assert.equal(activities.other, true);
  assert.equal(activities.hint, 'Select all that apply.');

  // no field leaks the other language's copy
  for (const q of flat) assert.equal(typeof q.label, 'string');

  for (const lang of ['de', 'fr', undefined]) {
    const set = feedbackQuestionsForLanguage(lang);
    const first = set.sections[0].questions[0];
    assert.equal(first.label, 'Wie zufrieden bist du insgesamt mit dem Unterricht?');
    assert.equal(set.sections[0].title, 'Wie war es?');
  }
});

test('optionLabel resolves stored values in both languages', () => {
  const progress = FEEDBACK_CHOICES.find((f) => f.id === 'progress');
  assert.equal(optionLabel(progress, 'a_lot', 'en'), 'A lot of progress');
  assert.equal(optionLabel(progress, 'a_lot', 'de'), 'Sehr grosse Fortschritte');
  // an unknown value falls back to itself rather than throwing
  assert.equal(optionLabel(progress, 'mystery'), 'mystery');
});
