const EmailUser = require('../models/EmailUser');
const Referral = require('../models/Referral');
const Payment = require('../models/Payment');
const ReferralReward = require('../models/ReferralReward');
const ReferralRewardSetting = require('../models/ReferralRewardSetting');
const ErrorResponse = require('../utils/errorResponse');

// @desc    Validate referral code
// @route   GET /api/referrals/validate/:code
// @access  Public
exports.validateReferralCode = async (req, res, next) => {
  try {
    const { code } = req.params;
    
    // Check if code exists
    const referrer = await EmailUser.findOne({ referralCode: code });
    
    if (!referrer) {
      return next(new ErrorResponse('Invalid referral code', 404));
    }
    
    res.status(200).json({
      success: true,
      data: {
        valid: true,
        referrer: {
          name: referrer.name,
          college: referrer.college
        }
      }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get user's referral info
// @route   GET /api/referrals/my-code
// @access  Private
exports.getMyReferralCode = async (req, res, next) => {
  try {
    const user = await EmailUser.findById(req.user.id);
    const noteField = user.role === 'institute' ? 'notes.referralCode' : 'notes.studentReferralCode';
    const [setting, pending, paidReferralCount] = await Promise.all([
      ReferralRewardSetting.findOne({ key: 'student' }).select('discountPercent').lean(),
      ReferralReward.find({ referrerId: user._id, status: { $in: ['available', 'reserved'] } }).sort({ createdAt: 1 }).select('percent').lean(),
      user.referralCode
        ? Payment.countDocuments({ status: 'paid', [noteField]: user.referralCode })
        : 0,
    ]);
    const isStudent = user.role === 'student';

    res.status(200).json({
      success: true,
      data: {
        referralCode: user.referralCode,
        referralsCount: paidReferralCount,
        rewardPerUse: isStudent ? (Number(setting?.discountPercent) || 0) : 0,
        pendingDiscount: isStudent ? (Number(pending[0]?.percent) || 0) : 0,
        pendingCount: isStudent ? pending.length : 0,
      }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get users who used my referral code
// @route   GET /api/referrals/referred-users
// @access  Private (institute)
exports.getReferredUsers = async (req, res, next) => {
  try {
    const me = await EmailUser.findById(req.user.id);

    if (!me || !me.referralCode) {
      return res.status(200).json({
        success: true,
        count: 0,
        pagination: {},
        data: []
      });
    }

    const normalizedCode = String(me.referralCode || '').trim().toUpperCase();
    const noteField = me.role === 'student' ? 'notes.studentReferralCode' : 'notes.referralCode';
    const count = await Payment.countDocuments({ status: 'paid', [noteField]: normalizedCode });

    res.status(200).json({
      success: true,
      count,
      pagination: {},
      data: []
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get who referred me
// @route   GET /api/referrals/my-referrer
// @access  Private
exports.getMyReferrer = async (req, res, next) => {
  try {
    const user = await EmailUser.findById(req.user.id).populate('referredBy', 'name email college');
    
    if (!user.referredBy) {
      return res.status(200).json({
        success: true,
        data: null,
        message: 'You were not referred by anyone'
      });
    }
    
    res.status(200).json({
      success: true,
      data: user.referredBy
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Generate new referral code (if needed)
// @route   POST /api/referrals/generate-code
// @access  Private
exports.generateNewReferralCode = async (req, res, next) => {
  try {
    const user = await EmailUser.findById(req.user.id);
    
    // Generate new referral code
    const namePrefix = user.name.substring(0, 4).toUpperCase();
    const randomChars = require('crypto').randomBytes(2).toString('hex').toUpperCase();
    user.referralCode = `${namePrefix}${randomChars}`;
    
    await user.save();
    
    res.status(200).json({
      success: true,
      data: {
        referralCode: user.referralCode
      }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Verify referral code
// @route   GET /api/referrals/verify/:code
// @access  Public
exports.verifyReferralCode = async (req, res, next) => {
  try {
    const { code } = req.params;
    
    // Check if code exists and belongs to an institute
    const institute = await EmailUser.findOne({ 
      referralCode: code,
      role: 'institute'
    });
    
    if (!institute) {
      return next(new ErrorResponse('Invalid referral code', 404));
    }
    
    res.status(200).json({
      success: true,
      data: {
        valid: true,
        institute: {
          name: institute.name,
          _id: institute._id
        }
      }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get all referrals
// @route   GET /api/referrals
// @access  Private/Admin
exports.getReferrals = async (req, res, next) => {
  try {
    const referrals = await Referral.find()
      .populate('referrer', 'name email role')
      .populate('referred', 'name email mobile college course year');
    
    res.status(200).json({
      success: true,
      count: referrals.length,
      data: referrals
    });
  } catch (err) {
    next(err);
  }
}; 