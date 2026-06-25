const express = require('express');
const { submitPredictor, searchColleges, getAllSubmissions } = require('../controllers/cuetPredictorController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Public — anyone can submit
router.post('/submit', submitPredictor);

// Public — search colleges directly from the cutoff dataset
router.get('/colleges', searchColleges);

// Admin only — view all submissions
router.get('/admin/all', protect, authorize('admin'), getAllSubmissions);

module.exports = router;
