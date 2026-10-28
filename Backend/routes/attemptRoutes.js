const express = require('express');
const { optionalProtect, protect, authorize } = require('../middleware/auth');
const {
  listSubjects,
  listCatalog,
  listAvailable,
  getInstructions,
  startAttempt,
  startPreviewAttempt,
  listMyAttempts,
  getAttempt,
  pauseAttempt,
  saveResponse,
  submitAttempt,
} = require('../controllers/attemptController');

const router = express.Router();

router.get('/subjects', listSubjects);
router.get('/catalog', optionalProtect, listCatalog);

router.use(protect);

router.get('/tests', listAvailable);
router.get('/tests/:id', getInstructions);
router.post('/start', startAttempt);
router.post('/preview', authorize('admin'), startPreviewAttempt);
router.get('/my', listMyAttempts);
router.get('/:id', getAttempt);
router.post('/:id/pause', pauseAttempt);
router.put('/:id/response', saveResponse);
router.post('/:id/submit', submitAttempt);

module.exports = router;
