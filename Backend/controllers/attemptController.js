const MockTest = require('../models/MockTest');
const TestAttempt = require('../models/TestAttempt');
const Payment = require('../models/Payment');
const Enrollment = require('../models/Enrollment');
const Plan = require('../models/Plan');
const Question = require('../models/Question');
const ErrorResponse = require('../utils/errorResponse');
const { isObjectId } = require('../middleware/validate');
const { scoreAttempt } = require('../utils/scoreAttempt');
const { availabilityClauses, subjectLabel, toCatalogCard } = require('../utils/mockTestCatalog');
const { shuffleSnapshot } = require('../utils/shuffleAttempt');

function missingProfile(user) {
  const missing = [];
  if (!user.name || !String(user.name).trim()) missing.push('name');
  if (!user.city || !String(user.city).trim()) missing.push('city');
  const whatsapp = String(user.whatsapp || '').replace(/\D/g, '');
  if (whatsapp.length < 10) missing.push('whatsapp');
  return missing;
}

function publicQuestion(question) {
  return {
    order: question.order,
    question: question.question,
    optionA: question.optionA,
    optionB: question.optionB,
    optionC: question.optionC,
    optionD: question.optionD,
    chapter: question.chapter || '',
  };
}

function toClient(attempt) {
  const finished = attempt.status !== 'in_progress';
  return {
    _id: attempt._id,
    mockTestId: attempt.mockTestId,
    testTitle: attempt.testTitle,
    subject: attempt.subject || '',
    attemptNumber: attempt.attemptNumber,
    isPreview: Boolean(attempt.isPreview),
    status: attempt.status,
    endReason: attempt.endReason,
    startedAt: attempt.startedAt,
    deadlineAt: attempt.deadlineAt,
    submittedAt: attempt.submittedAt,
    positiveMarks: attempt.positiveMarks,
    negativeMarks: attempt.negativeMarks,
    durationMinutes: attempt.durationMinutes,
    questions: finished ? undefined : attempt.questions.map(publicQuestion),
    responses: (attempt.responses || []).map((response) => ({
      order: response.order,
      selected: response.selected,
      markedForReview: response.markedForReview,
      visited: response.visited,
    })),
    result: finished ? attempt.result : undefined,
  };
}

async function resumeIfPaused(attempt) {
  if (attempt.status !== 'paused') return attempt;
  const now = new Date();
  const pausedMs = attempt.pausedAt ? Math.max(0, now.getTime() - new Date(attempt.pausedAt).getTime()) : 0;
  const nextDeadline = new Date(new Date(attempt.deadlineAt).getTime() + pausedMs);
  const updated = await TestAttempt.findOneAndUpdate(
    { _id: attempt._id, status: 'paused' },
    { $set: { status: 'in_progress', pausedAt: null, deadlineAt: nextDeadline } },
    { new: true }
  );
  return updated || attempt;
}

async function finalizeAttempt(attempt, requestedReason) {
  if (attempt.status !== 'in_progress') return attempt;

  const now = new Date();
  const timedOut = now.getTime() >= new Date(attempt.deadlineAt).getTime();
  const endReason = timedOut ? 'timeout' : requestedReason;
  const submittedAt = timedOut ? attempt.deadlineAt : now;
  const result = scoreAttempt({
    questions: attempt.questions,
    responses: attempt.responses,
    positiveMarks: attempt.positiveMarks,
    negativeMarks: attempt.negativeMarks,
    startedAt: attempt.startedAt,
    submittedAt,
  });

  const update = {
    status: endReason === 'manual' ? 'submitted' : 'auto_submitted',
    endReason,
    submittedAt,
    result,
  };
  // Preview attempts (admin "try this test" runs) self-delete a few minutes
  // after they finish — long enough to view the result, never kept around.
  if (attempt.isPreview) {
    update.expiresAt = new Date(now.getTime() + 10 * 60 * 1000);
  }

  const updated = await TestAttempt.findOneAndUpdate(
    { _id: attempt._id, status: 'in_progress' },
    { $set: update },
    { new: true }
  );

  return updated || TestAttempt.findById(attempt._id);
}

async function ownedPlanTestIds(user) {
  if (!user) return new Set();
  const payments = await Payment.find({
    userId: user._id,
    status: 'paid',
    purpose: 'plan',
  }).select('purposeId').lean();
  const planIds = payments.map((payment) => payment.purposeId).filter(Boolean);
  if (!planIds.length) return new Set();
  const plans = await Plan.find({ _id: { $in: planIds } }).select('mockTestIds').lean();
  const ids = new Set();
  plans.forEach((plan) => {
    (plan.mockTestIds || []).forEach((id) => ids.add(String(id)));
  });
  return ids;
}

async function userCanAccess(user, test) {
  if (test.isFree) return true;
  if (!user) return false;
  const paid = await Payment.exists({
    userId: user._id,
    status: 'paid',
    purpose: 'mock_test',
    purposeId: test._id,
  });
  if (paid) return true;
  const fromPlans = await ownedPlanTestIds(user);
  if (fromPlans.has(String(test._id))) return true;
  if (!test.courseId) return false;
  const enrolled = await Enrollment.exists({
    userId: user._id,
    courseId: test.courseId,
    isActive: true,
  });
  return Boolean(enrolled);
}

async function accessByTest(user, tests) {
  const map = new Map();
  if (!tests.length) return map;
  const ids = tests.map((test) => test._id);
  const attempts = user
    ? await TestAttempt.find({ userId: user._id, mockTestId: { $in: ids }, isPreview: { $ne: true } }).select('mockTestId status').lean()
    : [];
  const paidIds = new Set();
  const courseIds = new Set();
  if (user) {
    const paidTests = tests.filter((test) => !test.isFree);
    if (paidTests.length) {
      const payments = await Payment.find({
        userId: user._id,
        status: 'paid',
        purpose: 'mock_test',
        purposeId: { $in: paidTests.map((test) => test._id) },
      }).select('purposeId').lean();
      payments.forEach((payment) => paidIds.add(String(payment.purposeId)));
    }
    const linkedCourses = [...new Set(tests.map((test) => test.courseId).filter(Boolean).map(String))];
    if (linkedCourses.length) {
      const enrollments = await Enrollment.find({
        userId: user._id,
        isActive: true,
        courseId: { $in: linkedCourses },
      }).select('courseId').lean();
      enrollments.forEach((enrollment) => courseIds.add(String(enrollment.courseId)));
    }
  }
  const planTestIds = await ownedPlanTestIds(user);

  tests.forEach((test) => {
    const mine = attempts.filter((attempt) => String(attempt.mockTestId) === String(test._id));
    const inProgress = mine.find((attempt) => attempt.status === 'in_progress' || attempt.status === 'paused');
    const finished = mine.filter((attempt) => attempt.status !== 'in_progress' && attempt.status !== 'paused').length;
    const hasAccess = Boolean(test.isFree)
      || paidIds.has(String(test._id))
      || planTestIds.has(String(test._id))
      || (test.courseId && courseIds.has(String(test.courseId)));
    map.set(String(test._id), {
      hasAccess,
      attemptsUsed: finished,
      inProgressAttemptId: inProgress ? inProgress._id : null,
    });
  });
  return map;
}

exports.listSubjects = async (req, res, next) => {
  try {
    const now = new Date();
    const rows = await MockTest.aggregate([
      { $match: { status: 'published', $and: availabilityClauses(now) } },
      {
        $project: {
          subject: {
            $let: {
              vars: {
                chapter: { $trim: { input: { $ifNull: ['$chapter', ''] } } },
                category: { $trim: { input: { $ifNull: ['$category', ''] } } },
              },
              in: {
                $cond: [
                  { $gt: [{ $strLenCP: '$$chapter' }, 0] },
                  '$$chapter',
                  { $cond: [{ $gt: [{ $strLenCP: '$$category' }, 0] }, '$$category', 'General'] },
                ],
              },
            },
          },
        },
      },
      { $group: { _id: '$subject', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    const data = rows.map((row) => ({ subject: row._id, count: row.count }));
    res.status(200).json({
      success: true,
      total: data.reduce((sum, row) => sum + row.count, 0),
      data,
    });
  } catch (err) {
    next(err);
  }
};

exports.listCatalog = async (req, res, next) => {
  try {
    const now = new Date();
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const filter = { status: 'published', $and: availabilityClauses(now) };
    const subject = String(req.query.subject || '').trim();
    const q = String(req.query.q || '').trim().toLowerCase();

    const [allTests, publishedPlans] = await Promise.all([
      MockTest.aggregate([
        { $match: filter },
        {
          $project: {
            title: 1,
            description: 1,
            category: 1,
            chapter: 1,
            durationMinutes: 1,
            maxMarks: 1,
            isFree: 1,
            price: 1,
            courseId: 1,
            attemptLimit: 1,
            createdAt: 1,
            questionCount: { $size: { $ifNull: ['$publishedSnapshot', []] } },
          },
        },
      ]),
      Plan.find({ status: 'published' }).select('title price mockTestIds courseIds').lean(),
    ]);
    const access = await accessByTest(req.user, allTests);
    const offersFor = (testId) => publishedPlans
      .filter((plan) => (plan.mockTestIds || []).some((id) => String(id) === String(testId)))
      .map((plan) => ({
        _id: plan._id,
        title: plan.title,
        price: plan.price,
        testCount: (plan.mockTestIds || []).length,
        courseCount: (plan.courseIds || []).length,
      }));
    const progress = { total: allTests.length, unlocked: 0, attempted: 0 };
    allTests.forEach((test) => {
      const entry = access.get(String(test._id));
      if (entry) entry.offers = offersFor(test._id);
      if (entry && entry.hasAccess) progress.unlocked += 1;
      if (entry && (entry.attemptsUsed > 0 || entry.inProgressAttemptId)) progress.attempted += 1;
    });
    const tests = allTests.filter((test) => {
      if (subject && subject.toLowerCase() !== 'all' && subjectLabel(test).toLowerCase() !== subject.toLowerCase()) return false;
      if (!q) return true;
      return [test.title, test.chapter, test.category].some((value) => String(value || '').toLowerCase().includes(q));
    });
    tests.sort((left, right) => {
      const leftAccess = access.get(String(left._id));
      const rightAccess = access.get(String(right._id));
      const leftRank = (leftAccess && leftAccess.hasAccess ? 2 : 0) + (left.isFree ? 1 : 0);
      const rightRank = (rightAccess && rightAccess.hasAccess ? 2 : 0) + (right.isFree ? 1 : 0);
      if (leftRank !== rightRank) return rightRank - leftRank;
      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    });
    const total = tests.length;
    const pageTests = tests.slice((page - 1) * limit, page * limit);
    res.status(200).json({
      success: true,
      checkoutAvailable: Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
      progress,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
      total,
      count: pageTests.length,
      data: pageTests.map((test) => toCatalogCard(test, access.get(String(test._id)))),
    });
  } catch (err) {
    next(err);
  }
};

exports.listAvailable = async (req, res, next) => {
  try {
    const now = new Date();
    const tests = await MockTest.find({
      status: 'published',
      isFree: true,
      $and: [
        { $or: [{ availableFrom: null }, { availableFrom: { $lte: now } }] },
        { $or: [{ availableUntil: null }, { availableUntil: { $gte: now } }] },
      ],
    }).select('title description instructions category chapter durationMinutes positiveMarks negativeMarks maxMarks attemptLimit publishedSnapshot').lean();

    const attempts = await TestAttempt.find({ userId: req.user._id, isPreview: { $ne: true } }).select('mockTestId status attemptNumber').lean();
    const data = tests.map((test) => {
      const mine = attempts.filter((attempt) => String(attempt.mockTestId) === String(test._id));
      const inProgress = mine.find((attempt) => attempt.status === 'in_progress' || attempt.status === 'paused');
      const finished = mine.filter((attempt) => attempt.status !== 'in_progress' && attempt.status !== 'paused').length;
      return {
        _id: test._id,
        title: test.title,
        description: test.description,
        category: test.category,
        chapter: test.chapter,
        durationMinutes: test.durationMinutes,
        positiveMarks: test.positiveMarks,
        negativeMarks: test.negativeMarks,
        maxMarks: test.maxMarks,
        questionCount: (test.publishedSnapshot || []).length,
        attemptLimit: test.attemptLimit,
        attemptsUsed: finished,
        inProgressAttemptId: inProgress ? inProgress._id : null,
      };
    });

    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

exports.getInstructions = async (req, res, next) => {
  try {
    if (!isObjectId(req.params.id)) return next(new ErrorResponse('Test not found.', 404));
    const test = await MockTest.findOne({ _id: req.params.id, status: 'published' })
      .select('title description instructions category chapter durationMinutes positiveMarks negativeMarks maxMarks attemptLimit isFree price courseId publishedSnapshot')
      .lean();
    if (!test) return next(new ErrorResponse('Test not found.', 404));
    const hasAccess = await userCanAccess(req.user, test);
    res.status(200).json({
      success: true,
      data: {
        _id: test._id,
        title: test.title,
        description: test.description,
        instructions: test.instructions,
        category: test.category,
        subject: subjectLabel(test),
        durationMinutes: test.durationMinutes,
        positiveMarks: test.positiveMarks,
        negativeMarks: test.negativeMarks,
        maxMarks: test.maxMarks,
        questionCount: (test.publishedSnapshot || []).length,
        attemptLimit: test.attemptLimit,
        isFree: test.isFree,
        price: test.isFree ? 0 : test.price,
        hasAccess,
        checkoutAvailable: false,
        profileMissing: missingProfile(req.user),
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.startAttempt = async (req, res, next) => {
  try {
    const mockTestId = req.body.mockTestId;
    if (!isObjectId(mockTestId)) return next(new ErrorResponse('Test not found.', 404));

    const missing = missingProfile(req.user);
    if (missing.length) {
      return res.status(400).json({
        success: false,
        code: 'PROFILE_INCOMPLETE',
        missing,
        error: 'Add your name, city, and WhatsApp number before starting a test.',
      });
    }

    const test = await MockTest.findById(mockTestId);
    if (!test || test.status !== 'published') return next(new ErrorResponse('This test is not available.', 404));
    if (!(await userCanAccess(req.user, test))) {
      return res.status(403).json({
        success: false,
        code: 'CHECKOUT_UNAVAILABLE',
        error: 'This test requires a verified purchase. Mock test checkout is not connected yet, so this page cannot unlock it.',
      });
    }
    const now = new Date();
    if (test.availableFrom && now < test.availableFrom) return next(new ErrorResponse('This test is not open yet.', 403));
    if (test.availableUntil && now > test.availableUntil) return next(new ErrorResponse('This test is closed.', 403));
    if (!test.publishedSnapshot.length) return next(new ErrorResponse('This test has no questions.', 400));

    const existing = await TestAttempt.findOne({
      userId: req.user._id,
      mockTestId,
      status: { $in: ['in_progress', 'paused'] },
      isPreview: { $ne: true },
    });
    if (existing) {
      const resumed = await resumeIfPaused(existing);
      if (now >= resumed.deadlineAt) {
        await finalizeAttempt(resumed, 'timeout');
      } else {
        return res.status(200).json({ success: true, data: toClient(resumed) });
      }
    }

    if (test.attemptLimit > 0) {
      const used = await TestAttempt.countDocuments({
        userId: req.user._id,
        mockTestId,
        status: { $in: ['submitted', 'auto_submitted'] },
        isPreview: { $ne: true },
      });
      if (used >= test.attemptLimit) {
        return next(new ErrorResponse('You have used every attempt for this test.', 403));
      }
    }

    const attemptNumber = await TestAttempt.countDocuments({ userId: req.user._id, mockTestId, isPreview: { $ne: true } }) + 1;
    const deadlineAt = new Date(now.getTime() + test.durationMinutes * 60 * 1000);
    const questions = shuffleSnapshot(test.publishedSnapshot);
    const attempt = await TestAttempt.create({
      userId: req.user._id,
      mockTestId,
      testTitle: test.title,
      subject: subjectLabel(test),
      attemptNumber,
      startedAt: now,
      deadlineAt,
      positiveMarks: test.positiveMarks,
      negativeMarks: test.negativeMarks,
      durationMinutes: test.durationMinutes,
      questions,
      responses: questions.map((question, index) => ({
        order: question.order,
        selected: null,
        markedForReview: false,
        visited: index === 0,
      })),
    });

    res.status(201).json({ success: true, data: toClient(attempt) });
  } catch (err) {
    next(err);
  }
};

// @desc    Admin "try this test" run — identical lockdown and scoring, never
//          counted against attemptLimit, never shown in attempt history, and
//          auto-deleted shortly after it finishes. Works for draft tests too.
// @route   POST /api/attempts/preview
// @access  Private/Admin
exports.startPreviewAttempt = async (req, res, next) => {
  try {
    const mockTestId = req.body.mockTestId;
    if (!isObjectId(mockTestId)) return next(new ErrorResponse('Test not found.', 404));

    const test = await MockTest.findById(mockTestId);
    if (!test) return next(new ErrorResponse('Test not found.', 404));

    const now = new Date();
    const existing = await TestAttempt.findOne({
      userId: req.user._id,
      mockTestId,
      status: 'in_progress',
      isPreview: true,
    });
    if (existing) {
      if (now >= existing.deadlineAt) {
        await finalizeAttempt(existing, 'timeout');
      } else {
        return res.status(200).json({ success: true, data: toClient(existing) });
      }
    }

    let snapshot;
    if (test.status === 'published' && test.publishedSnapshot.length) {
      snapshot = test.publishedSnapshot;
    } else {
      const questions = await Question.find({ _id: { $in: test.questionIds } }).lean();
      if (!questions.length) return next(new ErrorResponse('This test has no questions yet.', 400));
      const byId = new Map(questions.map((question) => [String(question._id), question]));
      snapshot = test.questionIds
        .map((id, index) => {
          const question = byId.get(String(id));
          if (!question) return null;
          return {
            questionId: question._id,
            order: index + 1,
            question: question.question,
            optionA: question.optionA,
            optionB: question.optionB,
            optionC: question.optionC,
            optionD: question.optionD,
            correctAnswer: question.correctAnswer,
            chapter: question.chapter || '',
          };
        })
        .filter(Boolean);
    }
    if (!snapshot.length) return next(new ErrorResponse('This test has no questions yet.', 400));

    const deadlineAt = new Date(now.getTime() + test.durationMinutes * 60 * 1000);
    const shuffled = shuffleSnapshot(snapshot);
    const attempt = await TestAttempt.create({
      userId: req.user._id,
      mockTestId,
      testTitle: test.title,
      subject: subjectLabel(test),
      attemptNumber: 0,
      isPreview: true,
      startedAt: now,
      deadlineAt,
      positiveMarks: test.positiveMarks,
      negativeMarks: test.negativeMarks,
      durationMinutes: test.durationMinutes,
      questions: shuffled,
      responses: shuffled.map((question, index) => ({
        order: question.order,
        selected: null,
        markedForReview: false,
        visited: index === 0,
      })),
    });

    res.status(201).json({ success: true, data: toClient(attempt) });
  } catch (err) {
    next(err);
  }
};

// @desc    List the signed-in user's own test attempts (history), newest first
// @route   GET /api/attempts/my
// @access  Private
exports.listMyAttempts = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const filter = { userId: req.user._id, isPreview: { $ne: true } };
    if (req.query.mockTestId && isObjectId(req.query.mockTestId)) {
      filter.mockTestId = req.query.mockTestId;
    }

    const [attempts, total] = await Promise.all([
      TestAttempt.find(filter)
        .select('mockTestId testTitle attemptNumber status endReason startedAt deadlineAt submittedAt durationMinutes result createdAt')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      TestAttempt.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      count: attempts.length,
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
      data: attempts.map((attempt) => ({
        _id: attempt._id,
        mockTestId: attempt.mockTestId,
        testTitle: attempt.testTitle,
        attemptNumber: attempt.attemptNumber,
        status: attempt.status,
        endReason: attempt.endReason,
        startedAt: attempt.startedAt,
        deadlineAt: attempt.deadlineAt,
        submittedAt: attempt.submittedAt,
        durationMinutes: attempt.durationMinutes,
        createdAt: attempt.createdAt,
        result: attempt.status === 'in_progress' ? null : (attempt.result ? {
          totalQuestions: attempt.result.totalQuestions,
          attempted: attempt.result.attempted,
          correct: attempt.result.correct,
          incorrect: attempt.result.incorrect,
          unanswered: attempt.result.unanswered,
          score: attempt.result.score,
          maxMarks: attempt.result.maxMarks,
          percentage: attempt.result.percentage,
          accuracy: attempt.result.accuracy,
          timeTakenSeconds: attempt.result.timeTakenSeconds,
        } : null),
      })),
    });
  } catch (err) {
    next(err);
  }
};

exports.getAttempt = async (req, res, next) => {
  try {
    if (!isObjectId(req.params.id)) return next(new ErrorResponse('Attempt not found.', 404));
    let attempt = await TestAttempt.findOne({ _id: req.params.id, userId: req.user._id });
    if (!attempt) return next(new ErrorResponse('Attempt not found.', 404));
    attempt = await resumeIfPaused(attempt);
    if (attempt.status === 'in_progress' && new Date() >= attempt.deadlineAt) {
      attempt = await finalizeAttempt(attempt, 'timeout');
    }
    res.status(200).json({ success: true, data: toClient(attempt) });
  } catch (err) {
    next(err);
  }
};

// @desc    Pause an in-progress attempt — the only deliberate way to leave
//          the exam screen without the leave-screen rule auto-submitting it.
//          The clock stops: resuming (reopening the attempt) shifts the
//          deadline forward by however long it was paused.
// @route   POST /api/attempts/:id/pause
// @access  Private
exports.pauseAttempt = async (req, res, next) => {
  try {
    if (!isObjectId(req.params.id)) return next(new ErrorResponse('Attempt not found.', 404));
    const attempt = await TestAttempt.findOne({ _id: req.params.id, userId: req.user._id });
    if (!attempt) return next(new ErrorResponse('Attempt not found.', 404));
    if (attempt.status !== 'in_progress') {
      return res.status(200).json({ success: true, data: toClient(attempt) });
    }
    if (new Date() >= attempt.deadlineAt) {
      const finished = await finalizeAttempt(attempt, 'timeout');
      return res.status(200).json({ success: true, data: toClient(finished), timedOut: true });
    }
    const updated = await TestAttempt.findOneAndUpdate(
      { _id: attempt._id, status: 'in_progress' },
      { $set: { status: 'paused', pausedAt: new Date() } },
      { new: true }
    );
    res.status(200).json({ success: true, data: toClient(updated || attempt) });
  } catch (err) {
    next(err);
  }
};

exports.saveResponse = async (req, res, next) => {
  try {
    if (!isObjectId(req.params.id)) return next(new ErrorResponse('Attempt not found.', 404));
    const attempt = await TestAttempt.findOne({ _id: req.params.id, userId: req.user._id });
    if (!attempt) return next(new ErrorResponse('Attempt not found.', 404));
    if (attempt.status !== 'in_progress') {
      return res.status(200).json({ success: true, data: toClient(attempt) });
    }
    if (new Date() >= attempt.deadlineAt) {
      const finished = await finalizeAttempt(attempt, 'timeout');
      return res.status(200).json({ success: true, data: toClient(finished), timedOut: true });
    }

    const order = Number(req.body.order);
    let selected = req.body.selected;
    if (selected === '' || selected === null || selected === undefined) selected = null;
    else selected = String(selected).toUpperCase();
    if (selected && !['A', 'B', 'C', 'D'].includes(selected)) {
      return next(new ErrorResponse('Choose A, B, C, or D.', 400));
    }

    const markedForReview = Boolean(req.body.markedForReview);
    const updated = await TestAttempt.findOneAndUpdate(
      {
        _id: req.params.id,
        userId: req.user._id,
        status: 'in_progress',
        deadlineAt: { $gt: new Date() },
        'responses.order': order,
      },
      {
        $set: {
          'responses.$.selected': selected,
          'responses.$.markedForReview': markedForReview,
          'responses.$.visited': true,
        },
      },
      { new: true }
    );

    if (updated) {
      return res.status(200).json({ success: true, data: { deadlineAt: updated.deadlineAt } });
    }

    const current = await TestAttempt.findOne({ _id: req.params.id, userId: req.user._id });
    if (!current) return next(new ErrorResponse('Attempt not found.', 404));
    if (current.status !== 'in_progress') {
      return res.status(200).json({ success: true, data: toClient(current) });
    }
    if (new Date() >= current.deadlineAt) {
      const finished = await finalizeAttempt(current, 'timeout');
      return res.status(200).json({ success: true, data: toClient(finished), timedOut: true });
    }
    if (!current.questions.some((item) => item.order === order)) {
      return next(new ErrorResponse('That question is not part of this attempt.', 400));
    }

    await TestAttempt.updateOne(
      { _id: current._id, status: 'in_progress' },
      { $push: { responses: { order, selected, markedForReview, visited: true } } }
    );
    res.status(200).json({ success: true, data: { deadlineAt: current.deadlineAt } });
  } catch (err) {
    next(err);
  }
};

exports.submitAttempt = async (req, res, next) => {
  try {
    if (!isObjectId(req.params.id)) return next(new ErrorResponse('Attempt not found.', 404));
    const attempt = await TestAttempt.findOne({ _id: req.params.id, userId: req.user._id });
    if (!attempt) return next(new ErrorResponse('Attempt not found.', 404));

    const requested = ['manual', 'left_screen', 'timeout'].includes(req.body.reason) ? req.body.reason : 'manual';
    const finished = await finalizeAttempt(attempt, requested);
    res.status(200).json({ success: true, data: toClient(finished) });
  } catch (err) {
    next(err);
  }
};
