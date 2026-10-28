const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const EmailUser = require('../models/EmailUser');
const Question = require('../models/Question');
const QuestionBank = require('../models/QuestionBank');
const MockTest = require('../models/MockTest');
const { contentHash, stemHash } = require('../utils/questionImport');

const TITLE = 'HeyStudent English Practice Test';

const QUESTIONS = [
  ['Choose the word closest in meaning to "brief".', 'Short', 'Angry', 'Late', 'Heavy', 'A', 'Vocabulary', ''],
  ['Choose the antonym of "ancient".', 'Old', 'Modern', 'Rare', 'Quiet', 'B', 'Vocabulary', ''],
  ['Select the correctly spelled word.', 'Recieve', 'Receive', 'Receeve', 'Receve', 'B', 'Spelling', ''],
  ['Fill in the blank: The jury ___ divided in its opinion.', 'is', 'are', 'were', 'have', 'C', 'Grammar', ''],
  ['A person who writes dictionaries is a ___.', 'Biographer', 'Lexicographer', 'Publisher', 'Novelist', 'B', 'One word', ''],
  ['"Once in a blue moon" means ___.', 'Every night', 'Very rarely', 'At sunrise', 'During exams', 'B', 'Idioms', ''],
  ['Choose the best replacement: "She do her homework daily."', 'She does her homework daily.', 'She doing her homework daily.', 'She did her homework tomorrow.', 'She done her homework daily.', 'A', 'Sentence correction', ''],
  ['Read: "The library closes at dusk, but the reading room stays open for one more hour." When does the reading room close?', 'At dawn', 'At dusk', 'One hour after dusk', 'At midnight', 'C', 'Reading', ''],
  ['Which pair has the same relationship as "author : book"?', 'Chef : recipe', 'Singer : stage', 'Driver : road', 'Teacher : chalk', 'A', 'Analogy', ''],
  ['Choose the correct sentence.', 'Neither of the answers are correct.', 'Neither of the answers is correct.', 'Neither of the answer is correct.', 'Neither of the answers were correct.', 'B', 'Grammar', ''],
];

async function upsertQuestion(row, userId, bankId) {
  const [question, optionA, optionB, optionC, optionD, correctAnswer, chapter, remarks] = row;
  const options = [optionA, optionB, optionC, optionD];
  const hash = contentHash(question, options, correctAnswer);
  const stem = stemHash(question, options);
  const existing = await Question.findOne({ contentHash: hash });
  if (existing) return existing;
  return Question.create({
    bankId,
    question,
    optionA,
    optionB,
    optionC,
    optionD,
    correctAnswer,
    chapter,
    remarks,
    contentHash: hash,
    stemHash: stem,
    createdBy: userId,
  });
}

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is missing. Add it to Backend/.env and run npm run seed-mock-test.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const owner = await EmailUser.findOne({ role: 'admin' }) || await EmailUser.findOne();
  if (!owner) {
    console.error('No user exists yet. Sign in once so an EmailUser is created, then run this script again.');
    process.exit(1);
  }

  let bank = await QuestionBank.findOne({ title: 'General' });
  if (!bank) bank = await QuestionBank.create({ title: 'General', description: 'Default bank for existing questions.', createdBy: owner._id });

  const questions = [];
  for (const row of QUESTIONS) {
    questions.push(await upsertQuestion(row, owner._id, bank._id));
  }

  const snapshot = questions.map((question, index) => ({
    questionId: question._id,
    order: index + 1,
    question: question.question,
    optionA: question.optionA,
    optionB: question.optionB,
    optionC: question.optionC,
    optionD: question.optionD,
    correctAnswer: question.correctAnswer,
    chapter: question.chapter,
    remarks: question.remarks,
  }));

  const payload = {
    title: TITLE,
    description: 'A 10-question English practice paper with negative marking.',
    instructions: 'The test opens in full screen. Leaving full screen or switching away ends the test. Each correct answer scores 5 marks. Each wrong answer deducts 1 mark. Unanswered questions score 0.',
    category: 'CUET',
    chapter: 'English',
    durationMinutes: 15,
    positiveMarks: 5,
    negativeMarks: 1,
    maxMarks: 50,
    isFree: true,
    price: 0,
    attemptLimit: 5,
    status: 'published',
    shuffleQuestions: false,
    shuffleOptions: false,
    questionIds: questions.map((question) => question._id),
    publishedSnapshot: snapshot,
    publishedAt: new Date(),
    createdBy: owner._id,
  };

  const existing = await MockTest.findOne({ title: TITLE });
  if (existing) {
    existing.set(payload);
    existing.snapshotVersion = (existing.snapshotVersion || 0) + 1;
    await existing.save();
    console.log(`Updated published test ${existing._id} with ${snapshot.length} questions.`);
  } else {
    const created = await MockTest.create({ ...payload, snapshotVersion: 1 });
    console.log(`Published test ${created._id} with ${snapshot.length} questions.`);
  }

  const paidSeeds = [
    { title: 'CUET Economics Mock Test', chapter: 'Economics', price: 99 },
    { title: 'CUET Accountancy Mock Test', chapter: 'Accountancy', price: 149 },
    { title: 'CUET Business Studies Mock Test', chapter: 'Business Studies', price: 199 },
  ];
  for (const item of paidSeeds) {
    const paidPayload = {
      ...payload,
      title: item.title,
      chapter: item.chapter,
      description: 'Development seed for reviewing paid mock tests. Not a live exam paper.',
      isFree: false,
      price: item.price,
      attemptLimit: 3,
    };
    const paid = await MockTest.findOne({ title: item.title });
    if (paid) {
      paid.set(paidPayload);
      paid.snapshotVersion = (paid.snapshotVersion || 0) + 1;
      await paid.save();
      console.log(`Updated paid seed ${paid._id} (${item.chapter}, ₹${item.price}).`);
    } else {
      const created = await MockTest.create({ ...paidPayload, snapshotVersion: 1 });
      console.log(`Published paid seed ${created._id} (${item.chapter}, ₹${item.price}).`);
    }
  }

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
