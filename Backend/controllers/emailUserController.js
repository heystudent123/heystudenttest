const EmailUser = require('../models/EmailUser');
const Referral = require('../models/Referral');
const ErrorResponse = require('../utils/errorResponse');

// @desc    Sync user from Clerk (create or update local user after Clerk sign-in)
// @route   POST /api/email-users/sync
// @access  Private (requires Clerk token)
exports.syncUser = async (req, res, next) => {
  try {
    const { clerkId, email, name, phone } = req.body;

    if (!clerkId || !email) {
      return next(new ErrorResponse('clerkId and email are required', 400));
    }

    // Try to find user by clerkId first, then by email
    let user = await EmailUser.findOne({ clerkId });
    
    if (!user) {
      user = await EmailUser.findOne({ email });
    }

    if (user) {
      // Update only targeted fields to avoid full-document validation failures on legacy records.
      const updates = {};
      const cleanName = typeof name === 'string' ? name.trim() : '';
      const cleanPhone = typeof phone === 'string' ? phone.trim() : '';

      if (!user.clerkId) updates.clerkId = clerkId;
      if (cleanName && !user.name) updates.name = cleanName;
      if (cleanPhone) updates.phone = cleanPhone;

      if (Object.keys(updates).length) {
        user = await EmailUser.findByIdAndUpdate(
          user._id,
          { $set: updates },
          { new: true, runValidators: false, context: 'query' }
        );
      }
    } else {
      // Create new user
      user = await EmailUser.create({
        clerkId,
        email,
        name: (typeof name === 'string' && name.trim()) ? name.trim() : email.split('@')[0],
        phone: typeof phone === 'string' ? phone.trim() : ''
      });
    }

    res.status(200).json({
      success: true,
      data: user,
      isNewUser: !user.profileCompleted // Flag: user hasn't completed profile yet
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get current logged in user
// @route   GET /api/email-users/me
// @access  Private
exports.getMe = async (req, res, next) => {
  try {
    const user = await EmailUser.findById(req.user.id);
    
    if (!user) {
      return next(new ErrorResponse('User not found', 404));
    }

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update user profile
// @route   PUT /api/email-users/profile
// @access  Private
exports.updateProfile = async (req, res, next) => {
  try {
    const {
      name,
      fullName,
      phone,
      college,
      course,
      year,
      address,
      city,
      whatsapp
    } = req.body;

    const user = await EmailUser.findById(req.user.id);

    if (!user) {
      return next(new ErrorResponse('User not found', 404));
    }

    // Normalize incoming values so legacy/partial payloads don't trigger schema crashes.
    const normalizedName = typeof name === 'string'
      ? name.trim()
      : (typeof fullName === 'string' ? fullName.trim() : '');
    const normalizedPhone = typeof phone === 'string' ? phone.trim() : undefined;
    const normalizedCollege = typeof college === 'string' ? college.trim() : undefined;
    const normalizedCourse = typeof course === 'string' ? course.trim() : undefined;
    const normalizedYear = typeof year === 'string' ? year.trim() : undefined;
    const normalizedAddress = typeof address === 'string' ? address.trim() : undefined;
    const normalizedCity = typeof city === 'string' ? city.trim() : undefined;
    const normalizedWhatsapp = typeof whatsapp === 'string' ? whatsapp.trim() : undefined;

    // If record has no name, require it from payload and return a clean 400 (not 500).
    if (!user.name && !normalizedName) {
      return next(new ErrorResponse('Please add your full name', 400));
    }

    // Update fields
    if (normalizedName) user.name = normalizedName;
    if (normalizedPhone !== undefined) user.phone = normalizedPhone;
    if (normalizedCollege !== undefined) user.college = normalizedCollege;
    if (normalizedCourse !== undefined) user.course = normalizedCourse;
    if (normalizedYear !== undefined) user.year = normalizedYear;
    if (normalizedAddress !== undefined) user.address = normalizedAddress;
    if (normalizedCity !== undefined) user.city = normalizedCity;
    if (normalizedWhatsapp !== undefined) user.whatsapp = normalizedWhatsapp;

    // Mark profile as completed if key fields are filled
    if (user.name && user.city && user.whatsapp) {
      user.profileCompleted = true;
    }

    await user.save();

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const firstError = Object.values(err.errors || {})[0];
      const message = firstError?.message || 'Invalid profile data';
      return next(new ErrorResponse(message, 400));
    }
    next(err);
  }
};

// @desc    Complete user profile (with referral)
// @route   POST /api/email-users/complete-profile
// @access  Private
exports.completeProfile = async (req, res, next) => {
  try {
    const {
      name,
      phone,
      college,
      course,
      year,
      address,
      referralCode
    } = req.body;

    const user = await EmailUser.findById(req.user.id);

    if (!user) {
      return next(new ErrorResponse('User not found', 404));
    }

    // Update profile fields
    user.name = name || user.name;
    user.phone = phone || user.phone;
    user.college = college;
    user.course = course;
    user.year = year;
    user.address = address || user.address;
    user.profileCompleted = true;

    // Handle referral code
    if (referralCode) {
      const referrer = await EmailUser.findOne({ referralCode });
      
      if (referrer) {
        user.referrerCodeUsed = referralCode;
        user.referredBy = referrer._id;
        
        // Add this user to referrer's referrals list
        referrer.referrals.push(user._id);
        await referrer.save();
        
        // Create referral record
        await Referral.create({
          referrer: referrer._id,
          referred: user._id,
          code: referralCode,
          status: 'completed'
        });
      }
    }

    await user.save();

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get user's wishlist
// @route   GET /api/email-users/wishlist
// @access  Private
exports.getWishlist = async (req, res, next) => {
  try {
    const user = await EmailUser.findById(req.user.id).populate({
      path: 'wishlist',
      select: 'name type rent address nearestCollege images'
    });

    if (!user) {
      return next(new ErrorResponse('User not found', 404));
    }

    res.status(200).json({
      success: true,
      count: user.wishlist.length,
      data: user.wishlist
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Add accommodation to wishlist
// @route   POST /api/email-users/wishlist
// @access  Private
exports.addToWishlist = async (req, res, next) => {
  try {
    const { accommodationId } = req.body;

    if (!accommodationId) {
      return next(new ErrorResponse('Please provide an accommodation ID', 400));
    }

    const user = await EmailUser.findById(req.user.id);

    if (!user) {
      return next(new ErrorResponse('User not found', 404));
    }

    // Check if already in wishlist
    if (user.wishlist.includes(accommodationId)) {
      return next(new ErrorResponse('Accommodation already in wishlist', 400));
    }

    user.wishlist.push(accommodationId);
    await user.save();

    res.status(200).json({
      success: true,
      data: user.wishlist
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Remove accommodation from wishlist
// @route   DELETE /api/email-users/wishlist/:accommodationId
// @access  Private
exports.removeFromWishlist = async (req, res, next) => {
  try {
    const user = await EmailUser.findById(req.user.id);

    if (!user) {
      return next(new ErrorResponse('User not found', 404));
    }

    user.wishlist = user.wishlist.filter(
      item => item.toString() !== req.params.accommodationId
    );

    await user.save();

    res.status(200).json({
      success: true,
      data: user.wishlist
    });
  } catch (err) {
    next(err);
  }
};
