const mongoose = require('mongoose');

const snapshotSchema = new mongoose.Schema({
  questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
  order: { type: Number, required: true },
  question: { type: String, required: true },
  optionA: { type: String, required: true },
  optionB: { type: String, required: true },
  optionC: { type: String, required: true },
  optionD: { type: String, required: true },
  correctAnswer: { type: String, enum: ['A', 'B', 'C', 'D'], required: true },
  chapter: { type: String, default: '' },
  remarks: { type: String, default: '' },
}, { _id: false });

const MockTestSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, trim: true, default: '', maxlength: 2000 },
  instructions: { type: String, trim: true, default: '', maxlength: 5000 },
  category: { type: String, trim: true, default: 'General', maxlength: 100 },
  chapter: { type: String, trim: true, default: '', maxlength: 200 },
  durationMinutes: { type: Number, required: true, min: 1, max: 300 },
  positiveMarks: { type: Number, required: true, min: 0, max: 100, default: 1 },
  negativeMarks: { type: Number, required: true, min: 0, max: 100, default: 0 },
  maxMarks: { type: Number, required: true, min: 0, default: 0 },
  isFree: { type: Boolean, default: true },
  price: { type: Number, default: 0, min: 0 },
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', default: null },
  attemptLimit: { type: Number, default: 1, min: 0, max: 20 },
  status: {
    type: String,
    enum: ['draft', 'published', 'unpublished'],
    default: 'draft',
  },
  availableFrom: { type: Date, default: null },
  availableUntil: { type: Date, default: null },
  shuffleQuestions: { type: Boolean, default: false },
  shuffleOptions: { type: Boolean, default: false },
  questionBankId: { type: mongoose.Schema.Types.ObjectId, ref: 'QuestionBank', default: null },
  questionIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }],
  // Frozen copy written at publish time. Later edits to the question bank do not change it.
  publishedSnapshot: [snapshotSchema],
  snapshotVersion: { type: Number, default: 0 },
  publishedAt: { type: Date, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'EmailUser', required: true },
}, { timestamps: true });

MockTestSchema.index({ status: 1, createdAt: -1 });
MockTestSchema.index({ questionIds: 1 });
MockTestSchema.index({ 'publishedSnapshot.questionId': 1 });

module.exports = mongoose.model('MockTest', MockTestSchema);
