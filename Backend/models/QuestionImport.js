const mongoose = require('mongoose');

const rowSchema = new mongoose.Schema({
  rowNumber: Number,
  question: String,
  optionA: String,
  optionB: String,
  optionC: String,
  optionD: String,
  correctAnswer: String,
  chapter: String,
  remarks: String,
  contentHash: String,
  stemHash: String,
  errors: [String],
}, { _id: false });

const QuestionImportSchema = new mongoose.Schema({
  bankId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'QuestionBank',
    required: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EmailUser',
    required: true,
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EmailUser',
  },
  fileName: { type: String, default: '' },
  status: {
    type: String,
    enum: ['pending', 'importing', 'imported'],
    default: 'pending',
  },
  validRows: [rowSchema],
  invalidRows: [rowSchema],
  skippedEmpty: { type: Number, default: 0 },
  result: {
    inserted: { type: Number, default: 0 },
    skippedDuplicates: { type: Number, default: 0 },
    rejected: { type: Number, default: 0 },
  },
  expiresAt: { type: Date },
}, { timestamps: true });

QuestionImportSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('QuestionImport', QuestionImportSchema);
