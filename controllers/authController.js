const crypto = require('crypto');
const User   = require('../models/User');
const { asyncHandler }           = require('../middleware/error');
const { sendTokenResponse, sendPasswordResetEmail } = require('../utils/helpers');

/* ── POST /api/auth/signup ───────────────────────────────────── */
exports.signup = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  const existing = await User.findOne({ email });
  if (existing) {
    return res.status(400).json({ success: false, message: 'Email already registered' });
  }

  const user = await User.create({ name, email, password });
  sendTokenResponse(user, 201, res);
});

/* ── POST /api/auth/login ────────────────────────────────────── */
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.matchPassword(password))) {
    return res.status(401).json({ success: false, message: 'Invalid email or password' });
  }

  if (user.status === 'banned') {
    return res.status(403).json({ success: false, message: 'Your account has been banned. Contact support.' });
  }

  sendTokenResponse(user, 200, res);
});

/* ── POST /api/auth/admin/login ──────────────────────────────── */
exports.adminLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email, role: 'admin' }).select('+password');
  if (!user || !(await user.matchPassword(password))) {
    return res.status(401).json({ success: false, message: 'Invalid admin credentials' });
  }

  sendTokenResponse(user, 200, res, true); // isAdmin = true → uses JWT_ADMIN_SECRET
});

/* ── GET /api/auth/me ────────────────────────────────────────── */
exports.getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  res.json({ success: true, user });
});

/* ── POST /api/auth/forgot-password ─────────────────────────── */
exports.forgotPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    // Don't reveal whether email exists
    return res.json({ success: true, message: 'If that email exists, a reset link has been sent.' });
  }

  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;

  try {
    await sendPasswordResetEmail({ email: user.email, name: user.name, resetUrl });
    res.json({ success: true, message: 'Password reset link sent to your email.' });
  } catch (err) {
    user.passwordResetToken   = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });
    res.status(500).json({ success: false, message: 'Email could not be sent. Try again later.' });
  }
});

/* ── PATCH /api/auth/reset-password/:token ───────────────────── */
exports.resetPassword = asyncHandler(async (req, res) => {
  // Hash the token from URL to compare with DB
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  const user = await User.findOne({
    passwordResetToken:   hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });

  if (!user) {
    return res.status(400).json({ success: false, message: 'Reset token is invalid or has expired.' });
  }

  user.password             = req.body.password;
  user.passwordResetToken   = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  sendTokenResponse(user, 200, res);
});

/* ── PATCH /api/auth/update-password ────────────────────────── */
exports.updatePassword = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+password');

  if (!(await user.matchPassword(req.body.currentPassword))) {
    return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
  }

  user.password = req.body.newPassword;
  await user.save();
  sendTokenResponse(user, 200, res);
});
