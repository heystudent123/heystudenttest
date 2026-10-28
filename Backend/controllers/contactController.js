const ContactMessage = require('../models/ContactMessage');
const ErrorResponse = require('../utils/errorResponse');
const { sanitizeStr } = require('../middleware/validate');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// @desc    Submit a contact form message (public)
// @route   POST /api/contact
// @access  Public (userId attached if signed in)
exports.createMessage = async (req, res, next) => {
  try {
    const name = sanitizeStr(req.body.name || '').slice(0, 120);
    const email = sanitizeStr(req.body.email || '').toLowerCase().slice(0, 200);
    const phone = sanitizeStr(req.body.phone || '').slice(0, 20);
    const message = sanitizeStr(req.body.message || '').slice(0, 4000);

    const errors = [];
    if (!name) errors.push('Name is required.');
    if (!email || !EMAIL_RE.test(email)) errors.push('Enter a valid email address.');
    if (!message) errors.push('Message is required.');
    if (errors.length) return next(new ErrorResponse(errors.join(' '), 400));

    const doc = await ContactMessage.create({
      name,
      email,
      phone,
      message,
      userId: req.user ? req.user._id : null,
    });

    res.status(201).json({ success: true, data: { _id: doc._id } });
  } catch (err) {
    next(err);
  }
};

// @desc    List contact messages (admin)
// @route   GET /api/contact
// @access  Private/Admin
exports.listMessages = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const filter = {};
    if (req.query.status && ['new', 'read', 'resolved'].includes(req.query.status)) {
      filter.status = req.query.status;
    }

    const [total, messages] = await Promise.all([
      ContactMessage.countDocuments(filter),
      ContactMessage.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    res.status(200).json({
      success: true,
      count: messages.length,
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
      data: messages,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update a message's status (admin)
// @route   PUT /api/contact/:id/status
// @access  Private/Admin
exports.updateStatus = async (req, res, next) => {
  try {
    const status = req.body.status;
    if (!['new', 'read', 'resolved'].includes(status)) {
      return next(new ErrorResponse('Status must be new, read, or resolved.', 400));
    }
    const updated = await ContactMessage.findByIdAndUpdate(
      req.params.id,
      { $set: { status } },
      { new: true, runValidators: false }
    );
    if (!updated) return next(new ErrorResponse('Message not found.', 404));
    res.status(200).json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete a message (admin)
// @route   DELETE /api/contact/:id
// @access  Private/Admin
exports.deleteMessage = async (req, res, next) => {
  try {
    const deleted = await ContactMessage.findByIdAndDelete(req.params.id);
    if (!deleted) return next(new ErrorResponse('Message not found.', 404));
    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    next(err);
  }
};
