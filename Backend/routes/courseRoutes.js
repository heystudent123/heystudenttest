const express = require('express');
const {
  getCourses,
  getCourseById,
  getMyMaterials,
  getAdminMaterials,
  createCourse,
  updateCourse,
  deleteCourse,
  getCoursesByCategory,
  uploadCourseMaterial,
  addVideoLink,
  addExternalLink,
  addNote,
  deleteCourseMaterial
} = require('../controllers/courseController');

const { protect, authorize } = require('../middleware/auth');
const { uploadCourseFiles } = require('../utils/courseUpload');

const router = express.Router();

// Public routes
router.get('/', getCourses);
router.get('/category/:category', getCoursesByCategory);
router.get('/:id', getCourseById);

// Enrolled students — full material detail (route must stay above any admin :id routes)
router.get('/:id/my-materials', protect, getMyMaterials);

// Admin only routes
router.get('/:id/admin-materials', protect, authorize('admin'), getAdminMaterials);
router.post('/', protect, authorize('admin'), createCourse);
router.put('/:id', protect, authorize('admin'), updateCourse);
router.delete('/:id', protect, authorize('admin'), deleteCourse);

// File upload routes
router.post('/:id/materials', protect, authorize('admin'), uploadCourseFiles.single('file'), uploadCourseMaterial);
router.post('/:id/videos', protect, authorize('admin'), addVideoLink);
router.post('/:id/links', protect, authorize('admin'), addExternalLink);
router.post('/:id/notes', protect, authorize('admin'), addNote);
router.delete('/:id/materials/:materialId', protect, authorize('admin'), deleteCourseMaterial);

module.exports = router;
