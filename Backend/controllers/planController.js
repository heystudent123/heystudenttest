const mongoose = require('mongoose');
const Plan = require('../models/Plan');
const MockTest = require('../models/MockTest');
const Course = require('../models/Course');
const ErrorResponse = require('../utils/errorResponse');
const { isObjectId } = require('../middleware/validate');

function uniqueIds(values) {
  if (!Array.isArray(values)) return [];
  const seen = new Set();
  const ids = [];
  values.forEach((value) => {
    const id = String(value || '').trim();
    if (!isObjectId(id) || seen.has(id)) return;
    seen.add(id);
    ids.push(new mongoose.Types.ObjectId(id));
  });
  return ids;
}

async function readPlan(body) {
  const title = String(body.title || '').trim();
  const description = String(body.description || '').trim();
  const price = Number(body.price);
  const mockTestIds = uniqueIds(body.mockTestIds);
  const courseIds = uniqueIds(body.courseIds);
  const errors = [];
  if (!title || title.length > 160) errors.push('A plan title is required.');
  if (description.length > 2000) errors.push('The description is too long.');
  if (!Number.isFinite(price) || price <= 0 || price > 100000) errors.push('Enter a price greater than 0.');
  if (!mockTestIds.length && !courseIds.length) errors.push('Add at least one mock test or course.');
  if (errors.length) return { errors };

  const [tests, courses] = await Promise.all([
    mockTestIds.length ? MockTest.find({ _id: { $in: mockTestIds } }).select('_id').lean() : [],
    courseIds.length ? Course.find({ _id: { $in: courseIds } }).select('_id').lean() : [],
  ]);
  if (tests.length !== mockTestIds.length) errors.push('One of the mock tests no longer exists.');
  if (courses.length !== courseIds.length) errors.push('One of the courses no longer exists.');
  if (errors.length) return { errors };
  return { value: { title, description, price, mockTestIds, courseIds } };
}

function present(plan) {
  return {
    _id: plan._id,
    title: plan.title,
    description: plan.description || '',
    price: plan.price,
    status: plan.status,
    mockTestIds: plan.mockTestIds || [],
    courseIds: plan.courseIds || [],
    updatedAt: plan.updatedAt,
  };
}

exports.listPlans = async (req, res, next) => {
  try {
    const plans = await Plan.find().sort({ updatedAt: -1 }).lean();
    res.status(200).json({ success: true, data: plans.map(present) });
  } catch (err) {
    next(err);
  }
};

// @desc    List published plans with their bundled courses/tests expanded —
//          used by the public Courses page to show plan bundle cards.
// @route   GET /api/plans/public
// @access  Public
exports.listPublishedPlans = async (req, res, next) => {
  try {
    const plans = await Plan.find({ status: 'published' })
      .sort({ createdAt: -1 })
      .populate('mockTestIds', 'title durationMinutes questionCount category chapter')
      .populate('courseIds', 'title subtitle category image')
      .lean();
    res.status(200).json({
      success: true,
      data: plans.map((plan) => ({
        _id: plan._id,
        title: plan.title,
        description: plan.description || '',
        price: plan.price,
        mockTests: (plan.mockTestIds || []).map((test) => ({
          _id: test._id,
          title: test.title,
          durationMinutes: test.durationMinutes,
          category: test.category,
          chapter: test.chapter,
        })),
        courses: (plan.courseIds || []).map((course) => ({
          _id: course._id,
          title: course.title,
          subtitle: course.subtitle || '',
          category: course.category,
          image: course.image || '',
        })),
      })),
    });
  } catch (err) {
    next(err);
  }
};

exports.createPlan = async (req, res, next) => {
  try {
    const parsed = await readPlan(req.body);
    if (parsed.errors) return next(new ErrorResponse(parsed.errors.join(' '), 400));
    const plan = await Plan.create({ ...parsed.value, createdBy: req.user._id });
    res.status(201).json({ success: true, data: present(plan) });
  } catch (err) {
    next(err);
  }
};

exports.updatePlan = async (req, res, next) => {
  try {
    if (!isObjectId(req.params.id)) return next(new ErrorResponse('Plan not found.', 404));
    const plan = await Plan.findById(req.params.id);
    if (!plan) return next(new ErrorResponse('Plan not found.', 404));
    const parsed = await readPlan(req.body);
    if (parsed.errors) return next(new ErrorResponse(parsed.errors.join(' '), 400));
    plan.set(parsed.value);
    await plan.save();
    res.status(200).json({ success: true, data: present(plan) });
  } catch (err) {
    next(err);
  }
};

exports.publishPlan = async (req, res, next) => {
  try {
    if (!isObjectId(req.params.id)) return next(new ErrorResponse('Plan not found.', 404));
    const plan = await Plan.findById(req.params.id);
    if (!plan) return next(new ErrorResponse('Plan not found.', 404));
    if (!plan.mockTestIds.length && !plan.courseIds.length) {
      return next(new ErrorResponse('Add a mock test or a course before publishing.', 400));
    }
    plan.status = 'published';
    await plan.save();
    res.status(200).json({ success: true, data: present(plan) });
  } catch (err) {
    next(err);
  }
};

exports.unpublishPlan = async (req, res, next) => {
  try {
    if (!isObjectId(req.params.id)) return next(new ErrorResponse('Plan not found.', 404));
    const plan = await Plan.findByIdAndUpdate(req.params.id, { status: 'unpublished' }, { new: true });
    if (!plan) return next(new ErrorResponse('Plan not found.', 404));
    res.status(200).json({ success: true, data: present(plan) });
  } catch (err) {
    next(err);
  }
};

exports.deletePlan = async (req, res, next) => {
  try {
    if (!isObjectId(req.params.id)) return next(new ErrorResponse('Plan not found.', 404));
    const plan = await Plan.findById(req.params.id);
    if (!plan) return next(new ErrorResponse('Plan not found.', 404));
    if (plan.status === 'published') return next(new ErrorResponse('Unpublish the plan before deleting it.', 400));
    await plan.deleteOne();
    res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
};
