// Run with: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COMMENT_MAX_LENGTH,
  DEFAULT_KIND,
  FEEDBACK_FORMS,
  FEEDBACK_KINDS,
  OTHER_MAX_LENGTH,
  choiceFields,
  commentFields,
  conditionMet,
  courseDisplayName,
  courseFeedbackProfile,
  courseFeedbackProfiles,
  feedbackFields,
  feedbackQuestionLabels,
  feedbackQuestionsForLanguage,
  fieldsForCourse,
  isFeedbackKind,
  kindLabel,
  labelledAverages,
  npsField,
  optionLabel,
  otherKey,
  ratingFields,
  summariseByKind,
  summariseFeedback,
  validateFeedbackSubmission,
} from '../functions/api/_feedback.js';

/** A German B1 course — the profile everything defaults to. */
const LANGUAGE_COURSE = { subject: 'German', level: 'B1', course_type: 'language course' };
/** Maths tutoring — no speaking, no vocabulary. */
const MATHS_COURSE = { subject: 'Mathematics', level: null, course_type: 'tutoring' };
/** Gymi prep in German — a language course that also prepares for an exam. */
const GYMI_COURSE = { subject: 'German', level: null, course_type: 'gymivorbereitung' };

/** The smallest body one form accepts: every required question answered. */
function requiredAnswers(kind, overrides = {}, course = null) {
  const answers = {};
  for (const field of fieldsForCourse(kind, course)) {
    if (!field.required) continue;
    if (field.type === 'nps') answers[field.id] = 9;
    else if (field.type === 'scale') answers[field.id] = 4;
    else if (field.type === 'choice') answers[field.id] = field.options[0].value;
    else if (field.type === 'multi') answers[field.id] = [field.options[0].value];
    else answers[field.id] = 'answer';
  }
  return { ...answers, ...overrides };
}

/** The questions one course actually shows, flattened out of the steps. */
function askedQuestions(kind, course, language = 'en') {
  return feedbackQuestionsForLanguage(kind, language, course).steps.flatMap((s) => s.questions);
}

/* Informal German: pronouns and the verb forms that only go with "du". */
const INFORMAL_DE =
  /\b(du|dich|dir|dein|deine|deinen|deinem|deiner|magst|kannst|hast|bist|möchtest|findest|fühlst)\b/i;

function germanStrings(field) {
  const out = [field.de, field.short?.de, field.hint?.de];
  for (const o of field.options || []) out.push(o.de);
  for (const v of Object.values(field.byProfile || {})) out.push(v.de);
  return out.filter(Boolean);
}

test('there are exactly two forms and both are known kinds', () => {
  assert.deepEqual(FEEDBACK_KINDS, ['midterm', 'final']);
  assert.deepEqual(Object.keys(FEEDBACK_FORMS).sort(), ['final', 'midterm']);
  assert.equal(DEFAULT_KIND, 'final');
  assert.ok(isFeedbackKind('midterm'));
  assert.ok(!isFeedbackKind('weekly'));
  assert.throws(() => feedbackFields('weekly'), /Unknown feedback kind/);
  assert.equal(kindLabel('midterm'), 'mid-course');
  assert.equal(kindLabel('final', 'de'), 'Abschlussfeedback');
});

for (const kind of FEEDBACK_KINDS) {
  test(`${kind}: the registry is consistent`, () => {
    const fields = feedbackFields(kind);
    assert.equal(new Set(fields.map((f) => f.id)).size, fields.length, 'duplicate ids');

    const seen = new Set();
    for (const field of fields) {
      assert.ok(field.de && field.en, `${field.id} is missing a label`);
      assert.ok(field.short?.de && field.short?.en, `${field.id} is missing a short label`);
      assert.ok(Number.isInteger(field.step) && field.step >= 0, `${field.id} has no step`);
      assert.ok(
        ['scale', 'nps', 'choice', 'multi', 'text'].includes(field.type),
        `${field.id} has an unknown type`
      );
      if (field.type === 'choice' || field.type === 'multi') {
        assert.ok(field.options.length, `${field.id} has no options`);
        assert.equal(
          new Set(field.options.map((o) => o.value)).size,
          field.options.length,
          `${field.id} has duplicate option values`
        );
        for (const o of field.options) assert.ok(o.de && o.en, `${field.id}/${o.value} label`);
      } else {
        assert.equal(field.options, undefined, `${field.id} should not have options`);
      }
      if (field.other) {
        assert.ok(
          field.options.some((o) => o.value === 'other'),
          `${field.id} has an other box but no "other" option`
        );
        assert.equal(otherKey(field), field.id + '_other');
      }
      if (field.showIf) {
        // The controlling question has to be validated first, so it must
        // come earlier, and it must be able to produce the trigger values.
        assert.ok(seen.has(field.showIf.id), `${field.id} depends on a later question`);
        const controller = fields.find((f) => f.id === field.showIf.id);
        for (const v of field.showIf.values) {
          assert.ok(
            controller.options.some((o) => o.value === v),
            `${field.id} waits for a value ${controller.id} cannot take`
          );
        }
      }
      seen.add(field.id);
    }

    // Steps are contiguous: no empty page in the middle.
    const steps = new Set(fields.map((f) => f.step));
    for (let i = 0; i < steps.size; i += 1) assert.ok(steps.has(i), `step ${i} is empty`);
    assert.ok(FEEDBACK_FORMS[kind].minutes.de && FEEDBACK_FORMS[kind].minutes.en);
  });

  test(`${kind}: every German string addresses the student formally`, () => {
    for (const field of feedbackFields(kind)) {
      for (const text of germanStrings(field)) {
        assert.doesNotMatch(text, INFORMAL_DE, `${field.id}: "${text}"`);
        assert.doesNotMatch(text, /ß/, `${field.id}: Swiss spelling uses ss: "${text}"`);
      }
    }
  });

  test(`${kind}: the question set is tailored to the course and keeps the structure`, () => {
    for (const course of [LANGUAGE_COURSE, MATHS_COURSE, GYMI_COURSE, null]) {
      for (const lang of ['de', 'en']) {
        const set = feedbackQuestionsForLanguage(kind, lang, course);
        assert.equal(set.kind, kind);
        assert.ok(set.steps.length >= 2, 'a form has several steps');
        for (const step of set.steps) {
          assert.equal(step.title, undefined, 'steps carry no title');
          assert.ok(step.questions.length);
        }
        const flat = set.steps.flatMap((s) => s.questions);
        assert.equal(flat.length, fieldsForCourse(kind, course).length);
        for (const q of flat) {
          assert.equal(typeof q.label, 'string');
          assert.ok(!q.label.includes('{subject}'));
          // One scale everywhere: 1-10, the recommendation included.
          if (q.type === 'scale' || q.type === 'nps') assert.deepEqual([q.min, q.max], [1, 10]);
          if (q.type === 'text') assert.equal(q.maxLength, COMMENT_MAX_LENGTH);
        }
        assert.equal(set.minutes, FEEDBACK_FORMS[kind].minutes[lang]);
        assert.equal(set.otherMaxLength, OTHER_MAX_LENGTH);
      }
    }
  });

  test(`${kind}: a required-only body passes for every course profile`, () => {
    for (const course of [LANGUAGE_COURSE, MATHS_COURSE, GYMI_COURSE, null]) {
      const { error, answers } = validateFeedbackSubmission(
        kind,
        { answers: requiredAnswers(kind, {}, course) },
        course
      );
      assert.equal(error, undefined, `${JSON.stringify(course)}: ${error}`);
      // every question has an entry, asked or not, so the JSON is complete
      for (const field of feedbackFields(kind)) {
        assert.ok(field.id in answers, `${field.id} missing`);
        if (field.other) assert.ok(otherKey(field) in answers, `${otherKey(field)} missing`);
      }
    }
  });

  test(`${kind}: each required question blocks submission on its own`, () => {
    const asked = fieldsForCourse(kind, LANGUAGE_COURSE);
    for (const field of asked) {
      if (field.showIf) continue;
      const answers = requiredAnswers(kind, {}, LANGUAGE_COURSE);
      delete answers[field.id];
      const { error } = validateFeedbackSubmission(kind, { answers }, LANGUAGE_COURSE);
      if (field.required) assert.match(error, /^Please answer: /, field.id);
      else assert.equal(error, undefined, `${field.id} should be optional`);
    }
  });

  test(`${kind}: the admin labels cover every stored question`, () => {
    const labels = feedbackQuestionLabels(kind);
    const ids = [
      ...labels.ratings.map((q) => q.id),
      ...labels.choices.map((q) => q.id),
      ...labels.comments.map((q) => q.id),
    ];
    assert.deepEqual(
      ids.sort(),
      feedbackFields(kind)
        .map((f) => f.id)
        .sort()
    );
    for (const q of labels.choices) {
      assert.ok(q.options.every((o) => o.label));
    }
    for (const q of labels.ratings) assert.ok([5, 10].includes(q.max));
  });
}

test('a course picks the profiles its questions are tailored to', () => {
  assert.equal(courseFeedbackProfile(LANGUAGE_COURSE), 'language');
  assert.equal(courseFeedbackProfile(MATHS_COURSE), 'academic');
  assert.equal(courseFeedbackProfile({ subject: 'Swiss German' }), 'language');
  assert.equal(courseFeedbackProfile({ subject: 'Physics' }), 'academic');
  assert.equal(courseFeedbackProfile({ course_type: 'gymivorbereitung' }), 'academic');
  assert.equal(courseFeedbackProfile({ course_type: 'language course' }), 'language');
  assert.equal(courseFeedbackProfile({ level: 'CH-B1' }), 'language');
  assert.equal(courseFeedbackProfile({ level: '3. Sek' }), 'language');
  assert.equal(courseFeedbackProfile(null), 'language');

  assert.deepEqual(courseFeedbackProfiles(LANGUAGE_COURSE), ['language']);
  assert.deepEqual(courseFeedbackProfiles(MATHS_COURSE), ['academic']);
  assert.deepEqual(courseFeedbackProfiles(GYMI_COURSE), ['language', 'exam']);
  assert.deepEqual(
    courseFeedbackProfiles({ subject: 'Mathematics', course_type: 'gymivorbereitung' }),
    ['academic', 'exam']
  );
});

test('final: each profile gets its own questions and only its own', () => {
  const asked = (course) => fieldsForCourse('final', course).map((f) => f.id);

  assert.ok(asked(LANGUAGE_COURSE).includes('speaking'));
  assert.ok(asked(LANGUAGE_COURSE).includes('vocabulary'));
  assert.ok(!asked(LANGUAGE_COURSE).includes('exam_ready'));

  assert.ok(!asked(MATHS_COURSE).includes('speaking'));
  assert.ok(!asked(MATHS_COURSE).includes('vocabulary'));
  assert.ok(!asked(MATHS_COURSE).includes('exam_ready'));

  assert.ok(asked(GYMI_COURSE).includes('speaking'));
  assert.ok(asked(GYMI_COURSE).includes('exam_ready'));

  // Questions deliberately dropped from the form.
  for (const id of ['confidence', 'independence', 'difficult', 'one_change']) {
    assert.ok(!asked(null).includes(id), `${id} should no longer be asked`);
  }
});

test('final: activity options follow the profiles', () => {
  const activities = (course) =>
    askedQuestions('final', course)
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
  assert.ok(activities(GYMI_COURSE).includes('past_papers'));
  assert.ok(activities(GYMI_COURSE).includes('speaking'));
});

test('midterm: material and study options follow the profiles', () => {
  const values = (course, id) =>
    askedQuestions('midterm', course)
      .find((q) => q.id === id)
      .options.map((o) => o.value);

  assert.ok(values(LANGUAGE_COURSE, 'materials_liked').includes('audio_video'));
  assert.ok(!values(LANGUAGE_COURSE, 'materials_liked').includes('past_papers'));
  assert.ok(values(MATHS_COURSE, 'materials_liked').includes('past_papers'));
  assert.ok(!values(MATHS_COURSE, 'materials_liked').includes('authentic'));
  assert.ok(!values(MATHS_COURSE, 'home_study').includes('media'));
  assert.ok(values(LANGUAGE_COURSE, 'home_study').includes('talking'));
  assert.ok(!values(MATHS_COURSE, 'class_style').includes('games_roleplay'));

  // the mid-course topics Gioia asked for are all there
  const ids = fieldsForCourse('midterm', null).map((f) => f.id);
  for (const id of [
    'materials_liked',
    'class_style',
    'home_study',
    'frequency',
    'breaks',
    'substitute',
  ]) {
    assert.ok(ids.includes(id), `${id} missing from the mid-course form`);
  }
});

test('final: a non-language course neither requires nor stores language answers', () => {
  const { error, answers } = validateFeedbackSubmission(
    'final',
    { answers: requiredAnswers('final', {}, MATHS_COURSE) },
    MATHS_COURSE
  );
  assert.equal(error, undefined);
  assert.equal(answers.speaking, null);
  assert.equal(answers.vocabulary, null);

  // an answer to a question that was never shown is dropped, not stored
  const smuggled = validateFeedbackSubmission(
    'final',
    { answers: requiredAnswers('final', { speaking: 5 }, MATHS_COURSE) },
    MATHS_COURSE
  );
  assert.equal(smuggled.error, undefined);
  assert.equal(smuggled.answers.speaking, null);

  // and an option only the other profile offers is rejected
  const wrongOption = validateFeedbackSubmission(
    'final',
    { answers: requiredAnswers('final', { activities: ['grammar'] }, MATHS_COURSE) },
    MATHS_COURSE
  );
  assert.match(wrongOption.error, /activities is not a valid choice/);

  // the language course still has to answer its own questions
  const missing = validateFeedbackSubmission(
    'final',
    { answers: requiredAnswers('final', {}, MATHS_COURSE) },
    LANGUAGE_COURSE
  );
  assert.match(missing.error, /Please answer/);

  const noExamAnswer = validateFeedbackSubmission(
    'final',
    { answers: requiredAnswers('final', { exam_ready: undefined }, GYMI_COURSE) },
    GYMI_COURSE
  );
  assert.match(noExamAnswer.error, /Please answer: I feel well prepared for the exam\./);

  const notAnExamCourse = validateFeedbackSubmission(
    'final',
    { answers: requiredAnswers('final', { exam_ready: 5 }, LANGUAGE_COURSE) },
    LANGUAGE_COURSE
  );
  assert.equal(notAnExamCourse.answers.exam_ready, null);
});

test('conditional follow-ups are only stored when their condition is met', () => {
  const note = feedbackFields('final').find((f) => f.id === 'progress_note');
  assert.ok(conditionMet(note, { progress: 'little' }));
  assert.ok(!conditionMet(note, { progress: 'a_lot' }));
  assert.ok(!conditionMet(note, {}));

  // low progress: the explanation is kept
  const low = validateFeedbackSubmission('final', {
    answers: requiredAnswers('final', { progress: 'some', progress_note: ' more homework ' }),
  });
  assert.equal(low.error, undefined);
  assert.equal(low.answers.progress_note, 'more homework');

  // good progress: the box was never shown, so whatever was posted is dropped
  const high = validateFeedbackSubmission('final', {
    answers: requiredAnswers('final', { progress: 'a_lot', progress_note: 'smuggled' }),
  });
  assert.equal(high.error, undefined);
  assert.equal(high.answers.progress_note, null);

  // "what next" only with yes/maybe
  const no = validateFeedbackSubmission('final', {
    answers: requiredAnswers('final', { continue: 'no', next_topic: 'C1' }),
  });
  assert.equal(no.answers.next_topic, null);
  const maybe = validateFeedbackSubmission('final', {
    answers: requiredAnswers('final', { continue: 'maybe', next_topic: 'C1' }),
  });
  assert.equal(maybe.answers.next_topic, 'C1');

  // the public question set carries the condition for the browser
  const q = askedQuestions('final', null).find((x) => x.id === 'next_topic');
  assert.deepEqual(q.showIf, { id: 'continue', values: ['yes', 'maybe'] });
});

test('courseDisplayName names the course for the form header', () => {
  assert.equal(courseDisplayName(LANGUAGE_COURSE, 'de'), 'Deutsch B1 · Sprachkurs');
  assert.equal(courseDisplayName(LANGUAGE_COURSE, 'en'), 'German B1 · language course');
  assert.equal(courseDisplayName(MATHS_COURSE, 'de'), 'Mathematik · Nachhilfe');
  assert.equal(courseDisplayName({ subject: 'Chemistry' }, 'de'), 'Chemistry');
  assert.equal(courseDisplayName(null, 'de'), '');
});

test('final: accepts a complete submission and keeps it keyed by question id', () => {
  const { error, answers } = validateFeedbackSubmission('final', {
    answers: requiredAnswers('final', {
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
  assert.equal(answers.satisfaction, 5);
  assert.equal(answers.recommend, 10);
  assert.equal(answers.positive, 'the pace was great');
  assert.equal(answers.improve, 'more homework');
  assert.equal(answers.progress, 'good');
  assert.equal(answers.continue, 'yes');
  // Stored in question order, not click order.
  assert.deepEqual(answers.activities, ['speaking', 'grammar']);
  // Nothing about the student is part of the stored answers.
  for (const key of Object.keys(answers)) {
    assert.doesNotMatch(key, /student|name|email|token/);
  }
});

test('final: only the ratings, progress and the recommendation are required', () => {
  const required = fieldsForCourse('final', LANGUAGE_COURSE)
    .filter((f) => f.required)
    .map((f) => f.id)
    .sort();
  assert.deepEqual(required, [
    'comfort',
    'materials',
    'organisation',
    'pace',
    'progress',
    'recommend',
    'satisfaction',
    'speaking',
    'teaching',
    'vocabulary',
  ]);
});

test('midterm: satisfaction, pace and the schedule questions are required', () => {
  const required = fieldsForCourse('midterm', LANGUAGE_COURSE)
    .filter((f) => f.required)
    .map((f) => f.id)
    .sort();
  assert.deepEqual(required, ['breaks', 'frequency', 'pace', 'satisfaction', 'substitute']);
});

test('optional answers normalise to null', () => {
  const { answers } = validateFeedbackSubmission('final', {
    answers: requiredAnswers('final'),
  });
  for (const field of commentFields('final')) assert.equal(answers[field.id], null);
  for (const field of choiceFields('final')) {
    if (!field.required) assert.equal(answers[field.id], null);
  }

  const blank = validateFeedbackSubmission('final', {
    answers: requiredAnswers('final', { positive: '   ', improve: '', activities: [] }),
  });
  assert.equal(blank.answers.positive, null);
  assert.equal(blank.answers.improve, null);
  assert.equal(blank.answers.activities, null);
});

test('rejects malformed bodies and unknown kinds', () => {
  assert.match(validateFeedbackSubmission('final', null).error, /JSON object/);
  assert.match(
    validateFeedbackSubmission('weekly', { answers: {} }).error,
    /Unknown feedback kind/
  );
  assert.match(
    validateFeedbackSubmission('final', { answers: [] }).error,
    /answers must be an object/
  );
  assert.match(
    validateFeedbackSubmission('final', { answers: requiredAnswers('final'), other: 'nope' }).error,
    /other must be an object/
  );
  assert.match(
    validateFeedbackSubmission('final', {
      answers: requiredAnswers('final', { activities: 'speaking' }),
    }).error,
    /activities must be an array/
  );
  // the old { ratings, comments } shape is no longer accepted silently
  assert.match(
    validateFeedbackSubmission('final', { ratings: requiredAnswers('final') }).error,
    /Please answer/
  );
});

test('every rating, the recommendation included, is a whole number from 1 to 10', () => {
  for (const bad of [0, 11, 2.5, -1, 'high', NaN]) {
    const { error } = validateFeedbackSubmission('final', {
      answers: requiredAnswers('final', { pace: bad }),
    });
    assert.match(error, /pace must be a whole number between 1 and 10/, `accepted ${bad}`);
  }
  for (const bad of [0, 11, -1, 7.5, 'ten']) {
    const { error } = validateFeedbackSubmission('final', {
      answers: requiredAnswers('final', { recommend: bad }),
    });
    assert.match(error, /recommend must be a whole number between 1 and 10/, `accepted ${bad}`);
  }
  for (const edge of [1, 10]) {
    const ok = validateFeedbackSubmission('final', {
      answers: requiredAnswers('final', { pace: edge, recommend: edge }),
    });
    assert.equal(ok.error, undefined);
    assert.equal(ok.answers.pace, edge);
    assert.equal(ok.answers.recommend, edge);
  }

  // numeric strings from a form post are fine
  const { error, answers } = validateFeedbackSubmission('final', {
    answers: requiredAnswers('final', { pace: '7' }),
  });
  assert.equal(error, undefined);
  assert.equal(answers.pace, 7);
});

test('midterm: an unsuitable frequency asks for the preferred one', () => {
  for (const value of ['too_rare', 'too_often']) {
    const { error, answers } = validateFeedbackSubmission('midterm', {
      answers: requiredAnswers('midterm', {
        frequency: value,
        frequency_note: ' zweimal pro Woche, 60 Minuten ',
      }),
    });
    assert.equal(error, undefined);
    assert.equal(answers.frequency_note, 'zweimal pro Woche, 60 Minuten');
  }

  // "just right" never shows the box, so nothing posted for it is kept
  const right = validateFeedbackSubmission('midterm', {
    answers: requiredAnswers('midterm', { frequency: 'right', frequency_note: 'smuggled' }),
  });
  assert.equal(right.error, undefined);
  assert.equal(right.answers.frequency_note, null);

  const q = askedQuestions('midterm', null, 'de').find((x) => x.id === 'frequency_note');
  assert.deepEqual(q.showIf, { id: 'frequency', values: ['too_rare', 'too_often'] });
  assert.equal(q.required, false);
  assert.match(q.hint, /zweimal pro Woche/);
});

test('midterm: "other" on the substitute question asks the student to specify', () => {
  const depends = validateFeedbackSubmission('midterm', {
    answers: requiredAnswers('midterm', {
      substitute: 'other',
      substitute_note: ' Bei kurzfristigen Absagen lieber nachholen. ',
    }),
  });
  assert.equal(depends.error, undefined);
  assert.equal(depends.answers.substitute_note, 'Bei kurzfristigen Absagen lieber nachholen.');

  // a clear preference never shows the box, so nothing posted for it is kept
  const clear = validateFeedbackSubmission('midterm', {
    answers: requiredAnswers('midterm', { substitute: 'substitute', substitute_note: 'smuggled' }),
  });
  assert.equal(clear.error, undefined);
  assert.equal(clear.answers.substitute_note, null);

  const q = askedQuestions('midterm', null).find((x) => x.id === 'substitute_note');
  assert.deepEqual(q.showIf, { id: 'substitute', values: ['other'] });
  assert.equal(q.required, false);
  assert.equal(q.label, 'Please specify');
});

test('choices must be one of the offered options', () => {
  assert.match(
    validateFeedbackSubmission('final', {
      answers: requiredAnswers('final', { progress: 'loads' }),
    }).error,
    /progress is not a valid choice/
  );
  assert.match(
    validateFeedbackSubmission('final', {
      answers: requiredAnswers('final', { activities: ['naps'] }),
    }).error,
    /activities is not a valid choice/
  );
  assert.match(
    validateFeedbackSubmission('midterm', {
      answers: requiredAnswers('midterm', { frequency: 'daily' }),
    }).error,
    /frequency is not a valid choice/
  );
});

test('duplicate multi-select values collapse to one', () => {
  const { answers } = validateFeedbackSubmission('final', {
    answers: requiredAnswers('final', { activities: ['games', 'games', 'reading'] }),
  });
  assert.deepEqual(answers.activities, ['reading', 'games']);
});

test('an "other" answer is only kept when "other" was picked', () => {
  const picked = validateFeedbackSubmission('midterm', {
    answers: requiredAnswers('midterm', { home_study: ['other'] }),
    other: { home_study: '  flashcards  ' },
  });
  assert.equal(picked.error, undefined);
  assert.equal(picked.answers.home_study_other, 'flashcards');

  const notPicked = validateFeedbackSubmission('midterm', {
    answers: requiredAnswers('midterm', { home_study: ['apps'] }),
    other: { home_study: 'flashcards' },
  });
  assert.equal(notPicked.answers.home_study_other, null);

  const tooLong = validateFeedbackSubmission('final', {
    answers: requiredAnswers('final', { activities: ['other'] }),
    other: { activities: 'x'.repeat(OTHER_MAX_LENGTH + 1) },
  });
  assert.match(tooLong.error, /at most 120 characters/);
});

test('comments are length limited and must be strings', () => {
  const tooLong = 'x'.repeat(COMMENT_MAX_LENGTH + 1);
  assert.match(
    validateFeedbackSubmission('final', {
      answers: requiredAnswers('final', { positive: tooLong }),
    }).error,
    /at most 2000 characters/
  );
  assert.match(
    validateFeedbackSubmission('final', { answers: requiredAnswers('final', { improve: 42 }) })
      .error,
    /improve must be a string/
  );
});

test('summariseFeedback counts requests and averages anonymous responses', () => {
  const requests = [{ kind: 'final' }, { kind: 'final' }, { kind: 'final' }];
  const responses = [
    { kind: 'final', answers: { teaching: 5, materials: 4, pace: 4, recommend: 10 } },
    { kind: 'final', answers: { teaching: 4, materials: 3, pace: 3, recommend: 4 } },
  ];
  const summary = summariseFeedback('final', requests, responses);
  assert.equal(summary.requested, 3);
  assert.equal(summary.submitted, 2);
  assert.equal(summary.averages.teaching, 4.5);
  assert.equal(summary.averages.materials, 3.5);
  assert.equal(summary.averages.pace, 3.5);
  assert.equal(summary.averages.satisfaction, null);
  assert.equal(summary.nps.responses, 2);
  assert.equal(summary.nps.average, 7);
  // one promoter, one detractor
  assert.equal(summary.nps.score, 0);
  // No headline average and nothing per student.
  assert.equal('overall' in summary, false);
  assert.equal('responses' in summary, false);
});

test('summariseFeedback handles empty input and forms without an NPS', () => {
  const empty = summariseFeedback('final', [], []);
  assert.equal(empty.requested, 0);
  assert.equal(empty.submitted, 0);
  assert.equal(empty.nps.score, null);
  assert.equal(Object.keys(empty.averages).length, ratingFields('final').length);
  for (const value of Object.values(empty.averages)) assert.equal(value, null);

  assert.equal(summariseFeedback('final', undefined, undefined).requested, 0);

  // the mid-course form has no recommendation question
  assert.equal(npsField('midterm'), null);
  const mid = summariseFeedback(
    'midterm',
    [{ kind: 'midterm' }],
    [{ kind: 'midterm', answers: { satisfaction: 3, pace: 5 } }]
  );
  assert.equal(mid.nps, null);
  assert.equal(mid.averages.satisfaction, 3);
  assert.equal(mid.averages.pace, 5);
});

test('summariseFeedback rounds to one decimal', () => {
  const rows = [1, 2, 2].map((n) => ({ kind: 'final', answers: { teaching: n } }));
  assert.equal(summariseFeedback('final', [], rows).averages.teaching, 1.7);
});

test('labelledAverages pairs every rating question with its value', () => {
  const { averages } = summariseFeedback(
    'final',
    [],
    [{ kind: 'final', answers: { teaching: 5, materials: 4, pace: null } }]
  );
  const labelled = labelledAverages('final', averages);
  assert.equal(labelled.length, ratingFields('final').length);
  assert.equal(labelled.find((a) => a.id === 'teaching').value, 5);
  assert.equal(labelled.find((a) => a.id === 'pace').value, null);
  assert.equal(
    labelledAverages('final', averages, 'de').find((a) => a.id === 'pace').label,
    'Tempo'
  );
  assert.equal(labelledAverages('final', undefined).length, ratingFields('final').length);
  assert.equal(labelledAverages('final', undefined)[0].value, null);
});

test('summariseByKind splits requests and responses per form', () => {
  const requests = [
    { kind: 'midterm' },
    { kind: 'midterm' },
    { kind: 'final' },
    // a request from before the split carries no kind: counts as final
    { kind: null },
  ];
  const responses = [
    { kind: 'midterm', answers: { satisfaction: 4 } },
    { kind: 'final', answers: { satisfaction: 5, recommend: 9 } },
  ];
  const summary = summariseByKind(requests, responses);
  assert.deepEqual(Object.keys(summary).sort(), ['final', 'midterm']);
  assert.equal(summary.midterm.requested, 2);
  assert.equal(summary.midterm.submitted, 1);
  assert.equal(summary.midterm.nps, null);
  assert.equal(summary.final.requested, 2);
  assert.equal(summary.final.submitted, 1);
  assert.equal(summary.final.nps.score, 100);
  assert.ok(Array.isArray(summary.final.averages));
  assert.equal(summary.final.averages.find((a) => a.id === 'satisfaction').value, 5);
});

test('feedbackQuestionsForLanguage returns one language and defaults to German', () => {
  const en = feedbackQuestionsForLanguage('final', 'en');
  const flat = en.steps.flatMap((s) => s.questions);
  assert.deepEqual(en.profiles, ['language']);
  assert.equal(en.steps.length, 4);

  const satisfaction = flat.find((q) => q.id === 'satisfaction');
  assert.equal(satisfaction.label, 'Overall, how satisfied are you with the lessons?');
  assert.equal(satisfaction.maxLabel, 'very satisfied');
  assert.equal(satisfaction.required, true);

  // statements fall back to the shared poor/excellent endpoints
  assert.equal(flat.find((q) => q.id === 'pace').maxLabel, 'excellent');

  const activities = flat.find((q) => q.id === 'activities');
  assert.equal(activities.options.length, 10);
  assert.equal(activities.options.at(-1).label, 'Other');
  assert.equal(activities.other, true);
  assert.equal(activities.hint, 'Select all that apply.');
  assert.equal(activities.required, false);

  for (const lang of ['de', 'fr', undefined]) {
    const set = feedbackQuestionsForLanguage('final', lang);
    const first = set.steps[0].questions[0];
    assert.equal(first.label, 'Wie zufrieden sind Sie insgesamt mit dem Unterricht?');
    assert.equal(set.minutes, '3–5 Minuten');
  }

  const mid = feedbackQuestionsForLanguage('midterm', 'de');
  assert.equal(mid.steps.length, 4);
  assert.equal(
    mid.steps[0].questions[0].label,
    'Wie zufrieden sind Sie bisher mit dem Unterricht?'
  );
  assert.equal(mid.minutes, '3 Minuten');
});

test('optionLabel resolves stored values in both languages', () => {
  const progress = choiceFields('final').find((f) => f.id === 'progress');
  assert.equal(optionLabel(progress, 'a_lot', 'en'), 'A lot of progress');
  assert.equal(optionLabel(progress, 'a_lot', 'de'), 'Sehr grosse Fortschritte');
  // an unknown value falls back to itself rather than throwing
  assert.equal(optionLabel(progress, 'mystery'), 'mystery');
});
