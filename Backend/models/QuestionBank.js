const mongoose = require('mongoose');

const QuestionBankSchema = new mongoose.Schema({
  title: { type: String, required: [true, 'Bank title is required'], trim: true, maxlength: 200 },
  description: { type: String, trim: true, default: '', maxlength: 1000 },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EmailUser',
    required: true,
  },
}, { timestamps: true });

QuestionBankSchema.index({ createdAt: -1 });

module.exports = mongoose.model('QuestionBank', QuestionBankSchema);
