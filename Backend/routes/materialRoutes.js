const express = require('express');
const { getProtectedMaterial } = require('../controllers/materialController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.get('/:materialId', protect, getProtectedMaterial);

module.exports = router;
