const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const ErrorResponse = require('../utils/errorResponse');
const { deleteFile } = require('../utils/courseUpload');
const path = require('path');

// Full material detail for an enrolled student — unlike sanitizeMaterialForPublic,
// this includes everything needed to actually consume the material (note content,
// video/external links, ordering, description). File materials still resolve to a
// signed URL on demand via GET /api/materials/:materialId, never a stored one.
const sanitizeMaterialForStudent = (material) => ({
  _id: material._id,
  title: material.title,
  description: material.description || '',
  materialType: material.materialType,
  fileType: material.fileType,
  fileExtension: material.fileExtension,
  hasFile: Boolean(material.cloudinaryPublicId),
  videoUrl: material.videoUrl,
  videoPlatform: material.videoPlatform,
  externalUrl: material.externalUrl,
  noteContent: material.noteContent,
  order: material.order || 0,
  uploadedAt: material.uploadedAt,
});

const sanitizeMaterialForPublic = (material) => ({
  _id: material._id,
  title: material.title,
  materialType: material.materialType,
});

const sanitizeCourseForPublic = (course) => {
  const raw = course.toObject ? course.toObject() : course;
  return {
    ...raw,
    materials: Array.isArray(raw.materials)
      ? raw.materials.map(sanitizeMaterialForPublic)
      : [],
  };
};

// @desc    Get all courses
// @route   GET /api/courses
// @access  Public
exports.getCourses = async (req, res, next) => {
  try {
    // Build query
    let query;
    
    // Copy req.query
    const reqQuery = { ...req.query };
    
    // Fields to exclude
    const removeFields = ['select', 'sort', 'page', 'limit'];
    
    // Loop over removeFields and delete them from reqQuery
    removeFields.forEach(param => delete reqQuery[param]);
    
    // Create query string
    let queryStr = JSON.stringify(reqQuery);
    
    // Create operators ($gt, $gte, etc)
    queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in)\b/g, match => `$${match}`);
    
    // Finding resource
    query = Course.find(JSON.parse(queryStr));
    
    // Select fields
    if (req.query.select) {
      const fields = req.query.select.split(',').join(' ');
      query = query.select(fields);
    }
    
    // Sort
    if (req.query.sort) {
      const sortBy = req.query.sort.split(',').join(' ');
      query = query.sort(sortBy);
    } else {
      query = query.sort('-createdAt');
    }
    
    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 100;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const total = await Course.countDocuments(JSON.parse(queryStr));
    
    query = query.skip(startIndex).limit(limit);
    
    // Executing query
    const courses = await query;
    const sanitizedCourses = courses.map(sanitizeCourseForPublic);
    
    // Pagination result
    const pagination = {};
    
    if (endIndex < total) {
      pagination.next = {
        page: page + 1,
        limit
      };
    }
    
    if (startIndex > 0) {
      pagination.prev = {
        page: page - 1,
        limit
      };
    }
    
    res.status(200).json({
      success: true,
      count: sanitizedCourses.length,
      total,
      pagination,
      data: sanitizedCourses
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single course
// @route   GET /api/courses/:id
// @access  Public
exports.getCourseById = async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.id);
    
    if (!course) {
      return next(new ErrorResponse(`Course not found with id of ${req.params.id}`, 404));
    }
    
    res.status(200).json({
      success: true,
      data: sanitizeCourseForPublic(course)
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get full materials for a course the signed-in user is enrolled in
// @route   GET /api/courses/:id/my-materials
// @access  Private (enrolled students only)
exports.getMyMaterials = async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.id).select('_id title materials').lean();
    if (!course) {
      return next(new ErrorResponse(`Course not found with id of ${req.params.id}`, 404));
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

    if (!enrollment) {
      return next(new ErrorResponse('You are not enrolled in this course', 403));
    }

    const materials = (course.materials || [])
      .slice()
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map(sanitizeMaterialForStudent);

    res.status(200).json({
      success: true,
      count: materials.length,
      data: materials,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get full materials for a course (admin — no enrollment required)
// @route   GET /api/courses/:id/admin-materials
// @access  Private/Admin
exports.getAdminMaterials = async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.id).select('_id title materials').lean();
    if (!course) {
      return next(new ErrorResponse(`Course not found with id of ${req.params.id}`, 404));
    }

    const materials = (course.materials || [])
      .slice()
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map(sanitizeMaterialForStudent);

    res.status(200).json({
      success: true,
      count: materials.length,
      data: materials,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Create new course
// @route   POST /api/courses
// @access  Private/Admin
exports.createCourse = async (req, res, next) => {
  try {
    // Add user to req.body
    req.body.createdBy = req.user.id;
    
    const course = await Course.create(req.body);
    
    res.status(201).json({
      success: true,
      data: course
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update course
// @route   PUT /api/courses/:id
// @access  Private/Admin
exports.updateCourse = async (req, res, next) => {
  try {
    let course = await Course.findById(req.params.id);
    
    if (!course) {
      return next(new ErrorResponse(`Course not found with id of ${req.params.id}`, 404));
    }
    
    course = await Course.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    
    res.status(200).json({
      success: true,
      data: course
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete course
// @route   DELETE /api/courses/:id
// @access  Private/Admin
exports.deleteCourse = async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.id);
    
    if (!course) {
      return next(new ErrorResponse(`Course not found with id of ${req.params.id}`, 404));
    }
    
    // Delete associated files from Cloudinary
    if (course.materials && course.materials.length > 0) {
      for (const material of course.materials) {
        if (material.cloudinaryPublicId) {
          try {
            await deleteFile(material.cloudinaryPublicId);
          } catch (err) {
            console.error('Error deleting file from Cloudinary:', err);
          }
        }
      }
    }
    
    await course.deleteOne();
    
    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get courses by category
// @route   GET /api/courses/category/:category
// @access  Public
exports.getCoursesByCategory = async (req, res, next) => {
  try {
    const courses = await Course.find({ category: req.params.category, isActive: true });
    const sanitizedCourses = courses.map(sanitizeCourseForPublic);
    
    res.status(200).json({
      success: true,
      count: sanitizedCourses.length,
      data: sanitizedCourses
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Upload course material (PDF, notes, etc.)
// @route   POST /api/courses/:id/materials
// @access  Private/Admin
exports.uploadCourseMaterial = async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.id);
    
    if (!course) {
      return next(new ErrorResponse(`Course not found with id of ${req.params.id}`, 404));
    }
    
    if (!req.file) {
      return next(new ErrorResponse('Please upload a file', 400));
    }
    
    // Determine file type
    let fileType = 'other';
    if (req.file.mimetype.startsWith('image/')) {
      fileType = 'image';
    } else if (req.file.mimetype === 'application/pdf') {
      fileType = 'pdf';
    } else if (req.file.mimetype.includes('document') || req.file.mimetype.includes('word')) {
      fileType = 'document';
    } else if (req.file.mimetype.startsWith('video/')) {
      fileType = 'video';
    }
    
    // Get materialType from request body or determine from file type
    let materialType = req.body.materialType || 'file';
    
    // Validate materialType
    const validTypes = ['file', 'pdf', 'module', 'video', 'link', 'note', 'pyq', 'notes'];
    if (!validTypes.includes(materialType)) {
      materialType = 'file';
    }
    
    const fileExtension = path.extname(req.file.originalname || '').replace('.', '').toLowerCase();

    // Add material to course (store Cloudinary public ID only, never a permanent URL)
    const material = {
      title: req.body.title || req.file.originalname,
      description: req.body.description || '',
      materialType: materialType,
      fileType: fileType,
      fileExtension,
      cloudinaryPublicId: req.file.filename,
      cloudinaryDelivery: 'authenticated',
      order: req.body.order || course.materials.length
    };
    
    course.materials.push(material);
    await course.save();
    
    res.status(200).json({
      success: true,
      data: course
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Add video link to course
// @route   POST /api/courses/:id/videos
// @access  Private/Admin
exports.addVideoLink = async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.id);
    
    if (!course) {
      return next(new ErrorResponse(`Course not found with id of ${req.params.id}`, 404));
    }
    
    const { title, description, videoUrl, videoPlatform } = req.body;
    
    if (!title || !videoUrl) {
      return next(new ErrorResponse('Please provide title and video URL', 400));
    }
    
    // Detect platform if not provided
    let platform = videoPlatform || 'other';
    if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) {
      platform = 'youtube';
    } else if (videoUrl.includes('vimeo.com')) {
      platform = 'vimeo';
    }
    
    const material = {
      title,
      description: description || '',
      materialType: 'video',
      videoUrl,
      videoPlatform: platform,
      order: req.body.order || course.materials.length
    };
    
    course.materials.push(material);
    await course.save();
    
    res.status(200).json({
      success: true,
      data: course
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Add external link to course
// @route   POST /api/courses/:id/links
// @access  Private/Admin
exports.addExternalLink = async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.id);
    
    if (!course) {
      return next(new ErrorResponse(`Course not found with id of ${req.params.id}`, 404));
    }
    
    const { title, description, externalUrl } = req.body;
    
    if (!title || !externalUrl) {
      return next(new ErrorResponse('Please provide title and URL', 400));
    }
    
    const material = {
      title,
      description: description || '',
      materialType: 'link',
      externalUrl,
      order: req.body.order || course.materials.length
    };
    
    course.materials.push(material);
    await course.save();
    
    res.status(200).json({
      success: true,
      data: course
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Add note to course
// @route   POST /api/courses/:id/notes
// @access  Private/Admin
exports.addNote = async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.id);
    
    if (!course) {
      return next(new ErrorResponse(`Course not found with id of ${req.params.id}`, 404));
    }
    
    const { title, description, noteContent } = req.body;
    
    if (!title || !noteContent) {
      return next(new ErrorResponse('Please provide title and note content', 400));
    }
    
    const material = {
      title,
      description: description || '',
      materialType: 'note',
      noteContent,
      order: req.body.order || course.materials.length
    };
    
    course.materials.push(material);
    await course.save();
    
    res.status(200).json({
      success: true,
      data: course
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete course material
// @route   DELETE /api/courses/:id/materials/:materialId
// @access  Private/Admin
exports.deleteCourseMaterial = async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.id);
    
    if (!course) {
      return next(new ErrorResponse(`Course not found with id of ${req.params.id}`, 404));
    }
    
    const material = course.materials.id(req.params.materialId);
    
    if (!material) {
      return next(new ErrorResponse(`Material not found`, 404));
    }
    
    // Delete from Cloudinary
    if (material.cloudinaryPublicId) {
      try {
        await deleteFile(material.cloudinaryPublicId);
      } catch (err) {
        console.error('Error deleting file from Cloudinary:', err);
      }
    }
    
    // Remove from course
    material.deleteOne();
    await course.save();
    
    res.status(200).json({
      success: true,
      data: course
    });
  } catch (err) {
    next(err);
  }
};
