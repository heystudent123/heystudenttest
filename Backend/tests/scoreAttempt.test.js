const test = require('node:test');
const assert = require('node:assert/strict');
const { scoreAttempt } = require('../utils/scoreAttempt');

const questions = [
  { order: 1, question: 'One', optionA: 'A', optionB: 'B', optionC: 'C', optionD: 'D', correctAnswer: 'A' },
  { order: 2, question: 'Two', optionA: 'A', optionB: 'B', optionC: 'C', optionD: 'D', correctAnswer: 'B' },
  { order: 3, question: 'Three', optionA: 'A', optionB: 'B', optionC: 'C', optionD: 'D', correctAnswer: 'C' },
];

test('correct, wrong, and blank answers produce marks, accuracy, and time', () => {
  const result = scoreAttempt({
    questions,
    responses: [
      { order: 1, selected: 'A' },
      { order: 2, selected: 'D' },
    ],
    positiveMarks: 5,
    negativeMarks: 1,
    startedAt: '2026-10-20T10:00:00.000Z',
    submittedAt: '2026-10-20T10:03:30.000Z',
  });

  assert.equal(result.correct, 1);
  assert.equal(result.incorrect, 1);
  assert.equal(result.unanswered, 1);
  assert.equal(result.attempted, 2);
  assert.equal(result.score, 4);
  assert.equal(result.maxMarks, 15);
  assert.equal(result.accuracy, 50);
  assert.equal(result.timeTakenSeconds, 210);
  assert.equal(result.review[2].outcome, 'unanswered');
  assert.equal(result.review[2].correctAnswer, 'C');
});

test('accuracy is zero when nothing was attempted', () => {
  const result = scoreAttempt({
    questions: questions.slice(0, 1),
    responses: [],
    positiveMarks: 5,
    negativeMarks: 1,
    startedAt: '2026-10-20T10:00:00.000Z',
    submittedAt: '2026-10-20T10:00:05.000Z',
  });
  assert.equal(result.accuracy, 0);
  assert.equal(result.score, 0);
});
