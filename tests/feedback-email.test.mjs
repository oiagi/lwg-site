// Run with: node --test tests/
// Covers the mid-course and end-of-course feedback request emails in
// functions/api/_feedback-email.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFeedbackEmail,
  courseLabel,
  feedbackEmailCopy,
} from '../functions/api/_feedback-email.js';
import { FEEDBACK_KINDS } from '../functions/api/_feedback.js';

const course = { course_code: 'LWG-2026-14', subject: 'German', level: 'B1' };
const URL = 'https://learningwithgioia.ch/de/feedback?token=abc&lang=de';

const INFORMAL_DE = /\b(du|dich|dir|dein|deine|deinen|deinem|deiner|hast|bist|magst)\b/i;

test('courseLabel names subject, level and code in either language', () => {
  assert.equal(courseLabel(course, 'de'), 'Deutsch B1 Kurs LWG-2026-14');
  assert.equal(courseLabel(course, 'en'), 'German B1 course LWG-2026-14');
  assert.equal(courseLabel({}, 'de'), 'Kurs');
});

for (const kind of FEEDBACK_KINDS) {
  for (const language of ['de', 'en']) {
    test(`${kind}/${language}: the email is anonymous, formal and complete`, () => {
      const copy = feedbackEmailCopy(kind, language, course);
      const { subject, html } = buildFeedbackEmail({ kind, course, feedbackUrl: URL, language });

      assert.equal(subject, copy.subject);
      assert.ok(subject.includes('(LWG-2026-14)'));
      assert.ok(html.includes(`<html lang="${language}">`));
      assert.ok(html.includes(copy.intro));
      assert.ok(html.includes(copy.note));
      assert.ok(
        html.includes('href="https://learningwithgioia.ch/de/feedback?token=abc&amp;lang=de"')
      );

      // Says it is anonymous, never says there are no wrong answers.
      assert.match(copy.intro, language === 'de' ? /anonym/ : /anonymous/);
      assert.doesNotMatch(html, /richtigen oder falschen/);
      assert.doesNotMatch(html, /right or wrong/);
      // No personal greeting: the survey is anonymous.
      assert.doesNotMatch(copy.greeting, /\{|Anna/);

      if (language === 'de') {
        for (const text of Object.values(copy)) {
          assert.doesNotMatch(text, INFORMAL_DE, text);
          assert.doesNotMatch(text, /ß/, text);
        }
        assert.match(copy.intro, /\bSie\b|\bIhr/);
      }
    });
  }
}

test('each kind has its own subject and framing', () => {
  assert.equal(
    feedbackEmailCopy('final', 'de', course).subject,
    'Wie war Ihr Kurs? (LWG-2026-14) — learning with gioia'
  );
  assert.equal(
    feedbackEmailCopy('midterm', 'de', course).subject,
    'Wie läuft Ihr Kurs? (LWG-2026-14) — learning with gioia'
  );
  assert.equal(
    feedbackEmailCopy('final', 'en', {}).subject,
    'How was your course? — learning with gioia'
  );
  assert.equal(
    feedbackEmailCopy('midterm', 'en', {}).subject,
    'How is your course going? — learning with gioia'
  );
  assert.match(feedbackEmailCopy('midterm', 'de', course).intro, /zur Hälfte/);
  assert.match(feedbackEmailCopy('midterm', 'en', course).intro, /halfway/);
  assert.throws(() => feedbackEmailCopy('weekly', 'de'), /Unknown feedback kind/);
});

test('an unknown language falls back to German', () => {
  const { subject } = buildFeedbackEmail({
    kind: 'final',
    course,
    feedbackUrl: URL,
    language: 'fr',
  });
  assert.match(subject, /^Wie war Ihr Kurs\?/);
});
