const Enrollment = require('../models/Enrollment');
const ErrorResponse = require('../utils/errorResponse');

// @desc    Check if the authenticated user is enrolled in a course
// @route   GET /api/enrollments/check/:courseSlug
// @access  Private
exports.checkEnrollment = async (req, res, next) => {
  try {
    const enrollment = await Enrollment.findOne({
      userId: req.user._id,
      courseSlug: req.params.courseSlug,
      isActive: true,
    });

    res.status(200).json({
      success: true,
      isEnrolled: !!enrollment,
      data: enrollment || null,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get all courses the authenticated user is enrolled in
// @route   GET /api/enrollments/my
// @access  Private
exports.getMyEnrollments = async (req, res, next) => {
  try {
    const enrollments = await Enrollment.find({
      userId: req.user._id,
      isActive: true,
    })
      .sort({ enrolledAt: -1 })
      .populate('courseId', 'title subtitle description category duration level instructor image');

    res.status(200).json({
      success: true,
      count: enrollments.length,
      data: enrollments,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get all enrollments (admin)
// @route   GET /api/enrollments/admin/all
// @access  Private/Admin
exports.getAllEnrollments = async (req, res, next) => {
  try {
    const { courseSlug, page = 1, limit = 30 } = req.query;
    const filter = {};
    if (courseSlug) filter.courseSlug = courseSlug;

    const skip = (Number(page) - 1) * Number(limit);
    const [enrollments, total] = await Promise.all([
      Enrollment.find(filter)
        .sort({ enrolledAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate('userId', 'name email phone')
        .populate('paymentId', 'razorpayOrderId amountInRupees status')
        .lean(),
      Enrollment.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      count: enrollments.length,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      data: enrollments,
    });
  } catch (err) {
    next(err);
  }
};
