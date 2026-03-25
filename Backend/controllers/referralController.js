const EmailUser = require('../models/EmailUser');
const Referral = require('../models/Referral');
const Payment = require('../models/Payment');
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
    
    res.status(200).json({
      success: true,
      data: {
        referralCode: user.referralCode,
        referralsCount: user.referrals.length
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

    const { phone, page = 1, limit = 10 } = req.query;
    const pageNum  = parseInt(page,  10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const skip = (pageNum - 1) * limitNum;

    const normalizedCode = String(me.referralCode || '').trim();

    // Primary source: explicit user attribution.
    const directUserIds = await EmailUser.find({ referrerCodeUsed: normalizedCode })
      .select('_id')
      .lean();

    // Fallback source: historical paid payments carrying referralCode in notes.
    // Keep this fault-tolerant so payment query issues never break institute dashboard.
    let paymentUserIds = [];
    try {
      const fromNotes = await Payment.find({
        status: 'paid',
        'notes.referralCode': normalizedCode,
      }).distinct('userId');
      paymentUserIds = Array.isArray(fromNotes) ? fromNotes : [];
    } catch (paymentErr) {
      console.warn('Referral fallback query failed:', paymentErr.message);
      paymentUserIds = [];
    }

    const mergedIds = Array.from(new Set([
      ...directUserIds
        .map((u) => u?._id)
        .filter(Boolean)
        .map((id) => id.toString()),
      ...paymentUserIds
        .filter(Boolean)
        .map((id) => id.toString()),
    ]));

    if (!mergedIds.length) {
      return res.status(200).json({
        success: true,
        count: 0,
        pagination: {},
        data: []
      });
    }

    const filter = { _id: { $in: mergedIds } };
    if (phone) {
      filter.phone = { $regex: phone, $options: 'i' };
    }

    const [total, users] = await Promise.all([
      EmailUser.countDocuments(filter),
      EmailUser.find(filter)
        .select('name phone email college year createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean()
    ]);

    const pagination = {};
    if (skip + limitNum < total) {
      pagination.next = { page: pageNum + 1, limit: limitNum };
    }
    if (pageNum > 1) {
      pagination.prev = { page: pageNum - 1, limit: limitNum };
    }

    res.status(200).json({
      success: true,
      count: total,
      pagination,
      data: users
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