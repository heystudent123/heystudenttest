const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const ErrorResponse = require('../utils/errorResponse');
const { pipeSignedAsset } = require('../utils/signedAsset');

const resourceTypeFor = (material) => {
  if (material.fileType === 'image') return 'image';
  if (material.fileType === 'video') return 'video';
  return 'raw';
};

const formatFor = (material) => {
  const ext = String(material.fileExtension || '').replace(/^\./, '').toLowerCase();
  const publicId = String(material.cloudinaryPublicId || '').toLowerCase();
  if (!ext || publicId.endsWith(`.${ext}`)) return undefined;
  return ext;
};

// @desc    Stream a course file for an enrolled student
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

    const material = (course.materials || []).find((item) => String(item._id) === materialId);
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

    const enrollment = await Enrollment.findOne({
      userId: req.user._id,
      isActive: true,
      $or: [
        { courseId: course._id },
        ...(inferredCourseSlug ? [{ courseSlug: inferredCourseSlug }] : []),
      ],
    }).select('_id');

    if (!enrollment && req.user.role !== 'admin') {
      return next(new ErrorResponse('You are not enrolled in this course', 403));
    }

    const opened = await pipeSignedAsset(res, {
      publicId: material.cloudinaryPublicId,
      resourceType: resourceTypeFor(material),
      deliveryType: material.cloudinaryDelivery || 'private',
      format: formatFor(material),
    }, material.title || 'file');

    if (!opened && !res.headersSent) {
      return next(new ErrorResponse('This file could not be opened', 404));
    }
  } catch (err) {
    if (!res.headersSent) return next(err);
  }
};
