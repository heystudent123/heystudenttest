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

// contentHash / stemHash are kept for lookups and repair scripts only —
// duplicates across (and within) banks are allowed.
QuestionSchema.index({ contentHash: 1 });
QuestionSchema.index({ stemHash: 1 });
QuestionSchema.index({ chapter: 1, createdAt: -1 });
QuestionSchema.index({ bankId: 1, createdAt: -1 });

const Question = mongoose.model('Question', QuestionSchema);

let contentHashIndexReady = false;
Question.ensureNonUniqueContentHash = async function ensureNonUniqueContentHash() {
  if (contentHashIndexReady) return;
  contentHashIndexReady = true;
  try {
    const indexes = await Question.collection.indexes();
    const uniqueHash = indexes.find((index) => index.name === 'contentHash_1' && index.unique);
    if (uniqueHash) {
      await Question.collection.dropIndex('contentHash_1');
      await Question.collection.createIndex({ contentHash: 1 });
    }
  } catch (_) {
    // Index may already be non-unique, or the collection may not exist yet.
  }
};

module.exports = Question;
