const mongoose = require('mongoose');

const PostSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Post title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    content: {
      type: String,
      required: [true, 'Post content is required'],
      trim: true,
    },
    // The course this post belongs to. This is the source of truth going
    // forward — matched against Enrollment.courseId, not courseSlug (which
    // historically held inconsistent values: sometimes a real slug,
    // sometimes a course's _id as a string).
    courseId: {
      type: mongoose.Schema.ObjectId,
      ref: 'Course',
      default: null,
    },
    // Legacy field, kept for backward compatibility with posts created
    // before courseId existed. New posts should always set courseId.
    courseSlug: {
      type: String,
      trim: true,
      default: '',
    },
    // Optional attachment / resource links (unfiled — backward-compatible)
    attachments: [
      {
        label: { type: String, trim: true },
        url: { type: String, trim: true },
        type: {
          type: String,
          enum: ['image', 'document', 'video'],
          default: 'document',
        },
        publicId: { type: String, trim: true, default: '' },
        resourceType: { type: String, trim: true, default: '' },
        deliveryType: { type: String, trim: true, default: '' },
      },
    ],
    // Folder-based content organisation
    folders: [
      {
        name: { type: String, required: true, trim: true },
        attachments: [
          {
            label: { type: String, trim: true },
            url: { type: String, trim: true },
            type: {
              type: String,
              enum: ['image', 'document', 'video'],
              default: 'document',
            },
            publicId: { type: String, trim: true, default: '' },
            resourceType: { type: String, trim: true, default: '' },
            deliveryType: { type: String, trim: true, default: '' },
          },
        ],
      },
    ],
    // Banner or cover image URL
    coverImage: {
      type: String,
      trim: true,
      default: '',
    },
    // Tag for categorising posts: 'announcement', 'resource', 'assignment', 'update'
    tag: {
      type: String,
      enum: ['announcement', 'resource', 'assignment', 'update', 'general'],
      default: 'general',
    },
    isPinned: {
      type: Boolean,
      default: false,
    },
    isPublished: {
      type: Boolean,
      default: true,
    },
    publishedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'EmailUser',
      required: true,
    },
  },
  { timestamps: true }
);

PostSchema.index({ courseId: 1, createdAt: -1 });
PostSchema.index({ courseSlug: 1, createdAt: -1 });
PostSchema.index({ isPinned: -1, createdAt: -1 });

module.exports = mongoose.model('Post', PostSchema);
