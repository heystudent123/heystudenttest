const express = require('express');
const {
  adminLogin,
  getDashboardStats,
  getAllReferrals,
  createAdmin,
  verifyAccommodation,
  promoteToInstitute,
  getInstitutes,
  getUsersByReferralCode,
  getEmailUsers,
  promoteEmailUserToAdmin,
  setUserRole,
  deleteEmailUser,
  getPaidUsers,
  getStudentReferralReward,
  updateStudentReferralReward,
} = require('../controllers/adminController');
const {
  getReferralCenter,
  getReferralUses,
  updateReferralSettings,
  updateInstituteCode,
  listCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
} = require('../controllers/referralAdminController');

const { protect, authorize } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Public routes
router.post('/login', authLimiter, adminLogin);

// Protected admin routes
router.get('/dashboard', protect, authorize('admin'), getDashboardStats);
router.get('/referrals', protect, authorize('admin'), getAllReferrals);
router.post('/create', protect, authorize('admin'), createAdmin);
router.put('/accommodations/:id/verify', protect, authorize('admin'), verifyAccommodation);

// Institute management routes
router.put('/users/:id/promote-to-institute', protect, authorize('admin'), promoteToInstitute);
router.get('/institutes', protect, authorize('admin'), getInstitutes);
router.get('/users-by-referral/:referralCode', protect, authorize('admin'), getUsersByReferralCode);

// Email-user admin routes (new schema)
router.get('/email-users', protect, authorize('admin'), getEmailUsers);
router.put('/email-users/:id/promote-to-admin', protect, authorize('admin'), promoteEmailUserToAdmin);
router.put('/email-users/:id/role', protect, authorize('admin'), setUserRole);
router.delete('/email-users/:id', protect, authorize('admin'), deleteEmailUser);

// Paid users
router.get('/paid-users', protect, authorize('admin'), getPaidUsers);
router.get('/student-referral-reward', protect, authorize('admin'), getStudentReferralReward);
router.put('/student-referral-reward', protect, authorize('admin'), updateStudentReferralReward);
router.get('/referral-center', protect, authorize('admin'), getReferralCenter);
router.get('/referral-center/uses/:userId', protect, authorize('admin'), getReferralUses);
router.put('/referral-center/settings', protect, authorize('admin'), updateReferralSettings);
router.put('/referral-center/institutes/:id/code', protect, authorize('admin'), updateInstituteCode);
router.get('/coupons', protect, authorize('admin'), listCoupons);
router.post('/coupons', protect, authorize('admin'), createCoupon);
router.put('/coupons/:id', protect, authorize('admin'), updateCoupon);
router.delete('/coupons/:id', protect, authorize('admin'), deleteCoupon);

module.exports = router; 