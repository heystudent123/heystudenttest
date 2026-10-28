const test = require('node:test');
const assert = require('node:assert/strict');
const { subjectLabel, toCatalogCard } = require('../utils/mockTestCatalog');

test('subject prefers chapter, then category', () => {
  assert.equal(subjectLabel({ chapter: ' English ', category: 'CUET' }), 'English');
  assert.equal(subjectLabel({ chapter: '', category: 'Economics' }), 'Economics');
  assert.equal(subjectLabel({}), 'General');
});

test('catalogue cards count questions and omit stems, options, and answers', () => {
  const card = toCatalogCard({
    _id: 'abc',
    title: 'CUET English Mock 1',
    description: 'Practice paper',
    chapter: 'English',
    category: 'CUET',
    durationMinutes: 60,
    maxMarks: 200,
    isFree: false,
    price: 99,
    attemptLimit: 2,
    publishedSnapshot: [
      { question: 'Secret stem', optionA: 'A', correctAnswer: 'B' },
      { question: 'Another stem', optionA: 'A', correctAnswer: 'C' },
    ],
  }, { hasAccess: false, attemptsUsed: 1, inProgressAttemptId: null });

  assert.equal(card.subject, 'English');
  assert.equal(card.questionCount, 2);
  assert.equal(card.price, 99);
  assert.equal(card.isFree, false);
  assert.equal(card.hasAccess, false);
  assert.equal(card.attemptsUsed, 1);
  assert.equal('publishedSnapshot' in card, false);
  assert.equal('correctAnswer' in card, false);
  assert.equal('question' in card, false);
  assert.equal(JSON.stringify(card).includes('Secret stem'), false);
});

test('free cards report a zero price', () => {
  const card = toCatalogCard({
    _id: 'free',
    title: 'Free paper',
    chapter: 'History',
    durationMinutes: 15,
    maxMarks: 50,
    isFree: true,
    price: 250,
    attemptLimit: 1,
    publishedSnapshot: [],
  }, { hasAccess: true });
  assert.equal(card.price, 0);
  assert.equal(card.hasAccess, true);
});
