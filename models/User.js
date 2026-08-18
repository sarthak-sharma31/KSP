const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const crypto   = require('crypto');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [60, 'Name cannot exceed 60 characters'],
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false, // never return password in queries
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
  },
  authProvider: {
    type: String,
    enum: ['local', 'google'],
    default: 'local',
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true,
    index: true,
  },
  emailVerified: {
    type: Boolean,
    default: false,
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'banned'],
    default: 'active',
  },

  // Learning progress
  currentLevel: { type: String, enum: ['N5','N4','N3','N2','N1'], default: 'N5' },
  xp:           { type: Number, default: 0 },
  streak:       { type: Number, default: 0 },
  lastStudied:  { type: Date,   default: null },

  // Password reset — OTP stage, then a short-lived token for the actual reset
  passwordResetOtp:      { type: String, select: false }, // sha256 of the OTP, never the digits
  passwordResetOtpExpires: { type: Date, select: false },
  passwordResetAttempts: { type: Number, select: false, default: 0 },
  passwordResetToken:    { type: String, select: false },
  passwordResetExpires:  { type: Date,   select: false },
}, {
  timestamps: true, // adds createdAt, updatedAt
});

/* ── Hash password before save ───────────────────────────────── */
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  /* Signup-by-OTP hashes the password when the attempt is parked in
     PendingSignup, so the value arriving here is already a bcrypt hash.
     Re-hashing it would produce a password nobody could ever log in with. */
  if (this.$locals.passwordAlreadyHashed) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

/* ── Compare password ────────────────────────────────────────── */
userSchema.methods.matchPassword = async function (entered) {
  return bcrypt.compare(entered, this.password);
};

/* ── Generate password reset token ──────────────────────────── */
userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString('hex');
  // Store hashed version in DB
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  this.passwordResetExpires = Date.now() + 15 * 60 * 1000; // 15 minutes
  return resetToken; // send plain token to user via email
};

const OTP_TTL_MS      = 10 * 60 * 1000; // 10 minutes
const OTP_MAX_ATTEMPTS = 5;

const hashOtp = otp => crypto.createHash('sha256').update(String(otp)).digest('hex');

/* ── Generate a 5-digit password-reset OTP ───────────────────────
   Only the hash is persisted, same as the reset token — a leaked DB
   dump shouldn't hand out working codes. randomInt (not Math.random)
   because this is a credential. */
userSchema.methods.createPasswordResetOtp = function () {
  const otp = String(crypto.randomInt(10000, 100000)); // always 5 digits, no leading-zero edge case
  this.passwordResetOtp        = hashOtp(otp);
  this.passwordResetOtpExpires = Date.now() + OTP_TTL_MS;
  this.passwordResetAttempts   = 0;
  return otp;
};

/* Returns 'ok' | 'expired' | 'locked' | 'invalid'. Wrong guesses burn an
   attempt so a 5-digit code can't be brute-forced (100k combinations). */
userSchema.methods.verifyPasswordResetOtp = function (otp) {
  if (!this.passwordResetOtp || !this.passwordResetOtpExpires) return 'expired';
  if (this.passwordResetOtpExpires.getTime() < Date.now()) return 'expired';
  if ((this.passwordResetAttempts || 0) >= OTP_MAX_ATTEMPTS) return 'locked';

  const supplied = hashOtp(String(otp || '').trim());
  const expected = this.passwordResetOtp;
  const match = supplied.length === expected.length
    && crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));

  if (!match) {
    this.passwordResetAttempts = (this.passwordResetAttempts || 0) + 1;
    return 'invalid';
  }
  return 'ok';
};

userSchema.methods.clearPasswordResetOtp = function () {
  this.passwordResetOtp        = undefined;
  this.passwordResetOtpExpires = undefined;
  this.passwordResetAttempts   = 0;
};

userSchema.statics.OTP_MAX_ATTEMPTS = OTP_MAX_ATTEMPTS;

/* ── Update streak ───────────────────────────────────────────────
   Compares calendar dates (UTC 'YYYY-MM-DD'), not raw 24h windows — a
   rolling-ms diff would wrongly treat "studied 23:59 yesterday, then
   00:05 today" as the same day (diff < 24h) and miss the increment. */
userSchema.methods.updateStreak = function () {
  const dateKey = d => d.toISOString().slice(0, 10);
  const now   = new Date();
  const today = dateKey(now);
  const last  = this.lastStudied ? dateKey(new Date(this.lastStudied)) : null;

  if (!last) {
    this.streak = 1;
  } else if (last !== today) {
    const yesterday = dateKey(new Date(now.getTime() - 24 * 60 * 60 * 1000));
    this.streak = last === yesterday ? this.streak + 1 : 1;
  }
  // last === today → already studied today, no change
  this.lastStudied = now;
};

module.exports = mongoose.model('User', userSchema);
