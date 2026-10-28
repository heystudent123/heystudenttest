const jwt = require('jsonwebtoken');
const { getAuth, clerkClient, verifyToken } = require('@clerk/express');
const EmailUser = require('../models/EmailUser');

// Try to verify as a regular JWT (used by admin login)
const tryJwtVerify = async (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded && decoded.id) {
      return await EmailUser.findById(decoded.id);
    }
  } catch {}
  return null;
};

// Verify Clerk Bearer token directly (helps local/dev cross-origin API calls).
const tryClerkTokenVerify = async (token) => {
  try {
    if (!token || !process.env.CLERK_SECRET_KEY) return null;

    const verified = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
    });

    const clerkId = verified?.sub;
    if (!clerkId) return null;

    let user = await EmailUser.findOne({ clerkId });
    if (user) return user;

    const clerkUser = await clerkClient.users.getUser(clerkId);
    const email = clerkUser.emailAddresses?.[0]?.emailAddress;
    const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || (email ? email.split('@')[0] : 'Student');
    const phone = clerkUser.phoneNumbers?.[0]?.phoneNumber || '';

    if (!email) return null;

    user = await EmailUser.findOne({ email });
    if (user) {
      // Avoid full-document validation failures on legacy records.
      user = await EmailUser.findByIdAndUpdate(
        user._id,
        { $set: { clerkId } },
        { new: true, runValidators: false, context: 'query' }
      );
      return user;
    }

    return await EmailUser.create({
      clerkId,
      email,
      name,
      phone,
    });
  } catch {
    return null;
  }
};

// Protect routes — supports both Clerk sessions and admin JWT tokens
exports.protect = async (req, res, next) => {
  // ── 1. If a Bearer token is present, try JWT first (admin login path) ──────
  //    This prevents a Clerk browser session from overriding an admin JWT.
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    const token = req.headers.authorization.split(' ')[1];
    const jwtUser = await tryJwtVerify(token).catch(() => null);
    if (jwtUser) {
      req.user = jwtUser;
      return next();
    }

    // Fallback: verify Clerk token directly from Authorization header.
    const clerkBearerUser = await tryClerkTokenVerify(token).catch(() => null);
    if (clerkBearerUser) {
      req.user = clerkBearerUser;
      return next();
    }
    // Bearer token present but could not be verified — still try Clerk session below.
  }

  // ── 2. Try Clerk session (set by clerkMiddleware in server.js) ────────────
  try {
    const { userId } = getAuth(req);
    if (userId) {
      req.user = await EmailUser.findOne({ clerkId: userId });

      if (!req.user) {
        // Auto-create user from Clerk data
        const clerkUser = await clerkClient.users.getUser(userId);
        const email = clerkUser.emailAddresses?.[0]?.emailAddress;
        const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || '';
        if (!email) {
          return res.status(401).json({ success: false, message: 'No email associated with Clerk account' });
        }
        req.user = await EmailUser.findOne({ email });
        if (req.user) {
          req.user = await EmailUser.findByIdAndUpdate(
            req.user._id,
            { $set: { clerkId: userId } },
            { new: true, runValidators: false, context: 'query' }
          );
        } else {
          try {
            req.user = await EmailUser.create({
              clerkId: userId, name, email,
              phone: clerkUser.phoneNumbers?.[0]?.phoneNumber || ''
            });
          } catch (createErr) {
            // If validation fails (e.g. unusual email format), store without strict validation
            if (createErr.name === 'ValidationError') {
              const doc = new EmailUser({ clerkId: userId, name, phone: '' });
              doc.email = email; // bypass setter validation
              await doc.save({ validateBeforeSave: false });
              req.user = doc;
            } else {
              throw createErr;
            }
          }
        }
      }

      return next();
    }
  } catch (clerkErr) {
    // Clerk not available for this request — fall through to JWT
  }

  // ── 3. Fall back to JWT cookie (no Bearer header present) ─────────────────
  if (req.cookies && req.cookies.token) {
    const jwtUser = await tryJwtVerify(req.cookies.token).catch(() => null);
    if (jwtUser) {
      req.user = jwtUser;
      return next();
    }
  }

  return res.status(401).json({
    success: false,
    message: 'Not authorized to access this route'
  });
};

// Same session lookup as protect, but anonymous visitors continue with req.user = null.
exports.optionalProtect = async (req, res, next) => {
  let denied = false;
  let continued = false;
  const proxy = {
    status() { return this; },
    json() { denied = true; },
  };
  try {
    await exports.protect(req, proxy, (err) => {
      continued = true;
      next(err);
    });
  } catch (err) {
    if (!continued) next(err);
    return;
  }
  if (!continued) {
    if (denied) req.user = null;
    next();
  }
};

// Grant access to specific roles
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role ${req.user.role} is not authorized to access this route`
      });
    }
    next();
  };
}; 