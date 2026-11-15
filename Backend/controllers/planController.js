const mongoose = require('mongoose');
const Plan = require('../models/Plan');
const Bundle = require('../models/Bundle');
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
  const bundleIds = uniqueIds(body.bundleIds);
  const courseIds = uniqueIds(body.courseIds);
  const mockTestIds = uniqueIds(body.mockTestIds);
  const errors = [];
  if (!title || title.length > 160) errors.push('A plan title is required.');
  if (description.length > 2000) errors.push('The description is too long.');
  if (!Number.isFinite(price) || price <= 0 || price > 100000) errors.push('Enter a price greater than 0.');
  if (!bundleIds.length && !courseIds.length && !mockTestIds.length) {
    errors.push('Add at least one bundle, mock test, or course.');
  }
  if (errors.length) return { errors };

  const [bundles, courses, tests] = await Promise.all([
    bundleIds.length ? Bundle.find({ _id: { $in: bundleIds } }).select('_id').lean() : [],
    courseIds.length ? Course.find({ _id: { $in: courseIds } }).select('_id').lean() : [],
    mockTestIds.length ? MockTest.find({ _id: { $in: mockTestIds } }).select('_id title saleType isFree').lean() : [],
  ]);
  if (bundles.length !== bundleIds.length) errors.push('One of the bundles no longer exists.');
  if (courses.length !== courseIds.length) errors.push('One of the courses no longer exists.');
  if (tests.length !== mockTestIds.length) errors.push('One of the mock tests no longer exists.');
  const bundleOnly = tests.filter((test) => {
    if (test.saleType === 'bundle') return true;
    if (test.saleType === 'free' || test.saleType === 'paid') return false;
    return false;
  });
  if (bundleOnly.length) {
    errors.push('Bundle-only mock tests must be added through a bundle, not as individual tests.');
  }
  if (errors.length) return { errors };
  return { value: { title, description, price, bundleIds, courseIds, mockTestIds } };
}

function present(plan) {
  return {
    _id: plan._id,
    title: plan.title,
    description: plan.description || '',
    price: plan.price,
    status: plan.status,
    bundleIds: (plan.bundleIds || []).map(String),
    mockTestIds: (plan.mockTestIds || []).map(String),
    courseIds: (plan.courseIds || []).map(String),
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

// @desc    List published plans with bundles/courses expanded for student pages.
// @route   GET /api/plans/public
// @access  Public
exports.listPublishedPlans = async (req, res, next) => {
  try {
    const plans = await Plan.find({ status: 'published' })
      .sort({ createdAt: -1 })
      .populate({
        path: 'bundleIds',
        select: 'title description mockTestIds',
        populate: { path: 'mockTestIds', select: 'title durationMinutes category chapter status saleType isFree' },
      })
      .populate('mockTestIds', 'title durationMinutes category chapter')
      .populate('courseIds', 'title subtitle category image')
      .lean();
    res.status(200).json({
      success: true,
      data: plans.map((plan) => ({
        _id: plan._id,
        title: plan.title,
        description: plan.description || '',
        price: plan.price,
        bundles: (plan.bundleIds || []).map((bundle) => ({
          _id: bundle._id,
          title: bundle.title,
          description: bundle.description || '',
          mockTests: (bundle.mockTestIds || [])
            .filter((test) => test && test.status === 'published')
            .map((test) => ({
              _id: test._id,
              title: test.title,
              durationMinutes: test.durationMinutes,
              category: test.category,
              chapter: test.chapter,
            })),
        })),
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
    if (!plan.bundleIds.length && !plan.courseIds.length && !plan.mockTestIds.length) {
      return next(new ErrorResponse('Add a bundle, mock test, or course before publishing.', 400));
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
