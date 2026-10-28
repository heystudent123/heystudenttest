const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const {
  listTests,
  getTest,
  createTest,
  updateTest,
  publishTest,
  unpublishTest,
  deleteTest,
} = require('../controllers/mockTestController');

const router = express.Router();

router.use(protect, authorize('admin'));

router.get('/', listTests);
router.post('/', createTest);
router.get('/:id', getTest);
router.put('/:id', updateTest);
router.delete('/:id', deleteTest);
router.post('/:id/publish', publishTest);
router.post('/:id/unpublish', unpublishTest);

module.exports = router;
