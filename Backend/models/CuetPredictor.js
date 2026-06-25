const mongoose = require('mongoose');

const CuetPredictorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    mobile: {
      type: String,
      required: [true, 'Mobile number is required'],
      trim: true,
      match: [/^\d{10,15}$/, 'Please enter a valid mobile number'],
    },
    score: {
      type: Number,
      required: [true, 'CUET score is required'],
      min: [0, 'Score cannot be negative'],
      max: [1000, 'Score cannot exceed 1000'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: ['UR', 'OBC', 'SC', 'ST', 'EWS', 'PwBD'],
    },
    gender: {
      type: String,
      enum: ['M', 'F'],
      default: 'F',
    },
    // Snapshot of top predictions saved at submission time
    predictedColleges: [
      {
        college_name: String,
        cutoffScore: Number,
        chance: String, // 'High', 'Medium', 'Low'
      },
    ],
  },
  { timestamps: true }
);

CuetPredictorSchema.index({ mobile: 1 });
CuetPredictorSchema.index({ createdAt: -1 });
CuetPredictorSchema.index({ category: 1 });

module.exports = mongoose.model('CuetPredictor', CuetPredictorSchema);
