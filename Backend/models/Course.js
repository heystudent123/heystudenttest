const mongoose = require('mongoose');

const CourseSchema = new mongoose.Schema({
  title: {
    type: String,
    trim: true,
    maxlength: [100, 'Title cannot be more than 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot be more than 1000 characters']
  },
  category: {
    type: [String],
    default: []
  },
  duration: {
    type: String,
    trim: true
  },
  level: {
    type: String,
    enum: ['Beginner', 'Intermediate', 'Advanced', 'All Levels'],
    default: 'All Levels'
  },
  instructor: {
    type: String,
    trim: true
  },
  price: {
    type: Number,
    default: 0
  },
  referralPrice: {
    type: Number,
    default: 0
  },
  isPaid: {
    type: Boolean,
    default: false
  },
  enrollmentLink: {
    type: String,
    trim: true
  },
  subtitle: {
    type: String,
    trim: true,
    maxlength: [200, 'Subtitle cannot be more than 200 characters']
  },
  originalPrice: {
    type: Number,
    default: 0
  },
  image: {
    type: String,
    default: 'default-course.jpg'
  },
  thumbnail: {
    type: String
  },
  materials: [{
    title: {
      type: String
    },
    description: String,
    materialType: {
      type: String,
      enum: ['file', 'video', 'link', 'note', 'pdf', 'module', 'pyq', 'notes'],
      default: 'file'
    },
    // For uploaded files
    fileType: {
      type: String,
      enum: ['pdf', 'document', 'image', 'video', 'other']
    },
    fileExtension: String,
    cloudinaryPublicId: String,
    // For video links (YouTube, Vimeo, etc.)
    videoUrl: String,
    videoPlatform: {
      type: String,
      enum: ['youtube', 'vimeo', 'other']
    },
    // For external links
    externalUrl: String,
    // For notes (text content)
    noteContent: String,
    // Common fields
    uploadedAt: {
      type: Date,
      default: Date.now
    },
    order: {
      type: Number,
      default: 0
    }
  }],
  features: {
    type: [String],
    default: []
  },
  prerequisites: {
    type: [String],
    default: []
  },
  syllabus: [{
    title: String,
    topics: [String]
  }],
  tags: {
    type: [String],
    default: []
  },
  isActive: {
    type: Boolean,
    default: true
  },
  rating: {
    type: Number,
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating cannot be more than 5']
  },
  enrolledCount: {
    type: Number,
    default: 0
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EmailUser',
    required: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field before saving
CourseSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Course', CourseSchema);
