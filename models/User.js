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

  // Password reset
  passwordResetToken:   { type: String, select: false },
  passwordResetExpires: { type: Date,   select: false },
}, {
  timestamps: true, // adds createdAt, updatedAt
});

/* ── Hash password before save ───────────────────────────────── */
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
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

/* ── Update streak ───────────────────────────────────────────── */
userSchema.methods.updateStreak = function () {
  const now      = new Date();
  const lastDate = this.lastStudied ? new Date(this.lastStudied) : null;
  if (!lastDate) {
    this.streak = 1;
  } else {
    const diffDays = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) this.streak += 1;        // studied yesterday
    else if (diffDays > 1) this.streak = 1;      // broke streak
    // diffDays === 0 → same day, no change
  }
  this.lastStudied = now;
};

module.exports = mongoose.model('User', userSchema);
