const Question = require('../models/Question');
const QuestionBank = require('../models/QuestionBank');
const MockTest = require('../models/MockTest');
const ErrorResponse = require('../utils/errorResponse');
const { isObjectId } = require('../middleware/validate');
const { validateMockTest } = require('../utils/mockTestValidation');

const STRUCTURAL_FIELDS = [
  'questionIds',
  'questionBankId',
  'positiveMarks',
  'negativeMarks',
  'durationMinutes',
  'shuffleQuestions',
  'shuffleOptions',
  'isFree',
  'price',
];

function applyDraft(test, value) {
  test.title = value.title;
  test.description = value.description;
  test.instructions = value.instructions;
  test.category = value.category;
  test.chapter = value.chapter;
  test.durationMinutes = value.durationMinutes;
  test.positiveMarks = value.positiveMarks;
  test.negativeMarks = value.negativeMarks;
  test.maxMarks = value.maxMarks;
  test.isFree = value.isFree;
  test.price = value.price;
  test.courseId = value.courseId;
  test.attemptLimit = value.attemptLimit;
  test.availableFrom = value.availableFrom;
  test.availableUntil = value.availableUntil;
  test.shuffleQuestions = value.shuffleQuestions;
  test.shuffleOptions = value.shuffleOptions;
  test.questionIds = value.questionIds;
  test.questionBankId = value.questionBankId;
}

async function questionsFromBank(bankId) {
  const bank = await QuestionBank.findById(bankId).select('_id').lean();
  if (!bank) return { error: 'That question bank no longer exists.' };
  const questions = await Question.find({ bankId }).sort({ _id: 1 }).select('_id').lean();
  if (questions.length > 300) {
    return { error: 'A test can include at most 300 questions. This bank has more than that.' };
  }
  return { ids: questions.map((question) => String(question._id)) };
}

async function applyLinkedBank(value) {
  if (!value.questionBankId) return null;
  const resolved = await questionsFromBank(value.questionBankId);
  if (resolved.error) return resolved.error;
  value.questionIds = resolved.ids;
  value.maxMarks = resolved.ids.length * value.positiveMarks;
  return null;
}

async function assertQuestionsExist(questionIds) {
  if (!questionIds.length) return [];
  const questions = await Question.find({ _id: { $in: questionIds } }).lean();
  if (questions.length !== questionIds.length) {
    return null;
  }
  const byId = new Map(questions.map((question) => [String(question._id), question]));
  return questionIds.map((id) => byId.get(String(id)));
}

exports.listTests = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const filter = {};
    if (req.query.status && ['draft', 'published', 'unpublished'].includes(req.query.status)) {
      filter.status = req.query.status;
    }
    const [total, tests] = await Promise.all([
      MockTest.countDocuments(filter),
      MockTest.find(filter)
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select('-publishedSnapshot')
        .lean(),
    ]);
    res.status(200).json({
      success: true,
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
      data: tests.map((test) => ({
        ...test,
        questionCount: (test.questionIds || []).length,
      })),
    });
  } catch (err) {
    next(err);
  }
};

exports.getTest = async (req, res, next) => {
  try {
    if (!isObjectId(req.params.id)) return next(new ErrorResponse('Test not found.', 404));
    const test = await MockTest.findById(req.params.id).lean();
    if (!test) return next(new ErrorResponse('Test not found.', 404));
    const questions = await Question.find({ _id: { $in: test.questionIds } })
      .select('question optionA optionB optionC optionD correctAnswer chapter')
      .lean();
    const byId = new Map(questions.map((question) => [String(question._id), question]));
    res.status(200).json({
      success: true,
      data: {
        ...test,
        questions: test.questionIds.map((id) => byId.get(String(id))).filter(Boolean),
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.createTest = async (req, res, next) => {
  try {
    const { errors, value } = validateMockTest(req.body);
    if (errors.length) return next(new ErrorResponse(errors.join(' '), 400));
    const bankError = await applyLinkedBank(value);
    if (bankError) return next(new ErrorResponse(bankError, 400));
    const questions = await assertQuestionsExist(value.questionIds);
    if (!questions) return next(new ErrorResponse('One or more selected questions no longer exist.', 400));

    const test = await MockTest.create({
      ...value,
      maxMarks: value.questionIds.length * value.positiveMarks,
      status: 'draft',
      createdBy: req.user._id,
    });
    res.status(201).json({ success: true, data: test });
  } catch (err) {
    next(err);
  }
};

exports.updateTest = async (req, res, next) => {
  try {
    if (!isObjectId(req.params.id)) return next(new ErrorResponse('Test not found.', 404));
    const test = await MockTest.findById(req.params.id);
    if (!test) return next(new ErrorResponse('Test not found.', 404));

    if (test.status === 'published' && STRUCTURAL_FIELDS.some((field) => Object.prototype.hasOwnProperty.call(req.body, field))) {
      return next(new ErrorResponse('Unpublish the test before changing questions, marks, duration, shuffling, or price. The published snapshot stays in place for attempts already using it.', 409));
    }

    const merged = {
      title: req.body.title ?? test.title,
      description: req.body.description ?? test.description,
      instructions: req.body.instructions ?? test.instructions,
      category: req.body.category ?? test.category,
      chapter: req.body.chapter ?? test.chapter,
      durationMinutes: req.body.durationMinutes ?? test.durationMinutes,
      positiveMarks: req.body.positiveMarks ?? test.positiveMarks,
      negativeMarks: req.body.negativeMarks ?? test.negativeMarks,
      attemptLimit: req.body.attemptLimit ?? test.attemptLimit,
      questionIds: req.body.questionIds ?? test.questionIds.map(String),
      questionBankId: req.body.questionBankId === undefined
        ? (test.questionBankId ? String(test.questionBankId) : '')
        : req.body.questionBankId,
      isFree: req.body.isFree ?? test.isFree,
      price: req.body.price ?? test.price,
      courseId: req.body.courseId === undefined ? (test.courseId ? String(test.courseId) : '') : req.body.courseId,
      availableFrom: req.body.availableFrom === undefined ? test.availableFrom : req.body.availableFrom,
      availableUntil: req.body.availableUntil === undefined ? test.availableUntil : req.body.availableUntil,
      shuffleQuestions: req.body.shuffleQuestions ?? test.shuffleQuestions,
      shuffleOptions: req.body.shuffleOptions ?? test.shuffleOptions,
    };

    const { errors, value } = validateMockTest(merged);
    if (errors.length) return next(new ErrorResponse(errors.join(' '), 400));
    if (test.status !== 'published') {
      const bankError = await applyLinkedBank(value);
      if (bankError) return next(new ErrorResponse(bankError, 400));
      const questions = await assertQuestionsExist(value.questionIds);
      if (!questions) return next(new ErrorResponse('One or more selected questions no longer exist.', 400));
    }
    applyDraft(test, value);
    test.maxMarks = value.questionIds.length * value.positiveMarks;
    await test.save();
    res.status(200).json({ success: true, data: test });
  } catch (err) {
    next(err);
  }
};

exports.publishTest = async (req, res, next) => {
  try {
    if (!isObjectId(req.params.id)) return next(new ErrorResponse('Test not found.', 404));
    const test = await MockTest.findById(req.params.id);
    if (!test) return next(new ErrorResponse('Test not found.', 404));

    if (test.questionBankId) {
      const resolved = await questionsFromBank(test.questionBankId);
      if (resolved.error) return next(new ErrorResponse(resolved.error, 400));
      test.questionIds = resolved.ids;
    }

    const { errors, value } = validateMockTest({
      ...test.toObject(),
      questionIds: test.questionIds.map(String),
      questionBankId: test.questionBankId ? String(test.questionBankId) : '',
      courseId: test.courseId ? String(test.courseId) : '',
    }, { publishing: true });
    if (errors.length) return next(new ErrorResponse(errors.join(' '), 400));

    const questions = await assertQuestionsExist(value.questionIds);
    if (!questions) return next(new ErrorResponse('One or more selected questions no longer exist.', 400));

    test.publishedSnapshot = questions.map((question, index) => ({
      questionId: question._id,
      order: index + 1,
      question: question.question,
      optionA: question.optionA,
      optionB: question.optionB,
      optionC: question.optionC,
      optionD: question.optionD,
      correctAnswer: question.correctAnswer,
      chapter: question.chapter || '',
      remarks: question.remarks || '',
    }));
    test.snapshotVersion += 1;
    test.maxMarks = test.publishedSnapshot.length * test.positiveMarks;
    test.status = 'published';
    test.publishedAt = new Date();
    await test.save();

    res.status(200).json({
      success: true,
      data: {
        _id: test._id,
        status: test.status,
        snapshotVersion: test.snapshotVersion,
        questionCount: test.publishedSnapshot.length,
        maxMarks: test.maxMarks,
        publishedAt: test.publishedAt,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.unpublishTest = async (req, res, next) => {
  try {
    if (!isObjectId(req.params.id)) return next(new ErrorResponse('Test not found.', 404));
    const test = await MockTest.findById(req.params.id);
    if (!test) return next(new ErrorResponse('Test not found.', 404));
    if (test.status !== 'published') {
      return next(new ErrorResponse('Only a published test can be unpublished.', 400));
    }
    test.status = 'unpublished';
    await test.save();
    res.status(200).json({ success: true, data: { _id: test._id, status: test.status, snapshotVersion: test.snapshotVersion } });
  } catch (err) {
    next(err);
  }
};

exports.deleteTest = async (req, res, next) => {
  try {
    if (!isObjectId(req.params.id)) return next(new ErrorResponse('Test not found.', 404));
    const test = await MockTest.findById(req.params.id);
    if (!test) return next(new ErrorResponse('Test not found.', 404));
    if (test.status === 'published') {
      return next(new ErrorResponse('Unpublish the test before deleting it.', 409));
    }
    await test.deleteOne();
    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    next(err);
  }
};
