const mongoose = require('mongoose');

const ReferralRewardSettingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, default: 'student' },
  discountPercent: { type: Number, default: 0, min: 0, max: 100 },
  instituteDiscountPercent: { type: Number, default: 0, min: 0, max: 100 },
}, { timestamps: true });

module.exports = mongoose.model('ReferralRewardSetting', ReferralRewardSettingSchema);
