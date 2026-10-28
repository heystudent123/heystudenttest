const EmailUser = require('../models/EmailUser');
const Alumni = require('../models/Alumni');
const Accommodation = require('../models/Accommodation');
const Referral = require('../models/Referral');
const PrePaymentLead = require('../models/PrePaymentLead');
const ReferralRewardSetting = require('../models/ReferralRewardSetting');
const ErrorResponse = require('../utils/errorResponse');
const { parseRewardPercent } = require('../utils/referralReward');
const { sanitizeStr, isValidEmail, isNonEmpty } = require('../middleware/validate');

// @desc    Admin login
// @route   POST /api/admin/login
// @access  Public
exports.adminLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validate presence
    if (!email || !password) {
      return next(new ErrorResponse('Please provide an email and password', 400));
    }

    // Sanitize inputs
    const cleanEmail = sanitizeStr(email).toLowerCase();
    const cleanPassword = sanitizeStr(password);

    // Validate email format
    if (!isValidEmail(cleanEmail)) {
      return next(new ErrorResponse('Please provide a valid email address', 400));
    }

    // Validate password is non-empty after sanitisation
    if (!isNonEmpty(cleanPassword)) {
      return next(new ErrorResponse('Please provide a password', 400));
    }

    // Check for admin user
    const admin = await EmailUser.findOne({ email: cleanEmail, role: 'admin' }).select('+password');

    if (!admin) {
      return next(new ErrorResponse('Invalid admin credentials', 401));
    }

    // Check if password matches
    const isMatch = await admin.matchPassword(cleanPassword);

    if (!isMatch) {
      return next(new ErrorResponse('Invalid credentials', 401));
    }

    // Generate JWT Token
    const token = admin.getSignedJwtToken();

    res.status(200).json({
      success: true,
      token,
      data: {
        _id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role
      }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get admin dashboard stats
// @route   GET /api/admin/dashboard
// @access  Private/Admin
exports.getDashboardStats = async (req, res, next) => {
  try {
    const userCount = await EmailUser.countDocuments({ role: 'student' });
    const alumniCount = await Alumni.countDocuments();
    const accommodationCount = await Accommodation.countDocuments();
    const referralCount = await Referral.countDocuments();
    
    // Get recent users (last 5)
    const recentUsers = await EmailUser.find({ role: 'student' })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name email phone createdAt');
    
    // Get recent accommodations (last 5)
    const recentAccommodations = await Accommodation.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name type address.area rent createdAt');
    
    // Get referral statistics
    const topReferrers = await EmailUser.aggregate([
      { $match: { role: 'student' } },
      { $project: { name: 1, email: 1, referralCount: { $size: '$referrals' } } },
      { $sort: { referralCount: -1 } },
      { $limit: 5 }
    ]);
    
    res.status(200).json({
      success: true,
      data: {
        counts: {
          users: userCount,
          alumni: alumniCount,
          accommodations: accommodationCount,
          referrals: referralCount
        },
        recentUsers,
        recentAccommodations,
        topReferrers
      }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get all referrals
// @route   GET /api/admin/referrals
// @access  Private/Admin
exports.getAllReferrals = async (req, res, next) => {
  try {
    const referrals = await Referral.find()
      .populate('referrer', 'name email')
      .populate('referred', 'name email createdAt');
    
    res.status(200).json({
      success: true,
      count: referrals.length,
      data: referrals
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Create a new admin user
// @route   POST /api/admin/create
// @access  Private/Admin
exports.createAdmin = async (req, res, next) => {
  try {
    const { name, email, password, mobile } = req.body;

    // Check if user already exists
    let admin = await EmailUser.findOne({ email });
    if (admin) {
      return next(new ErrorResponse('User already exists with that email', 400));
    }
    
    // Create new admin user
    admin = await EmailUser.create({
      name,
      email,
      password,
      phone: mobile,
      role: 'admin'
    });

    res.status(201).json({
      success: true,
      data: {
        _id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role
      }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Promote user to institute role
// @route   PUT /api/admin/users/:id/promote-to-institute
// @access  Private/Admin
exports.promoteToInstitute = async (req, res, next) => {
  try {
    const user = await EmailUser.findById(req.params.id);
    
    if (!user) {
      return next(new ErrorResponse(`User not found with id of ${req.params.id}`, 404));
    }
    
    if (user.role === 'admin') {
      return next(new ErrorResponse('Admin users cannot be promoted to institute', 400));
    }
    
    if (user.role === 'institute') {
      return next(new ErrorResponse('User is already an institute', 400));
    }
    
    // Generate a unique 6-character alphanumeric referral code
    let referralCode = '';
    let isUnique = false;
    const customCodeInput = typeof req.body?.customReferralCode === 'string'
      ? sanitizeStr(req.body.customReferralCode).toUpperCase()
      : '';
    
    // Use custom referral code if provided, otherwise generate one
    if (customCodeInput) {
      if (!/^[A-Z0-9]{4,12}$/.test(customCodeInput)) {
        return next(new ErrorResponse('Custom referral code must be 4-12 characters using only letters and numbers', 400));
      }

      referralCode = customCodeInput;
      
      // Check if custom code is already in use
      const existingUser = await EmailUser.findOne({ referralCode });
      if (existingUser) {
        return next(new ErrorResponse('Custom referral code is already in use', 400));
      }
      
      isUnique = true;
    } else {
      // Generate a random code until we find a unique one
      while (!isUnique) {
        // Generate a 6-character alphanumeric code (excluding ambiguous characters)
        const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        referralCode = '';
        for (let i = 0; i < 6; i++) {
          referralCode += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        
        // Check if code is unique
        const existingUser = await EmailUser.findOne({ referralCode });
        if (!existingUser) {
          isUnique = true;
        }
      }
    }
    
    // Update only targeted fields to avoid full-document validation failures on legacy records
    const updatedUser = await EmailUser.findByIdAndUpdate(
      user._id,
      {
        $set: {
          role: 'institute',
          referralCode
        }
      },
      {
        new: true,
        runValidators: false,
        context: 'query'
      }
    );

    if (!updatedUser) {
      return next(new ErrorResponse(`User not found with id of ${req.params.id}`, 404));
    }
    
    res.status(200).json({
      success: true,
      data: {
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        role: updatedUser.role,
        referralCode: updatedUser.referralCode
      }
    });
  } catch (err) {
    if (err.code === 11000 && err.keyValue?.referralCode) {
      return next(new ErrorResponse('Referral code is already in use, please retry', 400));
    }
    next(err);
  }
};

// @desc    Get all institutes with referral stats
// @route   GET /api/admin/institutes
// @access  Private/Admin
exports.getInstitutes = async (req, res, next) => {
  try {
    const institutes = await EmailUser.find({ role: 'institute' })
      .select('name email phone college referralCode')
      .lean();

    // Get referral counts for each institute
    const institutesWithStats = await Promise.all(
      institutes.map(async (institute) => {
        const referralCount = await EmailUser.countDocuments({
          referrerCodeUsed: institute.referralCode
        });

        return {
          ...institute,
          referralCount,
          createdAt: institute._id.getTimestamp()
        };
      })
    );

    res.status(200).json({
      success: true,
      count: institutesWithStats.length,
      data: institutesWithStats
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update accommodation verification status
// @route   PUT /api/admin/accommodations/:id/verify
// @access  Private/Admin
exports.verifyAccommodation = async (req, res, next) => {
  try {
    const { verified } = req.body;
    
    if (verified === undefined) {
      return next(new ErrorResponse('Please provide verification status', 400));
    }
    
    const accommodation = await Accommodation.findByIdAndUpdate(
      req.params.id,
      { verified },
      { new: true, runValidators: true }
    );
    
    if (!accommodation) {
      return next(new ErrorResponse(`Accommodation not found with id of ${req.params.id}`, 404));
    }
    
    res.status(200).json({
      success: true,
      data: accommodation
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get users by referral code
// @route   GET /api/admin/users-by-referral/:referralCode
// @access  Private/Admin
exports.getUsersByReferralCode = async (req, res, next) => {
  try {
    const { referralCode } = req.params;
    
    if (!referralCode) {
      return next(new ErrorResponse('Referral code is required', 400));
    }
    
    // Find the institute by referral code
    const institute = await EmailUser.findOne({ referralCode, role: 'institute' })
      .select('name email phone college referralCode');
      
    if (!institute) {
      return next(new ErrorResponse('Institute not found with this referral code', 404));
    }
    
    // Find all users who used this referral code.
    // Include both `collegeYear` (legacy) and `year` (current schema).
    const users = await EmailUser.find({ referrerCodeUsed: referralCode })
      .select('name email phone college collegeYear year createdAt')
      .lean();

    // Enrich missing fields from pre-payment leads (real captured checkout data).
    const userIds = users.map((u) => u._id).filter(Boolean);
    const emails = users.map((u) => (u.email || '').toLowerCase()).filter(Boolean);

    let leads = [];
    if (userIds.length || emails.length) {
      const or = [];
      if (userIds.length) or.push({ userId: { $in: userIds } });
      if (emails.length) or.push({ email: { $in: emails } });

      leads = await PrePaymentLead.find({
        referralCode,
        ...(or.length ? { $or: or } : {}),
      })
        .select('userId email name phone college createdAt')
        .sort({ createdAt: -1 })
        .lean();
    }

    const leadByUserId = new Map();
    const leadByEmail = new Map();
    for (const lead of leads) {
      const keyByUserId = lead.userId ? lead.userId.toString() : null;
      const keyByEmail = lead.email ? lead.email.toLowerCase() : null;

      if (keyByUserId && !leadByUserId.has(keyByUserId)) {
        leadByUserId.set(keyByUserId, lead);
      }
      if (keyByEmail && !leadByEmail.has(keyByEmail)) {
        leadByEmail.set(keyByEmail, lead);
      }
    }

    const hydratedUsers = users.map((u) => {
      const userKey = u._id ? u._id.toString() : '';
      const emailKey = u.email ? u.email.toLowerCase() : '';
      const lead = leadByUserId.get(userKey) || leadByEmail.get(emailKey);

      return {
        ...u,
        name: u.name || lead?.name || '',
        phone: u.phone || lead?.phone || '',
        college: u.college || lead?.college || '',
        collegeYear: u.collegeYear || u.year || '',
      };
    });
    
    res.status(200).json({
      success: true,
      count: hydratedUsers.length,
      institute,
      data: hydratedUsers
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get all paid users (users with at least one successful payment)
// @route   GET /api/admin/paid-users
// @access  Private/Admin
exports.getPaidUsers = async (req, res, next) => {
  try {
    const Payment = require('../models/Payment');

    const payments = await Payment.find({ status: 'paid' })
      .populate('userId', 'name email phone college city whatsapp referralCode referrerCodeUsed profileCompleted createdAt')
      .sort({ createdAt: -1 })
      .lean();

    // Build a user-centric map (multiple payments per user → sum totals)
    const userMap = new Map();
    for (const payment of payments) {
      if (!payment.userId) continue;
      const uid = payment.userId._id.toString();
      if (!userMap.has(uid)) {
        userMap.set(uid, {
          ...payment.userId,
          payments: [],
          totalPaid: 0,
          lastPaymentDate: null
        });
      }
      const entry = userMap.get(uid);
      // notes is a Mongoose Map — after .lean() it's a plain object (not a JS Map),
      // so we spread it directly instead of using Object.fromEntries().
      const notesObj = payment.notes instanceof Map
        ? Object.fromEntries(payment.notes)
        : (payment.notes && typeof payment.notes === 'object' ? { ...payment.notes } : {});
      entry.payments.push({
        _id: payment._id,
        razorpayPaymentId: payment.razorpayPaymentId,
        amountInRupees: payment.amountInRupees,
        purpose: payment.purpose,
        paidAt: payment.paidAt,
        notes: notesObj,
      });
      entry.totalPaid += payment.amountInRupees || 0;
      if (!entry.lastPaymentDate || new Date(payment.paidAt) > new Date(entry.lastPaymentDate)) {
        entry.lastPaymentDate = payment.paidAt;
      }
    }

    const data = Array.from(userMap.values());

    res.status(200).json({ success: true, count: data.length, data });
  } catch (err) {
    next(err);
  }
};

// @desc    Get all email users (admin)
// @route   GET /api/admin/email-users
// @access  Private/Admin
exports.getEmailUsers = async (req, res, next) => {
  try {
    const { role } = req.query;
    const filter = role ? { role } : {};

    const users = await EmailUser.find(filter)
      .select('-password -verificationToken -verificationExpire')
      .sort({ createdAt: -1 })
      .lean();

    // Attach a referralsCount convenience field
    const usersWithCount = users.map(u => ({
      ...u,
      referralsCount: Array.isArray(u.referrals) ? u.referrals.length : 0
    }));

    res.status(200).json({
      success: true,
      count: usersWithCount.length,
      data: usersWithCount
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Promote email user to admin
// @route   PUT /api/admin/email-users/:id/promote-to-admin
// @access  Private/Admin
exports.promoteEmailUserToAdmin = async (req, res, next) => {
  try {
    // findByIdAndUpdate + runValidators:false avoids 500s on legacy records
    // that predate a since-added required field (mirrors promoteToInstitute).
    const user = await EmailUser.findByIdAndUpdate(
      req.params.id,
      { $set: { role: 'admin' } },
      { new: true, runValidators: false, context: 'query' }
    );

    if (!user) {
      return next(new ErrorResponse(`User not found with id ${req.params.id}`, 404));
    }

    res.status(200).json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Set a user's role directly (used to demote admin/institute back to student,
//          or move between any roles without the institute-specific referral-code logic)
// @route   PUT /api/admin/email-users/:id/role
// @access  Private/Admin
exports.setUserRole = async (req, res, next) => {
  try {
    const validRoles = ['student', 'admin', 'institute'];
    const { role } = req.body || {};
    if (!validRoles.includes(role)) {
      return next(new ErrorResponse(`Role must be one of: ${validRoles.join(', ')}`, 400));
    }

    const target = await EmailUser.findById(req.params.id).select('_id role');
    if (!target) {
      return next(new ErrorResponse(`User not found with id ${req.params.id}`, 404));
    }

    // Prevent an admin from accidentally demoting themselves out of admin access.
    if (String(target._id) === String(req.user._id) && target.role === 'admin' && role !== 'admin') {
      return next(new ErrorResponse('You cannot change your own admin role', 400));
    }

    const updated = await EmailUser.findByIdAndUpdate(
      req.params.id,
      { $set: { role } },
      { new: true, runValidators: false, context: 'query' }
    );

    res.status(200).json({
      success: true,
      data: {
        _id: updated._id,
        name: updated.name,
        email: updated.email,
        role: updated.role,
        referralCode: updated.referralCode,
      }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete email user
// @route   DELETE /api/admin/email-users/:id
// @access  Private/Admin
exports.deleteEmailUser = async (req, res, next) => {
  try {
    const user = await EmailUser.findById(req.params.id);

    if (!user) {
      return next(new ErrorResponse(`User not found with id ${req.params.id}`, 404));
    }

    await user.deleteOne();

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (err) {
    next(err);
  }
};

exports.getStudentReferralReward = async (req, res, next) => {
  try {
    const setting = await ReferralRewardSetting.findOne({ key: 'student' }).lean();
    res.status(200).json({
      success: true,
      data: { discountPercent: Number(setting?.discountPercent) || 0 },
    });
  } catch (err) {
    next(err);
  }
};

exports.updateStudentReferralReward = async (req, res, next) => {
  try {
    const discountPercent = parseRewardPercent(req.body?.discountPercent);
    if (discountPercent === null) {
      return next(new ErrorResponse('Enter a discount from 0% to 100%.', 400));
    }
    const setting = await ReferralRewardSetting.findOneAndUpdate(
      { key: 'student' },
      { $set: { discountPercent } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    res.status(200).json({
      success: true,
      data: { discountPercent: setting.discountPercent },
    });
  } catch (err) {
    next(err);
  }
};