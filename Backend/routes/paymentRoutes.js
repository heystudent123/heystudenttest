const express = require('express');
const {
  createOrder,
  verifyPayment,
  cancelCheckout,
  handleWebhook,
  getMyPayments,
  getPaymentById,
  getAllPayments,
  getPaymentStats,
  initiateRefund,
  getRazorpayDetails,
  savePrePaymentLead,
  getAllLeads,
  setLeadConverted,
  deleteLead,
} = require('../controllers/paymentController');

const { protect, authorize } = require('../middleware/auth');
const { paymentLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// ─── Webhook (raw body — NO JSON parsing; must come before express.json middleware) ─
// We attach the raw body in server.js using a verify callback, then handle here.
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  (req, res, next) => {
    // Make rawBody available for HMAC verification
    req.rawBody = req.body;
    // Parse JSON for the controller to use req.body as object
    try {
      req.body = JSON.parse(req.body.toString('utf8'));
    } catch {
      return res.status(400).json({ success: false, message: 'Invalid JSON body' });
    }
    next();
  },
  handleWebhook
);

// ─── Admin static routes (before :id) ────────────────────────────────────────
router.get('/admin/all', protect, authorize('admin'), getAllPayments);
router.get('/admin/stats', protect, authorize('admin'), getPaymentStats);
router.get('/leads', protect, authorize('admin'), getAllLeads);
router.put('/leads/:id/converted', protect, authorize('admin'), setLeadConverted);
router.delete('/leads/:id', protect, authorize('admin'), deleteLead);

// ─── Authenticated user routes ────────────────────────────────────────────────
router.get('/my', protect, getMyPayments);
router.post('/create-order', protect, paymentLimiter, createOrder);
router.post('/verify', protect, verifyPayment);
router.post('/cancel', protect, cancelCheckout);
// Pre-payment lead — public (no auth guard, but optionally attach user if logged in)
router.post('/save-lead', savePrePaymentLead);

// ─── Dynamic :id routes ───────────────────────────────────────────────────────
router.get('/:id', protect, getPaymentById);
router.post('/:id/refund', protect, authorize('admin'), initiateRefund);
router.get('/:id/razorpay-details', protect, authorize('admin'), getRazorpayDetails);

module.exports = router;
