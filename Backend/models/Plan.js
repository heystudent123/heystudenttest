const mongoose = require('mongoose');

const PlanSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 160 },
  description: { type: String, trim: true, default: '', maxlength: 2000 },
  price: { type: Number, required: true, min: 1 },
  status: {
    type: String,
    enum: ['draft', 'published', 'unpublished'],
    default: 'draft',
  },
  mockTestIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'MockTest' }],
  courseIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'EmailUser', required: true },
}, { timestamps: true });

PlanSchema.index({ status: 1, updatedAt: -1 });

module.exports = mongoose.model('Plan', PlanSchema);
