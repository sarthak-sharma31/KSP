const crypto = require('crypto');
const User   = require('../models/User');
const { asyncHandler }           = require('../middleware/error');
const bcrypt = require('bcryptjs');
const PendingSignup = require('../models/PendingSignup');
const {
  sendTokenResponse, sendPasswordResetOtpEmail, sendWelcomeEmail, sendSignupOtpEmail,
} = require('../utils/helpers');

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

/* ══════════════════════════════════════════════════════════════
   SIGNUP — two steps, because an address you cannot reach is not
   an account. Step one parks the details and emails a code; the
   User document is only created in step two, once the code comes
   back. Nothing unverified ever lands in the users collection.
══════════════════════════════════════════════════════════════ */

/* ── POST /api/auth/signup ─────────────────────────────────────
   Step 1 of 2 — park the registration and email a 6-digit code. */
exports.signup = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  const existing = await User.findOne({ email });
  if (existing) {
    return res.status(400).json({ success: false, message: 'Email already registered' });
  }

  // Hash now so an abandoned attempt sitting in the collection is never a
  // plaintext credential.
  const passwordHash = await bcrypt.hash(password, 12);

  // Signing up again with the same address replaces the earlier attempt
  // rather than colliding with it — people retry when a mail is slow.
  let pending = await PendingSignup.findOne({ email }).select('+otp +passwordHash');
  if (pending) {
    const gate = pending.canResend();
    if (!gate.ok && gate.reason === 'cooldown') {
      return res.status(429).json({
        success: false,
        message: `A code was just sent. Try again in ${gate.retryInSeconds}s.`,
        retryInSeconds: gate.retryInSeconds,
      });
    }
    pending.name = name;
    pending.passwordHash = passwordHash;
    pending.resendCount += 1;
  } else {
    pending = new PendingSignup({ email, name, passwordHash, otp: 'x', otpExpires: new Date() });
  }

  const otp = pending.issueOtp();
  await pending.save();

  try {
    await sendSignupOtpEmail({
      email, name, otp, ttlMinutes: PendingSignup.OTP_TTL_MINUTES,
    });
  } catch (err) {
    // A code nobody can read is worse than no attempt at all — clear it so
    // the address is not left in limbo behind a cooldown.
    await PendingSignup.deleteOne({ _id: pending._id });
    console.error('Signup OTP email failed:', err.message);
    return res.status(502).json({
      success: false,
      message: "We couldn't send the code to that address. Check it and try again.",
    });
  }

  res.status(202).json({
    success: true,
    message: `We've sent a ${PendingSignup.OTP_TTL_MINUTES}-minute code to ${email}.`,
    data: {
      email,
      ttlMinutes: PendingSignup.OTP_TTL_MINUTES,
      resendCooldownSeconds: PendingSignup.RESEND_COOLDOWN_SECONDS,
    },
  });
});

/* ── POST /api/auth/verify-signup ──────────────────────────────
   Step 2 of 2 — the code proves the inbox, so create the account. */
exports.verifySignup = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  const pending = await PendingSignup.findOne({ email }).select('+otp +passwordHash');
  if (!pending) {
    return res.status(400).json({
      success: false,
      message: 'That signup has expired. Please register again.',
      code: 'EXPIRED',
    });
  }

  const result = pending.verifyOtp(otp);

  if (result !== 'ok') {
    await pending.save(); // persist the burned attempt
    if (result === 'locked') {
      return res.status(429).json({
        success: false,
        message: 'Too many incorrect codes. Request a new one to continue.',
        code: 'LOCKED',
      });
    }
    if (result === 'expired') {
      return res.status(400).json({
        success: false,
        message: 'That code has expired. Request a new one.',
        code: 'EXPIRED',
      });
    }
    return res.status(400).json({
      success: false,
      message: 'That code is incorrect.',
      code: 'WRONG',
      attemptsLeft: Math.max(0, PendingSignup.MAX_ATTEMPTS - pending.attempts),
    });
  }

  // Someone may have registered this address while the code was in flight.
  if (await User.findOne({ email })) {
    await PendingSignup.deleteOne({ _id: pending._id });
    return res.status(400).json({ success: false, message: 'Email already registered' });
  }

  const user = new User({ name: pending.name, email, emailVerified: true });
  user.password = pending.passwordHash;
  user.$locals.passwordAlreadyHashed = true; // it is already bcrypt — see the pre-save hook
  await user.save();

  await PendingSignup.deleteOne({ _id: pending._id });

  sendWelcomeEmail({ email: user.email, name: user.name }).catch(err => {
    console.error('Welcome email failed:', err.message);
  });

  sendTokenResponse(user, 201, res);
});

/* ── POST /api/auth/resend-signup-otp ──────────────────────────
   Rate-limited so the endpoint cannot be used to spam an inbox. */
exports.resendSignupOtp = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const pending = await PendingSignup.findOne({ email }).select('+otp +passwordHash');
  if (!pending) {
    return res.status(400).json({
      success: false,
      message: 'That signup has expired. Please register again.',
      code: 'EXPIRED',
    });
  }

  const gate = pending.canResend();
  if (!gate.ok) {
    if (gate.reason === 'limit') {
      return res.status(429).json({
        success: false,
        message: 'Too many codes requested. Please register again in a few minutes.',
        code: 'LIMIT',
      });
    }
    return res.status(429).json({
      success: false,
      message: `Please wait ${gate.retryInSeconds}s before requesting another code.`,
      code: 'COOLDOWN',
      retryInSeconds: gate.retryInSeconds,
    });
  }

  const otp = pending.issueOtp();
  pending.resendCount += 1;
  await pending.save();

  try {
    await sendSignupOtpEmail({
      email, name: pending.name, otp, ttlMinutes: PendingSignup.OTP_TTL_MINUTES,
    });
  } catch (err) {
    console.error('Signup OTP resend failed:', err.message);
    return res.status(502).json({ success: false, message: 'Could not send the code. Try again shortly.' });
  }

  res.json({
    success: true,
    message: `A new code is on its way to ${email}.`,
    data: { resendCooldownSeconds: PendingSignup.RESEND_COOLDOWN_SECONDS },
  });
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

/* ── POST /api/auth/forgot-password ─────────────────────────────
   Step 1 of 3 — emails a 5-digit OTP.
   Always reports success so this can't be used to probe which
   addresses have accounts. */
const OTP_TTL_MINUTES = 10;

exports.forgotPassword = asyncHandler(async (req, res) => {
  const genericResponse = {
    success: true,
    message: `If that email exists, we've sent a ${OTP_TTL_MINUTES}-minute reset code to it.`,
  };

  const user = await User.findOne({ email: req.body.email }).select(
    '+passwordResetOtp +passwordResetOtpExpires +passwordResetAttempts'
  );
  if (!user) return res.json(genericResponse);

  const otp = user.createPasswordResetOtp();
  await user.save({ validateBeforeSave: false });

  try {
    await sendPasswordResetOtpEmail({
      email: user.email,
      name: user.name,
      otp,
      ttlMinutes: OTP_TTL_MINUTES,
    });
  } catch (err) {
    user.clearPasswordResetOtp();
    await user.save({ validateBeforeSave: false });
    return res.status(500).json({ success: false, message: 'Email could not be sent. Try again later.' });
  }

  res.json(genericResponse);
});

/* ── POST /api/auth/verify-reset-otp ────────────────────────────
   Step 2 of 3 — trades a valid OTP for a short-lived reset token,
   which step 3 (PATCH /reset-password/:token) consumes. */
exports.verifyResetOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  const user = await User.findOne({ email }).select(
    '+passwordResetOtp +passwordResetOtpExpires +passwordResetAttempts'
  );

  // Same message for "no such user" and "wrong code" — don't leak existence.
  const invalid = { success: false, message: 'That code is incorrect or has expired.' };
  if (!user) return res.status(400).json(invalid);

  const result = user.verifyPasswordResetOtp(otp);

  if (result !== 'ok') {
    await user.save({ validateBeforeSave: false }); // persist the burned attempt
    if (result === 'locked') {
      return res.status(429).json({
        success: false,
        message: 'Too many incorrect codes. Request a new one to continue.',
      });
    }
    return res.status(400).json(invalid);
  }

  // Correct — burn the OTP so it's single-use, and issue the reset token.
  const resetToken = user.createPasswordResetToken();
  user.clearPasswordResetOtp();
  await user.save({ validateBeforeSave: false });

  res.json({ success: true, resetToken, message: 'Code verified. You can now set a new password.' });
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
  user.clearPasswordResetOtp(); // belt and braces — nothing reusable left behind
  await user.save();

  sendTokenResponse(user, 200, res);
});

/* ── PATCH /api/auth/update-password ────────────────────────── */
/* ── PATCH /api/auth/me ─────────────────────────────────────────
   The only profile field a learner can change today. Email is the
   account identity and is OTP-verified, so changing it would mean
   re-running that whole flow — deliberately not offered here. */
exports.updateProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) return res.status(404).json({ success: false, message: 'Account not found' });

  user.name = req.body.name.trim();
  await user.save();

  res.json({
    success: true,
    message: 'Profile updated.',
    user: { _id: user._id, name: user.name, email: user.email, role: user.role },
  });
});

/* ── DELETE /api/auth/me ────────────────────────────────────────
   Irreversible, so it requires the password — a logged-in tab left
   open should not be enough to destroy an account.

   Everything keyed to the user goes with it. Anything missed here
   would linger as an orphan row pointing at an id that no longer
   resolves, which is both a privacy problem and a source of odd
   totals in the admin analytics. */
exports.deleteAccount = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+password');
  if (!user) return res.status(404).json({ success: false, message: 'Account not found' });

  if (user.authProvider === 'local') {
    if (!req.body.password) {
      return res.status(400).json({ success: false, message: 'Enter your password to confirm.' });
    }
    if (!(await user.matchPassword(req.body.password))) {
      return res.status(401).json({ success: false, message: 'That password is incorrect.' });
    }
  }

  const userId = user._id;
  await Promise.all([
    require('../models/KanaProgress').deleteMany({ user: userId }),
    require('../models/KanjiProgress').deleteMany({ user: userId }),
    require('../models/VocabularyProgress').deleteMany({ user: userId }),
    require('../models/GrammarProgress').deleteMany({ user: userId }),
    require('../models/RoadmapProgress').deleteMany({ user: userId }),
    require('../models/StreakActivity').deleteMany({ user: userId }),
    require('../models/TestAttempt').deleteMany({ user: userId }),
    require('../models/TestProgress').deleteMany({ user: userId }),
    require('../models/index').QuizAttempt.deleteMany({ user: userId }),
    require('../models/PendingSignup').deleteMany({ email: user.email }),
  ]);

  await User.deleteOne({ _id: userId });

  res.json({ success: true, message: 'Your account and all of its data have been deleted.' });
});

exports.updatePassword = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+password');

  if (!(await user.matchPassword(req.body.currentPassword))) {
    return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
  }

  user.password = req.body.newPassword;
  await user.save();
  sendTokenResponse(user, 200, res);
});
