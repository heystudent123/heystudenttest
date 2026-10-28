const mongoose = require('mongoose');

const QuestionSchema = new mongoose.Schema({
  bankId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'QuestionBank',
    required: true,
  },
  question: {
    type: String,
    required: [true, 'Question text is required'],
    trim: true,
    maxlength: 4000,
  },
  optionA: { type: String, required: true, trim: true, maxlength: 1000 },
  optionB: { type: String, required: true, trim: true, maxlength: 1000 },
  optionC: { type: String, required: true, trim: true, maxlength: 1000 },
  optionD: { type: String, required: true, trim: true, maxlength: 1000 },
  correctAnswer: {
    type: String,
    required: true,
    enum: ['A', 'B', 'C', 'D'],
  },
  chapter: { type: String, trim: true, default: '', maxlength: 200 },
  remarks: { type: String, trim: true, default: '', maxlength: 2000 },
  contentHash: { type: String, required: true },
  stemHash: { type: String, required: true },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EmailUser',
    required: true,
  },
}, { timestamps: true });

QuestionSchema.index({ contentHash: 1 }, { unique: true });
QuestionSchema.index({ stemHash: 1 });
QuestionSchema.index({ chapter: 1, createdAt: -1 });
QuestionSchema.index({ bankId: 1, createdAt: -1 });

module.exports = mongoose.model('Question', QuestionSchema);
