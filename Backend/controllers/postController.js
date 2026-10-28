const Post = require('../models/Post');
const Enrollment = require('../models/Enrollment');
const ErrorResponse = require('../utils/errorResponse');
const {
  attachmentForStorage,
  attachmentForClient,
  parseCloudinaryUrl,
  pipeSignedAsset,
} = require('../utils/signedAsset');

const presentPost = (post, includeFileId) => {
  const source = post.toObject ? post.toObject() : post;
  return {
    ...source,
    attachments: (source.attachments || []).map((att) => attachmentForClient(att, { includeFileId })),
    folders: (source.folders || []).map((folder) => ({
      ...folder,
      attachments: (folder.attachments || []).map((att) => attachmentForClient(att, { includeFileId })),
    })),
  };
};

const storedAttachments = (list) => (Array.isArray(list) ? list.map(attachmentForStorage).filter(Boolean) : []);

const findAttachment = (post, attachmentId) => {
  const matches = (att) => att && String(att._id) === String(attachmentId);
  const direct = (post.attachments || []).find(matches);
  if (direct) return direct;
  for (const folder of post.folders || []) {
    const nested = (folder.attachments || []).find(matches);
    if (nested) return nested;
  }
  return null;
};

const resourceTypeForUpload = (file) => {
  if (file.mimetype && file.mimetype.startsWith('image/')) return 'image';
  if (file.mimetype && file.mimetype.startsWith('video/')) return 'video';
  return 'raw';
};

// @desc    Upload a single attachment file to Cloudinary
// @route   POST /api/posts/upload-attachment
// @access  Private/Admin
exports.uploadAttachment = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(new ErrorResponse('No file uploaded', 400));
    }
    res.status(200).json({
      success: true,
      data: {
        publicId: req.file.filename,
        resourceType: req.file.resource_type || resourceTypeForUpload(req.file),
        originalName: req.file.originalname,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Stream one post file after checking enrollment
// @route   GET /api/posts/:postId/attachments/:attachmentId
// @access  Private (enrolled student or admin)
exports.getPostAttachment = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) return next(new ErrorResponse('Post not found', 404));

    if (req.user.role !== 'admin') {
      const enrollment = await Enrollment.findOne({
        userId: req.user._id,
        isActive: true,
        $or: [{ courseId: post.courseId }, { courseSlug: String(post.courseId || '') }],
      }).select('_id');
      if (!enrollment) return next(new ErrorResponse('You are not enrolled in this course', 403));
    }

    const attachment = findAttachment(post, req.params.attachmentId);
    const parsed = parseCloudinaryUrl(attachment?.url || '');
    const publicId = attachment?.publicId || parsed?.publicId;
    if (!attachment || !publicId) {
      return next(new ErrorResponse('File not found', 404));
    }

    const opened = await pipeSignedAsset(res, {
      publicId,
      resourceType: attachment.resourceType || parsed?.resourceType || 'raw',
      deliveryType: attachment.deliveryType || parsed?.deliveryType || 'authenticated',
    }, attachment.label || 'file');
    if (!opened && !res.headersSent) {
      return next(new ErrorResponse('This file could not be opened', 404));
    }
  } catch (err) {
    if (!res.headersSent) next(err);
  }
};

// @desc    Get all published posts for a course (student — must be enrolled)
// @route   GET /api/posts/course/:courseId
// @access  Private
exports.getPostsForCourse = async (req, res, next) => {
  try {
    const { courseId } = req.params;

    // Verify enrollment — match on courseId (the reliable reference) and
    // fall back to the legacy courseSlug-as-id pattern for older enrollments.
    const enrollment = await Enrollment.findOne({
      userId: req.user._id,
      isActive: true,
      $or: [{ courseId }, { courseSlug: courseId }],
    });

    if (!enrollment) {
      return next(
        new ErrorResponse('You are not enrolled in this course', 403)
      );
    }

    const posts = await Post.find({ courseId, isPublished: true })
      .sort({ isPinned: -1, createdAt: -1 })
      .populate('publishedBy', 'name')
      .lean();

    res.status(200).json({
      success: true,
      count: posts.length,
      data: posts.map((post) => presentPost(post, false)),
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get all posts for admin (all courses, any status)
// @route   GET /api/posts/admin/all
// @access  Private/Admin
exports.getAdminPosts = async (req, res, next) => {
  try {
    const { courseId } = req.query;
    const filter = courseId ? { courseId } : {};

    const posts = await Post.find(filter)
      .sort({ isPinned: -1, createdAt: -1 })
      .populate('publishedBy', 'name email')
      .populate('courseId', 'title')
      .lean();

    res.status(200).json({
      success: true,
      count: posts.length,
      data: posts.map((post) => presentPost(post, true)),
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Create a post (admin)
// @route   POST /api/posts
// @access  Private/Admin
exports.createPost = async (req, res, next) => {
  try {
    const {
      title,
      content,
      courseId,
      attachments,
      folders,
      coverImage,
      tag,
      isPinned,
      isPublished,
    } = req.body;

    if (!courseId) {
      return next(new ErrorResponse('A course must be selected for this post', 400));
    }

    const post = await Post.create({
      title,
      content,
      courseId,
      attachments: storedAttachments(attachments),
      folders: Array.isArray(folders)
        ? folders.map((folder) => ({
          name: folder?.name,
          attachments: storedAttachments(folder?.attachments),
        }))
        : [],
      coverImage: coverImage || '',
      tag: tag || 'general',
      isPinned: isPinned || false,
      isPublished: isPublished !== undefined ? isPublished : true,
      publishedBy: req.user._id,
    });

    res.status(201).json({ success: true, data: post });
  } catch (err) {
    next(err);
  }
};

// @desc    Update a post (admin)
// @route   PUT /api/posts/:id
// @access  Private/Admin
exports.updatePost = async (req, res, next) => {
  try {
    const updates = { ...req.body };
    if (Object.prototype.hasOwnProperty.call(updates, 'attachments')) {
      updates.attachments = storedAttachments(updates.attachments);
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'folders')) {
      updates.folders = Array.isArray(updates.folders)
        ? updates.folders.map((folder) => ({
          name: folder?.name,
          attachments: storedAttachments(folder?.attachments),
        }))
        : [];
    }
    const post = await Post.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    if (!post) return next(new ErrorResponse('Post not found', 404));

    res.status(200).json({ success: true, data: post });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete a post (admin)
// @route   DELETE /api/posts/:id
// @access  Private/Admin
exports.deletePost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return next(new ErrorResponse('Post not found', 404));

    await post.deleteOne();
    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    next(err);
  }
};
