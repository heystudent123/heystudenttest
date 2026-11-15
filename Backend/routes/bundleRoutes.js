const express = require('express');
const {
  listBundles,
  getBundle,
  createBundle,
  updateBundle,
  deleteBundle,
} = require('../controllers/bundleController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect, authorize('admin'));
router.get('/', listBundles);
router.get('/:id', getBundle);
router.post('/', createBundle);
router.put('/:id', updateBundle);
router.delete('/:id', deleteBundle);

module.exports = router;
