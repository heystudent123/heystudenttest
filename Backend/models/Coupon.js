const mongoose = require('mongoose');

const CouponSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  discountType: { type: String, enum: ['percent', 'flat'], required: true },
  discountValue: { type: Number, required: true, min: 0 },
  courseIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
  planIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Plan' }],
  mockTestIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'MockTest' }],
  expiresAt: { type: Date, required: true },
  maxUsesPerUser: { type: Number, required: true, min: 1, max: 100, default: 1 },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'EmailUser' },
}, { timestamps: true });

module.exports = mongoose.model('Coupon', CouponSchema);
