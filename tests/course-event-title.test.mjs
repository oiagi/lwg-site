// Run with: node --test tests/
//
// The calendar title and the matcher that finds events by it are two halves of
// one contract: the title has to read well to a human, and it has to keep
// carrying the course code as a token sync can find. A title that stops
// matching is a course whose sessions the sync deletion pass removes, so both
// sides are pinned here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { courseEventTitle, summaryMatchesCourseCode } from '../functions/api/_calendar.js';

const CODE = '12345';

test('company course leads with the company', () => {
  assert.equal(
    courseEventTitle({
      courseCode: CODE,
      subject: 'German',
      level: 'B1.2',
      groupType: 'group',
      companyName: 'Apple',
    }),
    'Apple German B1.2 · 12345'
  );
});

test('company course with a non-display level omits it', () => {
  assert.equal(
    courseEventTitle({
      courseCode: CODE,
      subject: 'Swiss German',
      level: 'CH',
      groupType: 'group',
      companyName: 'Apple',
    }),
    'Apple Swiss German · 12345'
  );
});

test('private course leads with the student first name', () => {
  assert.equal(
    courseEventTitle({
      courseCode: '47182',
      subject: 'German',
      level: 'A2',
      groupType: 'private',
      participantName: 'Bharat',
    }),
    'Bharat German A2 · 47182'
  );
  assert.equal(
    courseEventTitle({
      courseCode: '47182',
      subject: 'Mathematics',
      level: 'SUB',
      groupType: 'private',
      participantName: 'Angelina',
    }),
    'Angelina Mathematics · 47182'
  );
});

test('group course is a class', () => {
  assert.equal(
    courseEventTitle({
      courseCode: '90341',
      subject: 'German',
      level: 'B1.2',
      groupType: 'group',
    }),
    'German B1.2 class · 90341'
  );
});

test('duo takes the group branch, not the private one', () => {
  assert.equal(
    courseEventTitle({
      courseCode: '90341',
      subject: 'German',
      level: 'B1.2',
      groupType: 'duo',
      participantName: 'Anna',
    }),
    'German B1.2 class · 90341'
  );
});

test('a company wins over a participant name', () => {
  assert.equal(
    courseEventTitle({
      courseCode: CODE,
      subject: 'German',
      level: 'A2',
      groupType: 'private',
      companyName: 'Apple',
      participantName: 'Bharat',
    }),
    'Apple German A2 · 12345'
  );
});

test('bookkeeping levels are left out', () => {
  for (const level of ['CH', 'SUB', 'XX', '', null, undefined, 'ch', 'XX']) {
    const title = courseEventTitle({
      courseCode: CODE,
      subject: 'German',
      level,
      groupType: 'group',
    });
    assert.equal(title, 'German class · 12345', `level ${JSON.stringify(level)}`);
  }
});

test('levels are normalised to upper case, suffixes intact', () => {
  const title = (level) =>
    courseEventTitle({ courseCode: CODE, subject: 'German', level, groupType: 'group' });
  assert.equal(title('b1.2'), 'German B1.2 class · 12345');
  assert.equal(title('a1+'), 'German A1+ class · 12345');
});

test('no title carries a comma', () => {
  const cases = [
    { subject: 'German', level: 'B1.2', groupType: 'group', companyName: 'Apple' },
    { subject: 'Mathematics', level: 'SUB', groupType: 'private', participantName: 'Angelina' },
    { subject: 'Swiss German', level: 'CH', groupType: 'duo' },
    { subject: 'English', level: 'C1', groupType: 'group' },
  ];
  for (const c of cases) {
    const title = courseEventTitle({ courseCode: CODE, ...c });
    assert.equal(title.includes(','), false, title);
  }
});

test('the separator cannot be forged from a company name', () => {
  const title = courseEventTitle({
    courseCode: CODE,
    subject: 'German',
    level: 'B1',
    groupType: 'group',
    companyName: 'A · B',
  });
  assert.equal(title, 'A B German B1 · 12345');
  assert.equal(title.split('·').length, 2);
});

test('null when there is nothing descriptive to say', () => {
  assert.equal(courseEventTitle({ courseCode: CODE, groupType: 'group' }), null);
  assert.equal(courseEventTitle({ courseCode: CODE, level: 'XX', groupType: 'group' }), null);
  assert.equal(courseEventTitle({ courseCode: CODE, groupType: 'private' }), null);
  assert.equal(courseEventTitle({ courseCode: '', subject: 'German', groupType: 'group' }), null);
});

test('a lone subject or a lone level still earns a title', () => {
  assert.equal(
    courseEventTitle({ courseCode: CODE, subject: 'German', groupType: 'group' }),
    'German class · 12345'
  );
  assert.equal(
    courseEventTitle({ courseCode: CODE, level: 'B1', groupType: 'group' }),
    'B1 class · 12345'
  );
});

test('summaryMatchesCourseCode accepts the code in either position', () => {
  // Old format, still on every event created before the rename.
  assert.equal(summaryMatchesCourseCode('12345 — Anna <> Gioia', '12345'), true);
  // New format.
  assert.equal(summaryMatchesCourseCode('German B1.2 class · 12345', '12345'), true);
  assert.equal(summaryMatchesCourseCode('Apple German B1.2 · 12345', '12345'), true);
  // Legacy hyphenated codes must not be read as a regex.
  assert.equal(summaryMatchesCourseCode('P-A1-001 — Anna', 'P-A1-001'), true);
  assert.equal(summaryMatchesCourseCode('German B1 class · P-A1-001', 'P-A1-001'), true);
  // A code the teacher typed mid-sentence on a hand-made session.
  assert.equal(summaryMatchesCourseCode('moved lesson 12345 (catch-up)', '12345'), true);
});

test('summaryMatchesCourseCode requires whole-token boundaries', () => {
  assert.equal(summaryMatchesCourseCode('123456 — Anna', '12345'), false);
  assert.equal(summaryMatchesCourseCode('German class · 123456', '12345'), false);
  assert.equal(summaryMatchesCourseCode('X12345 class', '12345'), false);
  assert.equal(summaryMatchesCourseCode('12345x', '12345'), false);
  assert.equal(summaryMatchesCourseCode('', '12345'), false);
  assert.equal(summaryMatchesCourseCode('12345', ''), false);
  assert.equal(summaryMatchesCourseCode(undefined, '12345'), false);
});
