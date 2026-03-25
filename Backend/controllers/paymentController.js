const crypto = require('crypto');
const getRazorpay = require('../utils/razorpay');
const Payment = require('../models/Payment');
const Enrollment = require('../models/Enrollment');
const ErrorResponse = require('../utils/errorResponse');
const EmailUser = require('../models/EmailUser');
const Course = require('../models/Course');
const Referral = require('../models/Referral');
const PrePaymentLead = require('../models/PrePaymentLead');
const { sanitizeStr, isPositiveNumber, isNonEmpty } = require('../middleware/validate');

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
  return expected === signature;
};

/**
 * Verify Razorpay webhook signature.
 * signature = HMAC-SHA256( rawBody, webhookSecret )
 */
const verifyWebhookSignature = (rawBody, signature) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return false;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  return expected === signature;
};

/**
 * Persist referral attribution on user records after a successful payment.
 * Institute dashboard reads EmailUser.referrerCodeUsed, so we sync it here.
 */
const applyReferralAttributionForPayment = async (payment) => {
  if (!payment || !payment.userId) return;

  const notesObj = payment.notes instanceof Map
    ? Object.fromEntries(payment.notes)
    : (payment.notes && typeof payment.notes === 'object' ? payment.notes : {});

  const cleanReferralCode = notesObj?.referralCode
    ? sanitizeStr(String(notesObj.referralCode)).toUpperCase()
    : '';

  if (!cleanReferralCode) return;

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

// ─── Controllers ──────────────────────────────────────────────────────────────

// @desc    Create a Razorpay order
// @route   POST /api/payments/create-order
// @access  Private
exports.createOrder = async (req, res, next) => {
  try {
    const razorpay = getRazorpay();

    const {
      amount,           // in rupees (we convert to paise)
      currency = 'INR',
      purpose,          // e.g. 'course_enrollment'
      purposeId,        // ObjectId of the related resource
      purposeModel,     // e.g. 'Course'
      courseSlug,       // slug for enrollment lookup
      referralCode,     // optional institute referral code
      notes = {},       // extra key-value pairs forwarded to Razorpay
    } = req.body;

    // ── Input validation ──────────────────────────────────────────────────────
    if (!isPositiveNumber(amount)) {
      return next(new ErrorResponse('A valid positive amount is required', 400));
    }
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
    const cleanReferralCode = referralCode ? sanitizeStr(String(referralCode)) : undefined;
    // ─────────────────────────────────────────────────────────────────────────

    // ── Referral code: validate and apply referral price if available ──
    let finalAmount = amount;
    let appliedReferralCode = null;
    if (cleanReferralCode && cleanPurpose === 'course_enrollment') {
      const institute = await EmailUser.findOne({ referralCode: cleanReferralCode, role: 'institute' });
      if (institute) {
        // Look up the course's referralPrice
        const courseQuery = purposeId
          ? { _id: purposeId }
          : { _id: cleanCourseSlug };
        const course = await Course.findOne(courseQuery);
        if (course && course.referralPrice && course.referralPrice > 0) {
          finalAmount = course.referralPrice;
        }
        appliedReferralCode = cleanReferralCode;
      }
    }

    const amountInPaise = Math.round(finalAmount * 100);
    const receipt = generateReceipt(cleanPurpose);

    // Create order on Razorpay
    const razorpayOrder = await razorpay.orders.create({
      amount: amountInPaise,
      currency: cleanCurrency,
      receipt,
      notes: {
        userId: req.user._id.toString(),
        purpose: cleanPurpose,
        courseSlug: cleanCourseSlug || '',
        referralCode: appliedReferralCode || '',
        ...notes,
      },
    });

    // Persist to DB
    const payment = await Payment.create({
      razorpayOrderId: razorpayOrder.id,
      amount: amountInPaise,
      amountInRupees: finalAmount,
      currency: cleanCurrency,
      purpose: cleanPurpose,
      purposeId: purposeId || null,
      purposeModel: purposeModel || null,
      userId: req.user._id,
      receipt,
      notes: { courseSlug: cleanCourseSlug || '', referralCode: appliedReferralCode || '', ...notes },
      status: 'created',
    });

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
      },
    });
  } catch (err) {
    console.error('Razorpay createOrder error:', err);
    next(new ErrorResponse(err.message || 'Failed to create payment order', 500));
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

    // Auto-enroll if this was a course enrollment payment
    let enrollment = null;
    if (payment.purpose === 'course_enrollment') {
      const courseSlug = payment.notes?.get('courseSlug') || 'du-campus-advantage';
      try {
        enrollment = await Enrollment.findOneAndUpdate(
          { userId: payment.userId, courseSlug },
          {
            userId: payment.userId,
            courseSlug,
            courseId: payment.purposeId || null,
            paymentId: payment._id,
            razorpayOrderId: payment.razorpayOrderId,
            amountPaid: payment.amount,
            isActive: true,
            enrolledAt: new Date(),
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      } catch (enrollErr) {
        console.error('Auto-enrollment error (non-fatal):', enrollErr.message);
      }
    }

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
        if (payment && payment.status !== 'paid') {
          payment.status = 'paid';
          payment.razorpayPaymentId = rp.id;
          payment.paidAt = new Date(rp.created_at * 1000);
          payment.webhookVerified = true;
          payment.webhookEvent = eventType;
          await payment.save();
          await applyReferralAttributionForPayment(payment);
        }
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
        if (payment && payment.status !== 'paid') {
          payment.status = 'paid';
          payment.webhookVerified = true;
          payment.webhookEvent = eventType;
          await payment.save();
          await applyReferralAttributionForPayment(payment);
        }
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
    // Always return 200 to Razorpay so it doesn't retry indefinitely
    res.status(200).json({ success: false, message: 'Webhook processing error (logged)' });
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
