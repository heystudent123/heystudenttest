const rateLimit = require('express-rate-limit');

// ─── Message helper ────────────────────────────────────────────────────────────
const msg = (action) => ({
  success: false,
  message: `Too many ${action} attempts. Please try again later.`,
});

// ─── Global API limiter — 200 req / 15 min per IP ─────────────────────────────
exports.globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: msg('requests'),
});

// ─── Auth / Login — 10 attempts / 15 min per IP ───────────────────────────────
exports.authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: msg('login'),
  skipSuccessfulRequests: true, // only count failures against the limit
});

// ─── Payment order creation — 20 orders / 15 min per IP ──────────────────────
exports.paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: msg('payment order'),
});

// ─── Referral code validation — 30 checks / 10 min per IP ────────────────────
// Prevents enumeration of referral codes
exports.referralLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: msg('referral code validation'),
});

// ─── User sync — 20 syncs / 5 min per IP ─────────────────────────────────────
exports.syncLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: msg('user sync'),
});

// ─── Contact form submission — 5 messages / 15 min per IP ────────────────────
exports.contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: msg('contact form submission'),
});
