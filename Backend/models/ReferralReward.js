const mongoose = require('mongoose');

const ReferralRewardSchema = new mongoose.Schema({
  referrerId: { type: mongoose.Schema.Types.ObjectId, ref: 'EmailUser', required: true },
  percent: { type: Number, default: 0, min: 0, max: 100 },
  amount: { type: Number, default: 0, min: 0 },
  earnedFromPaymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', required: true },
  earnedFromUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'EmailUser', default: null },
  status: { type: String, enum: ['available', 'reserved', 'used'], default: 'available' },
  reservedPaymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', default: null },
  usedPaymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', default: null },
}, { timestamps: true });

ReferralRewardSchema.index({ earnedFromPaymentId: 1 }, { unique: true });
ReferralRewardSchema.index({ referrerId: 1, status: 1, createdAt: 1 });

module.exports = mongoose.model('ReferralReward', ReferralRewardSchema);
