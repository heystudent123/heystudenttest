const mongoose = require('mongoose');

const ContactMessageSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: 120,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
      maxlength: 200,
    },
    phone: {
      type: String,
      trim: true,
      default: '',
      maxlength: 20,
    },
    message: {
      type: String,
      required: [true, 'Message is required'],
      trim: true,
      maxlength: 4000,
    },
    // Linked to a signed-in account if the student was logged in when they asked
    userId: {
      type: mongoose.Schema.ObjectId,
      ref: 'EmailUser',
      default: null,
    },
    status: {
      type: String,
      enum: ['new', 'read', 'resolved'],
      default: 'new',
    },
  },
  {
    timestamps: true,
  }
);

ContactMessageSchema.index({ createdAt: -1 });
ContactMessageSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('ContactMessage', ContactMessageSchema);
