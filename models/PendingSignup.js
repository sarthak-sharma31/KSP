const mongoose = require('mongoose');
const crypto = require('crypto');

/* ══════════════════════════════════════════════════════════════
   PENDING SIGNUP
   A registration that has been submitted but not yet proven to
   belong to a real inbox.

   Deliberately a separate collection rather than an `emailVerified`
   flag on User:

     - No unverified junk ever reaches the users collection, which
       is the actual complaint — a fake address cannot register at
       all, rather than registering and then being fenced off.
     - Every existing account keeps working. Flipping a flag on User
       would have locked out everyone who signed up before today.
     - No route needs a new guard. If there is no user, there is
       nothing to protect.
     - Abandoned attempts evaporate on their own via the TTL index
       below, instead of accumulating forever.

   The password is stored already bcrypt-hashed, so an abandoned
   signup sitting here is not a plaintext credential.
══════════════════════════════════════════════════════════════ */

const OTP_TTL_MS = 15 * 60 * 1000;   // how long a code stays valid
const DOC_TTL_SECONDS = 30 * 60;     // how long an unfinished signup survives
const MAX_ATTEMPTS = 5;              // wrong codes before the record locks
const MAX_RESENDS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000;

const hashOtp = otp => crypto.createHash('sha256').update(String(otp)).digest('hex');

const pendingSignupSchema = new mongoose.Schema({
  email:        { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  name:         { type: String, required: true, trim: true },
  passwordHash: { type: String, required: true, select: false },

  otp:        { type: String, required: true, select: false }, // sha256, never the digits
  otpExpires: { type: Date, required: true },
  attempts:   { type: Number, default: 0 },

  resendCount: { type: Number, default: 0 },
  lastSentAt:  { type: Date, default: Date.now },

  /* Mongo deletes the document once this is DOC_TTL_SECONDS old, so an
     abandoned signup never blocks the address permanently. */
  createdAt: { type: Date, default: Date.now, expires: DOC_TTL_SECONDS },
});

/* Issue a fresh code and reset the attempt counter — a new code always
   deserves a clean slate, otherwise a locked record could never recover. */
pendingSignupSchema.methods.issueOtp = function issueOtp() {
  const otp = String(crypto.randomInt(100000, 1000000)); // 6 digits, no leading-zero case
  this.otp = hashOtp(otp);
  this.otpExpires = Date.now() + OTP_TTL_MS;
  this.attempts = 0;
  this.lastSentAt = new Date();
  return otp;
};

/* Returns 'ok' | 'expired' | 'locked' | 'wrong'. Burns an attempt on a
   miss so a six-digit code cannot be brute-forced by a loop. */
pendingSignupSchema.methods.verifyOtp = function verifyOtp(supplied) {
  if (this.attempts >= MAX_ATTEMPTS) return 'locked';
  if (!this.otp || !this.otpExpires || this.otpExpires.getTime() < Date.now()) return 'expired';

  const a = Buffer.from(hashOtp(String(supplied || '').trim()));
  const b = Buffer.from(this.otp);
  const match = a.length === b.length && crypto.timingSafeEqual(a, b);

  if (!match) {
    this.attempts += 1;
    return this.attempts >= MAX_ATTEMPTS ? 'locked' : 'wrong';
  }
  return 'ok';
};

pendingSignupSchema.methods.canResend = function canResend() {
  if (this.resendCount >= MAX_RESENDS) return { ok: false, reason: 'limit' };
  const waited = Date.now() - new Date(this.lastSentAt).getTime();
  if (waited < RESEND_COOLDOWN_MS) {
    return { ok: false, reason: 'cooldown', retryInSeconds: Math.ceil((RESEND_COOLDOWN_MS - waited) / 1000) };
  }
  return { ok: true };
};

const PendingSignup = mongoose.model('PendingSignup', pendingSignupSchema);

PendingSignup.OTP_TTL_MINUTES = OTP_TTL_MS / 60000;
PendingSignup.MAX_ATTEMPTS = MAX_ATTEMPTS;
PendingSignup.MAX_RESENDS = MAX_RESENDS;
PendingSignup.RESEND_COOLDOWN_SECONDS = RESEND_COOLDOWN_MS / 1000;

module.exports = PendingSignup;
