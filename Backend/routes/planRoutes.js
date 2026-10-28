const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const {
  listPlans,
  listPublishedPlans,
  createPlan,
  updatePlan,
  publishPlan,
  unpublishPlan,
  deletePlan,
} = require('../controllers/planController');

const router = express.Router();

router.get('/public', listPublishedPlans);

router.use(protect, authorize('admin'));
router.get('/', listPlans);
router.post('/', createPlan);
router.put('/:id', updatePlan);
router.delete('/:id', deletePlan);
router.post('/:id/publish', publishPlan);
router.post('/:id/unpublish', unpublishPlan);

module.exports = router;
