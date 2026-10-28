const express = require('express');
const { optionalProtect, protect, authorize } = require('../middleware/auth');
const { contactLimiter } = require('../middleware/rateLimiter');
const {
  createMessage,
  listMessages,
  updateStatus,
  deleteMessage,
} = require('../controllers/contactController');

const router = express.Router();

router.post('/', contactLimiter, optionalProtect, createMessage);

router.use(protect, authorize('admin'));
router.get('/', listMessages);
router.put('/:id/status', updateStatus);
router.delete('/:id', deleteMessage);

module.exports = router;
