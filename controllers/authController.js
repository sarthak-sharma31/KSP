const crypto = require('crypto');
const User   = require('../models/User');
const { asyncHandler }           = require('../middleware/error');
const { sendTokenResponse, sendPasswordResetEmail, sendWelcomeEmail } = require('../utils/helpers');

const verifyGoogleCredential = async (credential) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error('Google sign-in is not configured on the server.');
  }

  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error_description || payload.error || 'Google token verification failed');
  }

  if (payload.aud !== clientId) {
    throw new Error('Google token audience mismatch.');
  }

  if (payload.email_verified !== 'true' && payload.email_verified !== true) {
    throw new Error('Google account email is not verified.');
  }

  return payload;
};

/* ── POST /api/auth/signup ───────────────────────────────────── */
exports.signup = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  const existing = await User.findOne({ email });
  if (existing) {
    return res.status(400).json({ success: false, message: 'Email already registered' });
  }

  const user = await User.create({ name, email, password });
  sendWelcomeEmail({ email: user.email, name: user.name }).catch(err => {
    console.error('Welcome email failed:', err.message);
  });
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

/* ── POST /api/auth/google ───────────────────────────────────── */
exports.googleAuth = asyncHandler(async (req, res) => {
  const { credential } = req.body;
  if (!credential) {
    return res.status(400).json({ success: false, message: 'Google credential is required' });
  }

  const googleUser = await verifyGoogleCredential(credential);
  const email = String(googleUser.email || '').toLowerCase().trim();
  const name = String(googleUser.name || googleUser.given_name || 'Learner').trim() || 'Learner';
  const googleId = String(googleUser.sub || '');

  let user = await User.findOne({ email });

  if (user?.role === 'admin') {
    return res.status(403).json({ success: false, message: 'Use admin login for this account.' });
  }

  let isNewAccount = false;

  if (!user) {
    isNewAccount = true;
    user = await User.create({
      name,
      email,
      password: crypto.randomBytes(24).toString('hex'),
      authProvider: 'google',
      googleId,
      emailVerified: true,
    });
  } else {
    const updatePayload = {
      authProvider: 'google',
      googleId,
      emailVerified: true,
    };
    if (!user.name && name) updatePayload.name = name;
    user = await User.findByIdAndUpdate(user._id, updatePayload, { new: true });
  }

  if (isNewAccount) {
    sendWelcomeEmail({ email: user.email, name: user.name }).catch(err => {
      console.error('Welcome email failed:', err.message);
    });
  }

  sendTokenResponse(user, 200, res);
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
