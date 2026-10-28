const express = require('express');
const multer = require('multer');
const { protect, authorize } = require('../middleware/auth');
const {
  listBanks,
  createBank,
  updateBank,
  deleteBank,
  downloadTemplate,
  previewImport,
  approveImport,
  downloadErrorReport,
  listQuestions,
  listChapters,
  getQuestion,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  bulkDeleteQuestions,
} = require('../controllers/questionController');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
});

function uploadExcel(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (!err) return next();
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? 'File exceeds the 2 MB limit.'
      : 'The spreadsheet could not be uploaded.';
    return res.status(400).json({ success: false, error: message });
  });
}

router.use(protect, authorize('admin'));

router.get('/banks', listBanks);
router.post('/banks', createBank);
router.put('/banks/:id', updateBank);
router.delete('/banks/:id', deleteBank);

router.get('/template', downloadTemplate);
router.post('/import/preview', uploadExcel, previewImport);
router.post('/import/:id/approve', approveImport);
router.get('/import/:id/errors', downloadErrorReport);
router.get('/meta/chapters', listChapters);
router.get('/', listQuestions);
router.post('/', createQuestion);
router.delete('/bulk', bulkDeleteQuestions);
router.get('/:id', getQuestion);
router.put('/:id', updateQuestion);
router.delete('/:id', deleteQuestion);

module.exports = router;
