const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const ErrorResponse = require('../utils/errorResponse');
const { cloudinary } = require('../utils/courseUpload');

const SIGNED_URL_TTL_SECONDS = 60;

// @desc    Resolve a protected material and redirect to a short-lived signed URL
// @route   GET /api/materials/:materialId
// @access  Private (enrolled students only)
exports.getProtectedMaterial = async (req, res, next) => {
  try {
    const { materialId } = req.params;

    const course = await Course.findOne({ 'materials._id': materialId })
      .select('_id title materials')
      .lean();

    if (!course) {
      return next(new ErrorResponse('Material not found', 404));
    }

    const material = (course.materials || []).find((m) => String(m._id) === materialId);
    if (!material) {
      return next(new ErrorResponse('Material not found', 404));
    }

    if (!material.cloudinaryPublicId) {
      return next(new ErrorResponse('This material is not a downloadable file', 400));
    }

    const inferredCourseSlug = String(course.title || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const enrollmentFilter = {
      userId: req.user._id,
      isActive: true,
      $or: [{ courseId: course._id }],
    };

    if (inferredCourseSlug) {
      enrollmentFilter.$or.push({ courseSlug: inferredCourseSlug });
    }

    const enrollment = await Enrollment.findOne(enrollmentFilter).select('_id');

    if (!enrollment) {
      return next(new ErrorResponse('You are not enrolled in this course', 403));
    }

    const expiresAt = Math.floor(Date.now() / 1000) + SIGNED_URL_TTL_SECONDS;

    const resourceType = material.fileType === 'image'
      ? 'image'
      : material.fileType === 'video'
        ? 'video'
        : 'raw';

    // Signed delivery URL (short-lived) to prevent static URL sharing.
    const signedUrl = cloudinary.url(material.cloudinaryPublicId, {
      resource_type: resourceType,
      type: 'private',
      secure: true,
      sign_url: true,
      expires_at: expiresAt,
      format: material.fileExtension || undefined,
    });

    res.set('Cache-Control', 'no-store');
    return res.redirect(302, signedUrl);
  } catch (err) {
    return next(err);
  }
};
