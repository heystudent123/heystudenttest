const mongoose = require('mongoose');

const CouponRedemptionSchema = new mongoose.Schema({
  couponId: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'EmailUser', required: true },
  paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', required: true },
}, { timestamps: true });

CouponRedemptionSchema.index({ paymentId: 1 }, { unique: true });
CouponRedemptionSchema.index({ couponId: 1, userId: 1 });

module.exports = mongoose.model('CouponRedemption', CouponRedemptionSchema);
