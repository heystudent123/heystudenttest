const EmailUser = require('../models/EmailUser');
const Payment = require('../models/Payment');
const Course = require('../models/Course');
const Plan = require('../models/Plan');
const MockTest = require('../models/MockTest');
const Coupon = require('../models/Coupon');
const ReferralRewardSetting = require('../models/ReferralRewardSetting');
const ErrorResponse = require('../utils/errorResponse');
const { sanitizeStr, isObjectId } = require('../middleware/validate');
const { parseRewardPercent } = require('../utils/referralReward');

const CODE_PATTERN = /^[A-Z0-9]{4,12}$/;

async function paidCounts(noteField) {
  const rows = await Payment.aggregate([
    { $match: { status: 'paid' } },
    { $group: { _id: `$notes.${noteField}`, count: { $sum: 1 } } },
  ]);
  const counts = new Map();
  rows.forEach((row) => {
    const code = String(row._id || '').trim().toUpperCase();
    if (code) counts.set(code, row.count);
  });
  return counts;
}

function personRow(user, count) {
  return {
    _id: user._id,
    name: user.name || '',
    email: user.email || '',
    referralCode: user.referralCode || '',
    paidCount: count,
  };
}

exports.getReferralCenter = async (req, res, next) => {
  try {
    const [setting, students, institutes, studentCounts, instituteCounts] = await Promise.all([
      ReferralRewardSetting.findOne({ key: 'student' }).lean(),
      EmailUser.find({ role: 'student' }).select('name email referralCode').sort({ name: 1 }).lean(),
      EmailUser.find({ role: 'institute' }).select('name email referralCode').sort({ name: 1 }).lean(),
      paidCounts('studentReferralCode'),
      paidCounts('referralCode'),
    ]);
    res.status(200).json({
      success: true,
      data: {
        studentPercent: Number(setting?.discountPercent) || 0,
        institutePercent: Number(setting?.instituteDiscountPercent) || 0,
        students: students.map((user) => personRow(user, studentCounts.get(String(user.referralCode || '').toUpperCase()) || 0)),
        institutes: institutes.map((user) => personRow(user, instituteCounts.get(String(user.referralCode || '').toUpperCase()) || 0)),
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.getReferralUses = async (req, res, next) => {
  try {
    if (!isObjectId(req.params.userId)) return next(new ErrorResponse('User not found.', 404));
    const user = await EmailUser.findById(req.params.userId).select('name email role referralCode').lean();
    if (!user || (user.role !== 'student' && user.role !== 'institute')) {
      return next(new ErrorResponse('User not found.', 404));
    }
    const field = user.role === 'institute' ? 'notes.referralCode' : 'notes.studentReferralCode';
    const payments = await Payment.find({ status: 'paid', [field]: user.referralCode })
      .sort({ paidAt: -1, createdAt: -1 })
      .select('userId purpose purposeId amountInRupees paidAt createdAt')
      .lean();
    const buyerIds = [...new Set(payments.map((payment) => String(payment.userId)))];
    const buyers = await EmailUser.find({ _id: { $in: buyerIds } }).select('name email').lean();
    const buyerById = new Map(buyers.map((buyer) => [String(buyer._id), buyer]));
    const courseIds = payments.filter((p) => p.purpose === 'course_enrollment').map((p) => p.purposeId);
    const planIds = payments.filter((p) => p.purpose === 'plan').map((p) => p.purposeId);
    const testIds = payments.filter((p) => p.purpose === 'mock_test').map((p) => p.purposeId);
    const [courses, plans, tests] = await Promise.all([
      Course.find({ _id: { $in: courseIds } }).select('title').lean(),
      Plan.find({ _id: { $in: planIds } }).select('title').lean(),
      MockTest.find({ _id: { $in: testIds } }).select('title').lean(),
    ]);
    const titleOf = new Map([
      ...courses.map((item) => [String(item._id), item.title]),
      ...plans.map((item) => [String(item._id), item.title]),
      ...tests.map((item) => [String(item._id), item.title]),
    ]);
    res.status(200).json({
      success: true,
      data: {
        user,
        uses: payments.map((payment) => {
          const buyer = buyerById.get(String(payment.userId));
          return {
            _id: payment._id,
            buyerName: buyer?.name || '',
            buyerEmail: buyer?.email || '',
            purpose: payment.purpose,
            title: titleOf.get(String(payment.purposeId)) || '',
            amount: payment.amountInRupees,
            paidAt: payment.paidAt || payment.createdAt,
          };
        }),
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.updateReferralSettings = async (req, res, next) => {
  try {
    const studentPercent = parseRewardPercent(req.body?.studentPercent);
    const institutePercent = parseRewardPercent(req.body?.institutePercent);
    if (studentPercent === null || institutePercent === null) {
      return next(new ErrorResponse('Enter a percentage from 0 to 100 for students and for institutes.', 400));
    }
    const setting = await ReferralRewardSetting.findOneAndUpdate(
      { key: 'student' },
      { $set: { discountPercent: studentPercent, instituteDiscountPercent: institutePercent } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    res.status(200).json({
      success: true,
      data: {
        studentPercent: setting.discountPercent,
        institutePercent: setting.instituteDiscountPercent,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.updateInstituteCode = async (req, res, next) => {
  try {
    if (!isObjectId(req.params.id)) return next(new ErrorResponse('Institute not found.', 404));
    const code = sanitizeStr(String(req.body?.referralCode || '')).toUpperCase();
    if (!CODE_PATTERN.test(code)) {
      return next(new ErrorResponse('Code must be 4-12 letters or numbers.', 400));
    }
    const institute = await EmailUser.findOne({ _id: req.params.id, role: 'institute' });
    if (!institute) return next(new ErrorResponse('Institute not found.', 404));
    const [takenUser, takenCoupon] = await Promise.all([
      EmailUser.findOne({ referralCode: code, _id: { $ne: institute._id } }).select('_id'),
      Coupon.findOne({ code }).select('_id'),
    ]);
    if (takenUser || takenCoupon) {
      return next(new ErrorResponse('That code is already in use.', 400));
    }
    institute.referralCode = code;
    await institute.save();
    res.status(200).json({ success: true, data: { _id: institute._id, referralCode: institute.referralCode } });
  } catch (err) {
    next(err);
  }
};

function cleanIdList(values) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((id) => String(id)).filter((id) => isObjectId(id)))];
}

function presentCoupon(coupon) {
  return {
    _id: coupon._id,
    code: coupon.code,
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    courseIds: (coupon.courseIds || []).map(String),
    planIds: (coupon.planIds || []).map(String),
    mockTestIds: (coupon.mockTestIds || []).map(String),
    expiresAt: coupon.expiresAt,
    maxUsesPerUser: coupon.maxUsesPerUser,
    isActive: coupon.isActive,
  };
}

function couponPayload(body) {
  const code = sanitizeStr(String(body.code || '')).toUpperCase();
  const discountType = body.discountType === 'flat' ? 'flat' : body.discountType === 'percent' ? 'percent' : '';
  const discountValue = Number(body.discountValue);
  const maxUsesPerUser = Number(body.maxUsesPerUser);
  const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
  const courseIds = cleanIdList(body.courseIds);
  const planIds = cleanIdList(body.planIds);
  const mockTestIds = cleanIdList(body.mockTestIds);
  const errors = [];
  if (!CODE_PATTERN.test(code)) errors.push('Code must be 4-12 letters or numbers.');
  if (!discountType) errors.push('Choose a percentage or a fixed rupee discount.');
  if (!Number.isFinite(discountValue) || discountValue <= 0) errors.push('Discount must be greater than 0.');
  if (discountType === 'percent' && discountValue > 100) errors.push('Percentage discount cannot be more than 100.');
  if (discountType === 'flat' && discountValue > 100000) errors.push('Fixed discount cannot be more than ₹100000.');
  if (!Number.isInteger(maxUsesPerUser) || maxUsesPerUser < 1 || maxUsesPerUser > 100) {
    errors.push('Uses per student must be a whole number from 1 to 100.');
  }
  if (!expiresAt || Number.isNaN(expiresAt.getTime())) errors.push('Choose an expiry date.');
  if (courseIds.length + planIds.length + mockTestIds.length === 0) {
    errors.push('Choose at least one course, plan, or mock test.');
  }
  return {
    errors,
    value: {
      code,
      discountType,
      discountValue: Math.round(discountValue * 100) / 100,
      courseIds,
      planIds,
      mockTestIds,
      expiresAt,
      maxUsesPerUser,
      isActive: body.isActive !== false,
    },
  };
}

exports.listCoupons = async (req, res, next) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 }).lean();
    res.status(200).json({ success: true, data: coupons.map(presentCoupon) });
  } catch (err) {
    next(err);
  }
};

exports.createCoupon = async (req, res, next) => {
  try {
    const { errors, value } = couponPayload(req.body || {});
    if (errors.length) return next(new ErrorResponse(errors[0], 400));
    const [takenUser, takenCoupon] = await Promise.all([
      EmailUser.findOne({ referralCode: value.code }).select('_id'),
      Coupon.findOne({ code: value.code }).select('_id'),
    ]);
    if (takenUser || takenCoupon) return next(new ErrorResponse('That code is already in use.', 400));
    const coupon = await Coupon.create({ ...value, createdBy: req.user._id });
    res.status(201).json({ success: true, data: presentCoupon(coupon) });
  } catch (err) {
    next(err);
  }
};

exports.updateCoupon = async (req, res, next) => {
  try {
    if (!isObjectId(req.params.id)) return next(new ErrorResponse('Coupon not found.', 404));
    const { errors, value } = couponPayload(req.body || {});
    if (errors.length) return next(new ErrorResponse(errors[0], 400));
    const [takenUser, takenCoupon] = await Promise.all([
      EmailUser.findOne({ referralCode: value.code }).select('_id'),
      Coupon.findOne({ code: value.code, _id: { $ne: req.params.id } }).select('_id'),
    ]);
    if (takenUser || takenCoupon) return next(new ErrorResponse('That code is already in use.', 400));
    const coupon = await Coupon.findByIdAndUpdate(req.params.id, { $set: value }, { new: true });
    if (!coupon) return next(new ErrorResponse('Coupon not found.', 404));
    res.status(200).json({ success: true, data: presentCoupon(coupon) });
  } catch (err) {
    next(err);
  }
};

exports.deleteCoupon = async (req, res, next) => {
  try {
    if (!isObjectId(req.params.id)) return next(new ErrorResponse('Coupon not found.', 404));
    const coupon = await Coupon.findByIdAndDelete(req.params.id);
    if (!coupon) return next(new ErrorResponse('Coupon not found.', 404));
    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    next(err);
  }
};
