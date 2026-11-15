const mongoose = require('mongoose');

const BundleSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 160 },
  description: { type: String, trim: true, default: '', maxlength: 2000 },
  mockTestIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'MockTest' }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'EmailUser', required: true },
}, { timestamps: true });

BundleSchema.index({ updatedAt: -1 });

module.exports = mongoose.model('Bundle', BundleSchema);
