const mongoose = require('mongoose');
const Bundle = require('../models/Bundle');
const MockTest = require('../models/MockTest');
const Plan = require('../models/Plan');
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

function saleTypeOf(test) {
  if (test.saleType === 'free' || test.saleType === 'paid' || test.saleType === 'bundle') return test.saleType;
  return test.isFree ? 'free' : 'paid';
}

async function readBundle(body) {
  const title = String(body.title || '').trim();
  const description = String(body.description || '').trim();
  const mockTestIds = uniqueIds(body.mockTestIds);
  const errors = [];
  if (!title || title.length > 160) errors.push('A bundle title is required.');
  if (description.length > 2000) errors.push('The description is too long.');
  if (!mockTestIds.length) errors.push('Add at least one bundle mock test.');
  if (errors.length) return { errors };

  const tests = await MockTest.find({ _id: { $in: mockTestIds } }).select('_id title isFree saleType').lean();
  if (tests.length !== mockTestIds.length) errors.push('One of the mock tests no longer exists.');
  const notBundle = tests.filter((test) => saleTypeOf(test) !== 'bundle');
  if (notBundle.length) {
    errors.push('Only mock tests marked as Bundle can be added to a bundle.');
  }
  if (errors.length) return { errors };
  return { value: { title, description, mockTestIds } };
}

function present(bundle) {
  return {
    _id: bundle._id,
    title: bundle.title,
    description: bundle.description || '',
    mockTestIds: (bundle.mockTestIds || []).map(String),
    updatedAt: bundle.updatedAt,
    createdAt: bundle.createdAt,
  };
}

exports.listBundles = async (req, res, next) => {
  try {
    const bundles = await Bundle.find().sort({ updatedAt: -1 }).lean();
    res.status(200).json({ success: true, data: bundles.map(present) });
  } catch (err) {
    next(err);
  }
};

exports.getBundle = async (req, res, next) => {
  try {
    if (!isObjectId(req.params.id)) return next(new ErrorResponse('Bundle not found.', 404));
    const bundle = await Bundle.findById(req.params.id).lean();
    if (!bundle) return next(new ErrorResponse('Bundle not found.', 404));
    res.status(200).json({ success: true, data: present(bundle) });
  } catch (err) {
    next(err);
  }
};

exports.createBundle = async (req, res, next) => {
  try {
    const parsed = await readBundle(req.body);
    if (parsed.errors) return next(new ErrorResponse(parsed.errors.join(' '), 400));
    const bundle = await Bundle.create({ ...parsed.value, createdBy: req.user._id });
    res.status(201).json({ success: true, data: present(bundle) });
  } catch (err) {
    next(err);
  }
};

exports.updateBundle = async (req, res, next) => {
  try {
    if (!isObjectId(req.params.id)) return next(new ErrorResponse('Bundle not found.', 404));
    const bundle = await Bundle.findById(req.params.id);
    if (!bundle) return next(new ErrorResponse('Bundle not found.', 404));
    const parsed = await readBundle(req.body);
    if (parsed.errors) return next(new ErrorResponse(parsed.errors.join(' '), 400));
    bundle.set(parsed.value);
    await bundle.save();
    res.status(200).json({ success: true, data: present(bundle) });
  } catch (err) {
    next(err);
  }
};

exports.deleteBundle = async (req, res, next) => {
  try {
    if (!isObjectId(req.params.id)) return next(new ErrorResponse('Bundle not found.', 404));
    const bundle = await Bundle.findById(req.params.id);
    if (!bundle) return next(new ErrorResponse('Bundle not found.', 404));
    const used = await Plan.exists({ bundleIds: bundle._id });
    if (used) {
      return next(new ErrorResponse('Remove this bundle from every plan before deleting it.', 400));
    }
    await bundle.deleteOne();
    res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
};
