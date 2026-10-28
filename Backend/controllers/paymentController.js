const crypto = require('crypto');
const getRazorpay = require('../utils/razorpay');
const Payment = require('../models/Payment');
const Enrollment = require('../models/Enrollment');
const ErrorResponse = require('../utils/errorResponse');
const EmailUser = require('../models/EmailUser');
const Course = require('../models/Course');
const Plan = require('../models/Plan');
const MockTest = require('../models/MockTest');
const Referral = require('../models/Referral');
const PrePaymentLead = require('../models/PrePaymentLead');
const { sanitizeStr, isPositiveNumber, isNonEmpty, isObjectId } = require('../middleware/validate');
const { signaturesMatch, capturedMatchesStored } = require('../utils/paymentGuards');
const { priceAfterReward, priceAfterPercent } = require('../utils/referralReward');
const ReferralReward = require('../models/ReferralReward');
const ReferralRewardSetting = require('../models/ReferralRewardSetting');
const Coupon = require('../models/Coupon');
const CouponRedemption = require('../models/CouponRedemption');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Generate a short unique receipt string (max 40 chars for Razorpay).
 * Format: rcpt_<purpose_prefix>_<timestamp>
 */
const generateReceipt = (purpose) => {
  const prefix = purpose.replace(/[^a-z0-9]/gi, '').slice(0, 10).toLowerCase();
  return `rcpt_${prefix}_${Date.now()}`;
};

/**
 * Verify Razorpay payment signature.
 * signature = HMAC-SHA256( razorpayOrderId + "|" + razorpayPaymentId, keySecret )
 */
const verifySignature = (orderId, paymentId, signature) => {
  const body = `${orderId}|${paymentId}`;
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');
  return signaturesMatch(expected, signature);
};

/**
 * Verify Razorpay webhook signature.
 * signature = HMAC-SHA256( rawBody, webhookSecret )
 */
const verifyWebhookSignature = (rawBody, signature) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || rawBody == null || typeof signature !== 'string') return false;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  return signaturesMatch(expected, signature);
};

/**
 * Persist referral attribution on user records after a successful payment.
 * Institute dashboard reads EmailUser.referrerCodeUsed, so we sync it here.
 */
const applyReferralAttributionForPayment = async (payment) => {
  if (!payment || !payment.userId) return;
  await consumeReservedReward(payment);

  const notesObj = payment.notes instanceof Map
    ? Object.fromEntries(payment.notes)
    : (payment.notes && typeof payment.notes === 'object' ? payment.notes : {});

  const cleanReferralCode = notesObj?.referralCode
    ? sanitizeStr(String(notesObj.referralCode)).toUpperCase()
    : '';

  if (cleanReferralCode) {
    await attributeReferralUse(payment, cleanReferralCode);
  }
  await grantStudentReferralReward(payment);
  await recordCouponRedemption(payment);
};

const attributeReferralUse = async (payment, cleanReferralCode) => {
  const [buyer, referrer] = await Promise.all([
    EmailUser.findById(payment.userId),
    EmailUser.findOne({ referralCode: cleanReferralCode, role: 'institute' })
  ]);

  if (!buyer || !referrer) return;

  let buyerUpdated = false;
  if (!buyer.referrerCodeUsed) {
    buyer.referrerCodeUsed = cleanReferralCode;
    buyerUpdated = true;
  }
  if (!buyer.referredBy) {
    buyer.referredBy = referrer._id;
    buyerUpdated = true;
  }
  if (buyerUpdated) {
    await buyer.save();
  }

  const alreadyTracked = Array.isArray(referrer.referrals)
    && referrer.referrals.some((id) => id.toString() === buyer._id.toString());

  if (!alreadyTracked) {
    referrer.referrals.push(buyer._id);
    await referrer.save();
  }

  await Referral.updateOne(
    { referrer: referrer._id, referred: buyer._id },
    {
      $setOnInsert: {
        referrer: referrer._id,
        referred: buyer._id,
        referralCode: cleanReferralCode,
        status: 'converted',
      }
    },
    { upsert: true }
  );
};

const noteValue = (payment, key) => {
  const notesObj = payment.notes instanceof Map
    ? Object.fromEntries(payment.notes)
    : (payment.notes && typeof payment.notes === 'object' ? payment.notes : {});
  return notesObj?.[key] ? sanitizeStr(String(notesObj[key])).toUpperCase() : '';
};

const releaseAbandonedRewards = async (userId) => {
  const reserved = await ReferralReward.find({ referrerId: userId, status: 'reserved' });
  const staleBefore = Date.now() - 10 * 60 * 1000;
  for (const credit of reserved) {
    if (!credit.reservedPaymentId) {
      if (new Date(credit.updatedAt).getTime() > staleBefore) continue;
      credit.status = 'available';
      await credit.save();
      continue;
    }
    const payment = await Payment.findById(credit.reservedPaymentId).select('status');
    if (!payment || payment.status !== 'paid') {
      credit.status = 'available';
      credit.reservedPaymentId = null;
      await credit.save();
    }
  }
};

const claimNextReward = async (userId) => {
  await releaseAbandonedRewards(userId);
  return ReferralReward.findOneAndUpdate(
    { referrerId: userId, status: 'available' },
    { $set: { status: 'reserved' } },
    { sort: { createdAt: 1 }, new: true }
  );
};

const releaseClaimedReward = async (credit) => {
  if (!credit) return;
  await ReferralReward.updateOne(
    { _id: credit._id, status: 'reserved', reservedPaymentId: null },
    { $set: { status: 'available' } }
  );
};

const consumeReservedReward = async (payment) => {
  if (!payment?._id) return;
  await ReferralReward.updateOne(
    { reservedPaymentId: payment._id, status: 'reserved' },
    { $set: { status: 'used', usedPaymentId: payment._id } }
  );
};

const noteRaw = (payment, key) => {
  const notesObj = payment.notes instanceof Map
    ? Object.fromEntries(payment.notes)
    : (payment.notes && typeof payment.notes === 'object' ? payment.notes : {});
  return notesObj?.[key] ? String(notesObj[key]) : '';
};

const recordCouponRedemption = async (payment) => {
  const couponId = noteRaw(payment, 'couponId');
  if (!couponId || !isObjectId(couponId)) return;
  try {
    await CouponRedemption.create({
      couponId,
      userId: payment.userId,
      paymentId: payment._id,
    });
  } catch (err) {
    if (err?.code !== 11000) throw err;
  }
};

const resolveReferralCode = async (code, buyerId) => {
  if (!code) return { kind: null };
  const owner = await EmailUser.findOne({ referralCode: code.toUpperCase() }).select('_id role referralCode');
  if (!owner || String(owner._id) === String(buyerId) || (owner.role !== 'institute' && owner.role !== 'student')) {
    return { error: 'That referral code is not valid.' };
  }
  return { kind: owner.role, code: owner.referralCode };
};

const resolveCoupon = async (code, buyerId, purpose, itemId) => {
  if (!code) return { coupon: null };
  const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true });
  if (!coupon) return { error: 'That coupon code is not valid.' };
  if (coupon.expiresAt && coupon.expiresAt.getTime() < Date.now()) return { error: 'That coupon has expired.' };
  const id = String(itemId || '');
  const allowed = purpose === 'course_enrollment'
    ? (coupon.courseIds || []).some((courseId) => String(courseId) === id)
    : purpose === 'plan'
      ? (coupon.planIds || []).some((planId) => String(planId) === id)
      : (coupon.mockTestIds || []).some((testId) => String(testId) === id);
  if (!allowed) return { error: 'That coupon does not apply to this purchase.' };
  const used = await CouponRedemption.countDocuments({ couponId: coupon._id, userId: buyerId });
  if (used >= coupon.maxUsesPerUser) return { error: 'You have already used this coupon the allowed number of times.' };
  return { coupon };
};

const grantStudentReferralReward = async (payment) => {
  const code = noteValue(payment, 'studentReferralCode');
  if (!code) return;
  if (!['course_enrollment', 'plan', 'mock_test'].includes(payment.purpose)) return;
  const [buyer, referrer, setting] = await Promise.all([
    EmailUser.findById(payment.userId).select('_id'),
    EmailUser.findOne({ referralCode: code, role: 'student' }).select('_id'),
    ReferralRewardSetting.findOne({ key: 'student' }).select('discountPercent'),
  ]);
  if (!buyer || !referrer) return;
  if (String(referrer._id) === String(buyer._id)) return;
  const percent = Number(setting?.discountPercent) || 0;
  if (!(percent > 0)) return;
  try {
    await ReferralReward.create({
      referrerId: referrer._id,
      percent,
      earnedFromPaymentId: payment._id,
      earnedFromUserId: buyer._id,
    });
  } catch (err) {
    if (err?.code !== 11000) throw err;
  }
};

const enrollCourse = async (payment, courseId) => {
  return Enrollment.findOneAndUpdate(
    { userId: payment.userId, courseSlug: String(courseId) },
    {
      userId: payment.userId,
      courseSlug: String(courseId),
      courseId,
      paymentId: payment._id,
      razorpayOrderId: payment.razorpayOrderId,
      amountPaid: payment.amount,
      isActive: true,
      enrolledAt: new Date(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

/**
 * Grant the access that a paid order bought. Safe to run from both verify
 * and the webhook: enrollment is an upsert on user + course.
 */
const grantPaidAccess = async (payment) => {
  let enrollment = null;
  if (!payment) return null;

  if (payment.purpose === 'plan' && payment.purposeId) {
    const plan = await Plan.findById(payment.purposeId).select('courseIds');
    for (const courseId of plan?.courseIds || []) {
      try {
        enrollment = await enrollCourse(payment, courseId);
      } catch (enrollErr) {
        console.error('Plan course enrollment error (non-fatal):', enrollErr.message);
      }
    }
  }

  if (payment.purpose === 'course_enrollment') {
    if (!payment.purposeId) {
      console.error('Course payment has no course id; enrollment skipped', payment._id);
      return enrollment;
    }
    try {
      enrollment = await enrollCourse(payment, payment.purposeId);
    } catch (enrollErr) {
      console.error('Auto-enrollment error (non-fatal):', enrollErr.message);
    }
  }

  return enrollment;
};

const serverOrderNotes = (clientNotes, serverFields) => {
  const safeNotes = {};
  if (clientNotes && typeof clientNotes === 'object' && !Array.isArray(clientNotes)) {
    for (const [key, value] of Object.entries(clientNotes)) {
      if (value == null) continue;
      const cleanKey = sanitizeStr(String(key)).slice(0, 40);
      if (!cleanKey) continue;
      safeNotes[cleanKey] = sanitizeStr(String(value)).slice(0, 200);
    }
  }
  return { ...safeNotes, ...serverFields };
};

const markPaidFromWebhook = async (payment, entity, eventType, paymentId) => {
  if (!payment) return;
  if (payment.status === 'refunded' || payment.status === 'partially_refunded') return;
  if (!capturedMatchesStored(payment, entity)) {
    console.warn(`Razorpay webhook: captured amount does not match stored order ${payment.razorpayOrderId}`);
    return;
  }
  if (payment.status !== 'paid') {
    payment.status = 'paid';
    if (paymentId) payment.razorpayPaymentId = paymentId;
    payment.paidAt = entity.created_at ? new Date(entity.created_at * 1000) : new Date();
    payment.webhookVerified = true;
    payment.webhookEvent = eventType;
    await payment.save();
    await applyReferralAttributionForPayment(payment);
  }
  await grantPaidAccess(payment);
};

// ─── Controllers ──────────────────────────────────────────────────────────────

// @desc    Create a Razorpay order
// @route   POST /api/payments/create-order
// @access  Private
exports.createOrder = async (req, res, next) => {
  let claimedReward = null;
  try {
    const razorpay = getRazorpay();

    const {
      amount,           // in rupees (we convert to paise)
      currency = 'INR',
      purpose,          // e.g. 'course_enrollment'
      purposeId,        // ObjectId of the related resource
      purposeModel,     // e.g. 'Course'
      courseSlug,       // slug for enrollment lookup
      referralCode,     // one code: server decides student or institute
      couponCode,       // optional coupon, can be combined with a referral code
      notes = {},       // extra key-value pairs forwarded to Razorpay
    } = req.body;

    // ── Input validation ──────────────────────────────────────────────────────
    if (!purpose || !isNonEmpty(sanitizeStr(String(purpose)))) {
      return next(new ErrorResponse('Payment purpose is required', 400));
    }
    // Currency must be a 3-letter ISO code
    const cleanCurrency = sanitizeStr(String(currency)).toUpperCase();
    if (!/^[A-Z]{3}$/.test(cleanCurrency)) {
      return next(new ErrorResponse('Invalid currency code', 400));
    }
    const cleanPurpose = sanitizeStr(String(purpose));
    const cleanCourseSlug = courseSlug ? sanitizeStr(String(courseSlug)) : undefined;
    const cleanReferralCode = referralCode ? sanitizeStr(String(referralCode)) : '';
    const cleanCouponCode = couponCode ? sanitizeStr(String(couponCode)) : '';
    const serverPriced = cleanPurpose === 'course_enrollment' || cleanPurpose === 'plan' || cleanPurpose === 'mock_test';
    if (serverPriced && cleanCurrency !== 'INR') {
      return next(new ErrorResponse('Only INR payments are accepted', 400));
    }

    let finalAmount = amount;
    let resolvedPurposeId = purposeId || null;
    let resolvedPurposeModel = purposeModel || null;
    let courseForOrder = null;
    // The courses page sends the course's Mongo _id as `courseSlug`. The price
    // and the course that gets enrolled both come from that record.
    if (cleanPurpose === 'course_enrollment') {
      const slugId = cleanCourseSlug && isObjectId(cleanCourseSlug) ? String(cleanCourseSlug) : null;
      const bodyId = purposeId && isObjectId(purposeId) ? String(purposeId) : null;
      if (slugId && bodyId && slugId !== bodyId) {
        return next(new ErrorResponse('Choose a valid course to buy.', 400));
      }
      const courseId = slugId || bodyId;
      if (!courseId) return next(new ErrorResponse('Choose a valid course to buy.', 400));
      courseForOrder = await Course.findById(courseId);
      if (!courseForOrder || courseForOrder.isActive === false) {
        return next(new ErrorResponse('This course is not for sale.', 404));
      }
      if (!(courseForOrder.price > 0)) {
        return next(new ErrorResponse('This course has no price.', 400));
      }
      finalAmount = courseForOrder.price;
      resolvedPurposeId = courseForOrder._id;
      resolvedPurposeModel = 'Course';
    }
    if (cleanPurpose === 'plan' || cleanPurpose === 'mock_test') {
      if (!isObjectId(purposeId)) return next(new ErrorResponse('Choose a valid item to buy.', 400));
      if (cleanPurpose === 'plan') {
        const plan = await Plan.findById(purposeId);
        if (!plan || plan.status !== 'published') return next(new ErrorResponse('This plan is not for sale.', 404));
        finalAmount = plan.price;
        resolvedPurposeModel = 'Plan';
      } else {
        const test = await MockTest.findById(purposeId);
        if (!test || test.status !== 'published' || test.isFree) {
          return next(new ErrorResponse('This mock test is not for sale.', 404));
        }
        if (!(test.price > 0)) return next(new ErrorResponse('This mock test has no price.', 400));
        finalAmount = test.price;
        resolvedPurposeModel = 'MockTest';
      }
    }

    const listPrice = Number(finalAmount) || 0;
    let appliedReferralCode = null;
    let appliedStudentCode = null;
    let appliedCoupon = null;
    if (serverPriced && cleanReferralCode) {
      const resolved = await resolveReferralCode(cleanReferralCode, req.user._id);
      if (resolved.error) return next(new ErrorResponse(resolved.error, 400));
      if (resolved.kind === 'institute') {
        appliedReferralCode = resolved.code;
        const setting = await ReferralRewardSetting.findOne({ key: 'student' }).select('instituteDiscountPercent');
        const percent = Number(setting?.instituteDiscountPercent) || 0;
        if (percent > 0) finalAmount = priceAfterPercent(finalAmount, percent);
      } else if (resolved.kind === 'student') {
        appliedStudentCode = resolved.code;
      }
    }
    if (serverPriced && cleanCouponCode) {
      const resolvedCoupon = await resolveCoupon(cleanCouponCode, req.user._id, cleanPurpose, resolvedPurposeId);
      if (resolvedCoupon.error) return next(new ErrorResponse(resolvedCoupon.error, 400));
      appliedCoupon = resolvedCoupon.coupon;
      if (appliedCoupon) {
        finalAmount = appliedCoupon.discountType === 'percent'
          ? priceAfterPercent(finalAmount, appliedCoupon.discountValue)
          : priceAfterReward(finalAmount, appliedCoupon.discountValue);
      }
    }

    let rewardDiscount = 0;
    if (serverPriced && req.user.role === 'student') {
      claimedReward = await claimNextReward(req.user._id);
      if (claimedReward) {
        const discounted = claimedReward.percent > 0
          ? priceAfterPercent(finalAmount, claimedReward.percent)
          : priceAfterReward(finalAmount, claimedReward.amount);
        rewardDiscount = Math.round((finalAmount - discounted) * 100) / 100;
        finalAmount = discounted;
      }
    }
    rewardDiscount = Math.max(0, Math.round((listPrice - finalAmount) * 100) / 100);

    if (!isPositiveNumber(finalAmount)) {
      await releaseClaimedReward(claimedReward);
      return next(new ErrorResponse('A valid positive amount is required', 400));
    }

    const amountInPaise = Math.round(finalAmount * 100);
    const receipt = generateReceipt(cleanPurpose);
    const orderNotes = serverOrderNotes(notes, {
      userId: req.user._id.toString(),
      purpose: cleanPurpose,
      courseSlug: cleanPurpose === 'course_enrollment' && resolvedPurposeId
        ? String(resolvedPurposeId)
        : (cleanCourseSlug || ''),
      referralCode: appliedReferralCode || '',
      studentReferralCode: appliedStudentCode || '',
      couponCode: appliedCoupon ? appliedCoupon.code : '',
      couponId: appliedCoupon ? String(appliedCoupon._id) : '',
    });

    // Create order on Razorpay
    const razorpayOrder = await razorpay.orders.create({
      amount: amountInPaise,
      currency: cleanCurrency,
      receipt,
      notes: orderNotes,
    });

    // Persist to DB
    const payment = await Payment.create({
      razorpayOrderId: razorpayOrder.id,
      amount: amountInPaise,
      amountInRupees: finalAmount,
      currency: cleanCurrency,
      purpose: cleanPurpose,
      purposeId: resolvedPurposeId,
      purposeModel: resolvedPurposeModel,
      userId: req.user._id,
      receipt,
      notes: orderNotes,
      status: 'created',
    });

    if (claimedReward) {
      claimedReward.reservedPaymentId = payment._id;
      await claimedReward.save();
    }

    res.status(201).json({
      success: true,
      data: {
        // Fields the frontend needs to open the Razorpay checkout
        orderId: razorpayOrder.id,
        amount: amountInPaise,
        currency: cleanCurrency,
        keyId: process.env.RAZORPAY_KEY_ID,
        receipt,
        // Internal reference
        paymentDbId: payment._id,
        // Referral info
        referralApplied: !!appliedReferralCode,
        finalAmountInRupees: finalAmount,
        rewardDiscount,
      },
    });
  } catch (err) {
    await releaseClaimedReward(claimedReward);
    console.error('Razorpay createOrder error:', err);
    next(new ErrorResponse(err.message || 'Failed to create payment order', 500));
  }
};

// @desc    Mark an unpaid checkout closed by the student as failed
// @route   POST /api/payments/cancel
// @access  Private
exports.cancelCheckout = async (req, res, next) => {
  try {
    const razorpayOrderId = sanitizeStr(String(req.body?.razorpayOrderId || ''));
    if (!razorpayOrderId) return next(new ErrorResponse('Order is required', 400));
    const payment = await Payment.findOne({ razorpayOrderId, userId: req.user._id });
    if (!payment) return next(new ErrorResponse('Payment not found', 404));
    if (payment.status === 'paid' || payment.status === 'refunded' || payment.status === 'partially_refunded') {
      return res.status(200).json({ success: true, data: { status: payment.status } });
    }
    if (payment.status === 'created' || payment.status === 'attempted') {
      payment.status = 'failed';
      payment.failedAt = new Date();
      payment.failureReason = 'Checkout closed before payment';
      await payment.save();
      await ReferralReward.updateOne(
        { reservedPaymentId: payment._id, status: 'reserved' },
        { $set: { status: 'available', reservedPaymentId: null } }
      );
    }
    res.status(200).json({ success: true, data: { status: payment.status } });
  } catch (err) {
    next(err);
  }
};

// @desc    Verify payment after Razorpay checkout success
// @route   POST /api/payments/verify
// @access  Private
exports.verifyPayment = async (req, res, next) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return next(new ErrorResponse('razorpayOrderId, razorpayPaymentId and razorpaySignature are all required', 400));
    }

    // Find the payment record
    const payment = await Payment.findOne({ razorpayOrderId });
    if (!payment) {
      return next(new ErrorResponse('Payment record not found for this order', 404));
    }

    // Verify the payment belongs to this user
    if (payment.userId.toString() !== req.user._id.toString()) {
      return next(new ErrorResponse('Not authorised to verify this payment', 403));
    }

    // Cryptographically verify signature
    const isValid = verifySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
    if (!isValid) {
      payment.status = 'failed';
      payment.failedAt = new Date();
      payment.failureReason = 'Signature verification failed';
      await payment.save();
      return next(new ErrorResponse('Payment signature verification failed', 400));
    }

    // Mark as paid
    payment.razorpayPaymentId = razorpayPaymentId;
    payment.razorpaySignature = razorpaySignature;
    payment.status = 'paid';
    payment.paidAt = new Date();
    await payment.save();

    await applyReferralAttributionForPayment(payment);
    const enrollment = await grantPaidAccess(payment);

    res.status(200).json({
      success: true,
      message: 'Payment verified successfully',
      data: { payment, enrollment },
    });
  } catch (err) {
    console.error('Razorpay verifyPayment error:', err);
    next(new ErrorResponse('Payment verification failed', 500));
  }
};

// @desc    Razorpay webhook handler
// @route   POST /api/payments/webhook
// @access  Public (verified via HMAC signature)
exports.handleWebhook = async (req, res) => {
  // req.rawBody is set by the raw body middleware added in routes
  const signature = req.headers['x-razorpay-signature'];

  if (!verifyWebhookSignature(req.rawBody, signature)) {
    console.warn('Razorpay webhook: invalid signature');
    return res.status(400).json({ success: false, message: 'Invalid webhook signature' });
  }

  const event = req.body;
  const eventType = event.event;

  try {
    switch (eventType) {
      // ── payment.captured ────────────────────────────────────────────────
      case 'payment.captured': {
        const rp = event.payload.payment.entity;
        const payment = await Payment.findOne({ razorpayOrderId: rp.order_id });
        await markPaidFromWebhook(payment, rp, eventType, rp.id);
        break;
      }

      // ── payment.failed ───────────────────────────────────────────────────
      case 'payment.failed': {
        const rp = event.payload.payment.entity;
        const payment = await Payment.findOne({ razorpayOrderId: rp.order_id });
        if (payment && payment.status !== 'paid') {
          payment.status = 'failed';
          payment.razorpayPaymentId = rp.id;
          payment.failedAt = new Date(rp.created_at * 1000);
          payment.failureReason =
            rp.error_description || rp.error_code || 'Payment failed';
          payment.webhookVerified = true;
          payment.webhookEvent = eventType;
          await payment.save();
        }
        break;
      }

      // ── order.paid ───────────────────────────────────────────────────────
      case 'order.paid': {
        const order = event.payload.order.entity;
        const payment = await Payment.findOne({ razorpayOrderId: order.id });
        await markPaidFromWebhook(payment, order, eventType);
        break;
      }

      // ── refund.created ───────────────────────────────────────────────────
      case 'refund.created': {
        const refund = event.payload.refund.entity;
        const payment = await Payment.findOne({ razorpayPaymentId: refund.payment_id });
        if (payment) {
          payment.refundId = refund.id;
          payment.refundAmount = refund.amount;
          payment.refundStatus = 'pending';
          payment.webhookEvent = eventType;
          await payment.save();
        }
        break;
      }

      // ── refund.processed ─────────────────────────────────────────────────
      case 'refund.processed': {
        const refund = event.payload.refund.entity;
        const payment = await Payment.findOne({ razorpayPaymentId: refund.payment_id });
        if (payment) {
          payment.refundId = refund.id;
          payment.refundAmount = refund.amount;
          payment.refundStatus = 'processed';
          payment.refundedAt = new Date();
          payment.status =
            refund.amount >= payment.amount ? 'refunded' : 'partially_refunded';
          payment.webhookEvent = eventType;
          await payment.save();
        }
        break;
      }

      // ── refund.failed ────────────────────────────────────────────────────
      case 'refund.failed': {
        const refund = event.payload.refund.entity;
        const payment = await Payment.findOne({ razorpayPaymentId: refund.payment_id });
        if (payment) {
          payment.refundStatus = 'failed';
          payment.webhookEvent = eventType;
          await payment.save();
        }
        break;
      }

      default:
        console.log(`Razorpay webhook: unhandled event type "${eventType}"`);
    }

    res.status(200).json({ success: true, received: true });
  } catch (err) {
    console.error('Razorpay webhook processing error:', err);
    res.status(500).json({ success: false, message: 'Webhook processing error' });
  }
};

// @desc    Get the authenticated user's payment history
// @route   GET /api/payments/my
// @access  Private
exports.getMyPayments = async (req, res, next) => {
  try {
    const { status, purpose, page = 1, limit = 20 } = req.query;

    const filter = { userId: req.user._id };
    if (status) filter.status = status;
    if (purpose) filter.purpose = purpose;

    const skip = (Number(page) - 1) * Number(limit);

    const [payments, total] = await Promise.all([
      Payment.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Payment.countDocuments(filter),
    ]);

    // Resolve a human-readable title for each payment's purchased item.
    // purposeModel tells us which collection purposeId points into.
    const modelByName = { Course, Plan, MockTest };
    const idsByModel = {};
    payments.forEach((p) => {
      if (p.purposeId && p.purposeModel && modelByName[p.purposeModel]) {
        idsByModel[p.purposeModel] = idsByModel[p.purposeModel] || new Set();
        idsByModel[p.purposeModel].add(String(p.purposeId));
      }
    });
    const titleById = {};
    await Promise.all(
      Object.entries(idsByModel).map(async ([modelName, idSet]) => {
        const docs = await modelByName[modelName]
          .find({ _id: { $in: Array.from(idSet) } })
          .select('title')
          .lean();
        docs.forEach((doc) => { titleById[String(doc._id)] = doc.title; });
      })
    );
    const dataWithTitles = payments.map((p) => ({
      ...p,
      purposeTitle: p.purposeId ? (titleById[String(p.purposeId)] || null) : null,
    }));

    res.status(200).json({
      success: true,
      count: payments.length,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      data: dataWithTitles,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get a single payment by DB ID
// @route   GET /api/payments/:id
// @access  Private (own payment) / Admin (any)
exports.getPaymentById = async (req, res, next) => {
  try {
    const payment = await Payment.findById(req.params.id).populate(
      'userId',
      'name email phone'
    );

    if (!payment) {
      return next(new ErrorResponse('Payment not found', 404));
    }

    // Non-admins can only see their own payments
    if (
      req.user.role !== 'admin' &&
      payment.userId._id.toString() !== req.user._id.toString()
    ) {
      return next(new ErrorResponse('Not authorised to view this payment', 403));
    }

    res.status(200).json({ success: true, data: payment });
  } catch (err) {
    next(err);
  }
};

// @desc    Get all payments (admin, with filters + pagination)
// @route   GET /api/payments/admin/all
// @access  Private/Admin
exports.getAllPayments = async (req, res, next) => {
  try {
    const {
      status,
      purpose,
      userId,
      from,    // ISO date string
      to,      // ISO date string
      search,  // search by razorpayOrderId or razorpayPaymentId
      page = 1,
      limit = 30,
    } = req.query;

    const filter = {};

    if (status) filter.status = status;
    if (purpose) filter.purpose = { $regex: purpose, $options: 'i' };
    if (userId) filter.userId = userId;

    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }

    if (search) {
      filter.$or = [
        { razorpayOrderId: { $regex: search, $options: 'i' } },
        { razorpayPaymentId: { $regex: search, $options: 'i' } },
        { receipt: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [payments, total] = await Promise.all([
      Payment.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate('userId', 'name email phone')
        .lean(),
      Payment.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      count: payments.length,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      data: payments,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get payment stats (admin dashboard)
// @route   GET /api/payments/admin/stats
// @access  Private/Admin
exports.getPaymentStats = async (req, res, next) => {
  try {
    const { from, to } = req.query;

    const dateFilter = {};
    if (from || to) {
      dateFilter.createdAt = {};
      if (from) dateFilter.createdAt.$gte = new Date(from);
      if (to) dateFilter.createdAt.$lte = new Date(to);
    }

    const [
      totalRevenuePaise,
      statusBreakdown,
      purposeBreakdown,
      refundTotal,
      recentPayments,
    ] = await Promise.all([
      // Total confirmed revenue
      Payment.aggregate([
        { $match: { status: 'paid', ...dateFilter } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),

      // Count by status
      Payment.aggregate([
        { $match: dateFilter },
        { $group: { _id: '$status', count: { $sum: 1 }, amount: { $sum: '$amount' } } },
        { $sort: { count: -1 } },
      ]),

      // Revenue by purpose
      Payment.aggregate([
        { $match: { status: 'paid', ...dateFilter } },
        { $group: { _id: '$purpose', count: { $sum: 1 }, amount: { $sum: '$amount' } } },
        { $sort: { amount: -1 } },
      ]),

      // Total refunded amount
      Payment.aggregate([
        { $match: { status: { $in: ['refunded', 'partially_refunded'] }, ...dateFilter } },
        { $group: { _id: null, total: { $sum: '$refundAmount' } } },
      ]),

      // Last 5 paid transactions
      Payment.find({ status: 'paid' })
        .sort({ paidAt: -1 })
        .limit(5)
        .populate('userId', 'name email')
        .lean(),
    ]);

    const totalRevenue = (totalRevenuePaise[0]?.total || 0) / 100;
    const totalRefunded = (refundTotal[0]?.total || 0) / 100;

    res.status(200).json({
      success: true,
      data: {
        totalRevenueINR: totalRevenue,
        totalRefundedINR: totalRefunded,
        netRevenueINR: totalRevenue - totalRefunded,
        statusBreakdown: statusBreakdown.map((s) => ({
          status: s._id,
          count: s.count,
          amountINR: s.amount / 100,
        })),
        purposeBreakdown: purposeBreakdown.map((p) => ({
          purpose: p._id,
          count: p.count,
          amountINR: p.amount / 100,
        })),
        recentPayments,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Initiate a full or partial refund (admin)
// @route   POST /api/payments/:id/refund
// @access  Private/Admin
exports.initiateRefund = async (req, res, next) => {
  try {
    const razorpay = getRazorpay();
    const payment = await Payment.findById(req.params.id);

    if (!payment) {
      return next(new ErrorResponse('Payment not found', 404));
    }

    if (payment.status !== 'paid') {
      return next(
        new ErrorResponse(`Cannot refund a payment with status "${payment.status}"`, 400)
      );
    }

    if (!payment.razorpayPaymentId) {
      return next(new ErrorResponse('Razorpay payment ID not recorded — cannot refund', 400));
    }

    const {
      amount,  // refund amount in rupees; omit for full refund
      reason = 'requested_by_customer',
      notes = {},
    } = req.body;

    const refundAmountPaise = amount ? Math.round(amount * 100) : payment.amount;

    if (refundAmountPaise > payment.amount) {
      return next(
        new ErrorResponse('Refund amount cannot exceed original payment amount', 400)
      );
    }

    // Call Razorpay refund API
    const refund = await razorpay.payments.refund(payment.razorpayPaymentId, {
      amount: refundAmountPaise,
      speed: 'normal',
      notes: {
        reason,
        initiatedBy: req.user.email,
        ...notes,
      },
      receipt: `ref_${payment.receipt || payment._id}`,
    });

    // Update payment record
    payment.refundId = refund.id;
    payment.refundAmount = refundAmountPaise;
    payment.refundStatus = 'pending';
    payment.refundReason = reason;
    payment.status =
      refundAmountPaise >= payment.amount ? 'refunded' : 'partially_refunded';
    await payment.save();

    res.status(200).json({
      success: true,
      message: 'Refund initiated successfully',
      data: {
        refundId: refund.id,
        refundAmountINR: refundAmountPaise / 100,
        status: refund.status,
        payment,
      },
    });
  } catch (err) {
    console.error('Razorpay refund error:', err);
    next(new ErrorResponse(err.error?.description || err.message || 'Refund failed', 500));
  }
};

// @desc    Fetch live payment details directly from Razorpay (admin)
// @route   GET /api/payments/:id/razorpay-details
// @access  Private/Admin
exports.getRazorpayDetails = async (req, res, next) => {
  try {
    const razorpay = getRazorpay();
    const payment = await Payment.findById(req.params.id);

    if (!payment) {
      return next(new ErrorResponse('Payment not found', 404));
    }

    // Fetch from Razorpay
    const [order, rpPayment] = await Promise.all([
      razorpay.orders.fetch(payment.razorpayOrderId),
      payment.razorpayPaymentId
        ? razorpay.payments.fetch(payment.razorpayPaymentId)
        : Promise.resolve(null),
    ]);

    res.status(200).json({
      success: true,
      data: {
        order,
        payment: rpPayment,
        dbRecord: payment,
      },
    });
  } catch (err) {
    console.error('Razorpay fetch details error:', err);
    next(new ErrorResponse('Failed to fetch details from Razorpay', 500));
  }
};

// @desc    Save pre-payment lead (student details captured before checkout)
// @route   POST /api/payments/save-lead
// @access  Public (no auth required — guests should be able to submit)
exports.savePrePaymentLead = async (req, res, next) => {
  try {
    const { name, phone, email, city, college, courseId, courseTitle, referralCode, source } = req.body;

    if (!name || !phone) {
      return next(new ErrorResponse('Name and phone are required', 400));
    }

    const validSources = ['popup', 'enrollment_form'];
    const leadData = {
      name: sanitizeStr(String(name)).slice(0, 120),
      phone: sanitizeStr(String(phone)).slice(0, 20),
      email: email ? sanitizeStr(String(email)).toLowerCase().slice(0, 200) : null,
      city: city ? sanitizeStr(String(city)).slice(0, 100) : null,
      college: college ? sanitizeStr(String(college)).slice(0, 200) : null,
      courseId: courseId || null,
      courseTitle: courseTitle ? sanitizeStr(String(courseTitle)).slice(0, 200) : null,
      referralCode: referralCode ? sanitizeStr(String(referralCode)).toUpperCase().slice(0, 30) : null,
      userId: req.user ? req.user._id : null,
      source: validSources.includes(source) ? source : null,
    };

    const lead = await PrePaymentLead.create(leadData);

    res.status(201).json({ success: true, data: { leadId: lead._id } });
  } catch (err) {
    next(new ErrorResponse('Failed to save lead', 500));
  }
};

// @desc    Get all pre-payment leads (admin)
// @route   GET /api/payments/leads
// @access  Private/Admin
exports.getAllLeads = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 100;
    const skip = (page - 1) * limit;

    const total = await PrePaymentLead.countDocuments();
    const leads = await PrePaymentLead.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('courseId', 'title')
      .lean();

    res.status(200).json({ success: true, total, data: leads });
  } catch (err) {
    next(new ErrorResponse('Failed to fetch leads', 500));
  }
};

// @desc    Mark a lead as converted when a payment is verified
// helper used internally
exports.markLeadConverted = async (leadId) => {
  if (!leadId) return;
  await PrePaymentLead.findByIdAndUpdate(leadId, { converted: true }).catch(() => {});
};

// @desc    Manually set a lead's converted status
// @route   PUT /api/payments/leads/:id/converted
// @access  Private/Admin
exports.setLeadConverted = async (req, res, next) => {
  try {
    const { converted } = req.body || {};
    if (typeof converted !== 'boolean') {
      return next(new ErrorResponse('converted must be true or false', 400));
    }
    const lead = await PrePaymentLead.findByIdAndUpdate(
      req.params.id,
      { $set: { converted } },
      { new: true }
    );
    if (!lead) return next(new ErrorResponse('Lead not found', 404));
    res.status(200).json({ success: true, data: lead });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete a lead
// @route   DELETE /api/payments/leads/:id
// @access  Private/Admin
exports.deleteLead = async (req, res, next) => {
  try {
    const lead = await PrePaymentLead.findByIdAndDelete(req.params.id);
    if (!lead) return next(new ErrorResponse('Lead not found', 404));
    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    next(err);
  }
};
