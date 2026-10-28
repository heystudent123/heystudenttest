const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question' },
  order: { type: Number, required: true },
  question: { type: String, required: true },
  optionA: { type: String, required: true },
  optionB: { type: String, required: true },
  optionC: { type: String, required: true },
  optionD: { type: String, required: true },
  correctAnswer: { type: String, enum: ['A', 'B', 'C', 'D'], required: true },
  chapter: { type: String, default: '' },
}, { _id: false });

const responseSchema = new mongoose.Schema({
  order: { type: Number, required: true },
  selected: { type: String, enum: ['A', 'B', 'C', 'D', null], default: null },
  markedForReview: { type: Boolean, default: false },
  visited: { type: Boolean, default: false },
}, { _id: false });

const reviewSchema = new mongoose.Schema({
  order: Number,
  question: String,
  optionA: String,
  optionB: String,
  optionC: String,
  optionD: String,
  chapter: String,
  selected: String,
  correctAnswer: String,
  outcome: { type: String, enum: ['correct', 'incorrect', 'unanswered'] },
  marksAwarded: Number,
}, { _id: false });

const TestAttemptSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'EmailUser', required: true },
  mockTestId: { type: mongoose.Schema.Types.ObjectId, ref: 'MockTest', required: true },
  testTitle: { type: String, required: true },
  subject: { type: String, default: '' },
  attemptNumber: { type: Number, required: true },
  // Admin "try this test" runs — never shown in attempt history, never counted
  // against attemptLimit, auto-deleted shortly after they finish.
  isPreview: { type: Boolean, default: false },
  expiresAt: { type: Date, default: null },
  status: {
    type: String,
    enum: ['in_progress', 'paused', 'submitted', 'auto_submitted'],
    default: 'in_progress',
  },
  endReason: {
    type: String,
    enum: ['manual', 'timeout', 'left_screen', null],
    default: null,
  },
  startedAt: { type: Date, required: true },
  deadlineAt: { type: Date, required: true },
  pausedAt: { type: Date, default: null },
  submittedAt: { type: Date, default: null },
  positiveMarks: { type: Number, required: true },
  negativeMarks: { type: Number, required: true },
  durationMinutes: { type: Number, required: true },
  questions: [questionSchema],
  responses: [responseSchema],
  result: {
    totalQuestions: Number,
    attempted: Number,
    correct: Number,
    incorrect: Number,
    unanswered: Number,
    score: Number,
    maxMarks: Number,
    percentage: Number,
    accuracy: Number,
    timeTakenSeconds: Number,
    review: [reviewSchema],
  },
}, { timestamps: true });

TestAttemptSchema.index({ userId: 1, mockTestId: 1, status: 1 });
TestAttemptSchema.index({ userId: 1, createdAt: -1 });
TestAttemptSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('TestAttempt', TestAttemptSchema);
