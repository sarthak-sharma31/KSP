const jwt        = require('jsonwebtoken');
const nodemailer = require('nodemailer');

/* ── Generate user JWT ───────────────────────────────────────── */
exports.generateUserToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

/* ── Generate admin JWT ──────────────────────────────────────── */
exports.generateAdminToken = (id) =>
  jwt.sign({ id }, process.env.JWT_ADMIN_SECRET, {
    expiresIn: process.env.JWT_ADMIN_EXPIRES_IN || '1d',
  });

/* ── Send token response ─────────────────────────────────────── */
exports.sendTokenResponse = (user, statusCode, res, isAdmin = false) => {
  const token = isAdmin
    ? exports.generateAdminToken(user._id)
    : exports.generateUserToken(user._id);

  res.status(statusCode).json({
    success: true,
    token,
    user: {
      _id:          user._id,
      name:         user.name,
      email:        user.email,
      role:         user.role,
      status:       user.status,
      currentLevel: user.currentLevel,
      xp:           user.xp,
      streak:       user.streak,
      createdAt:    user.createdAt,
    },
  });
};

/* ── Nodemailer transporter ──────────────────────────────────── */
const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/* ── Send password reset email ───────────────────────────────── */
exports.sendPasswordResetEmail = async ({ email, name, resetUrl }) => {
  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#f9f9f9;border-radius:12px;">
      <div style="text-align:center;margin-bottom:24px;">
        <span style="font-size:36px;">🦊</span>
        <h2 style="color:#f97316;margin:8px 0 0;">KitsuSpeak</h2>
      </div>
      <h3 style="color:#1a1a2e;">Password Reset Request</h3>
      <p style="color:#555;line-height:1.6;">Hi <strong>${name}</strong>,</p>
      <p style="color:#555;line-height:1.6;">
        We received a request to reset your KitsuSpeak password.
        Click the button below to set a new password.
        This link expires in <strong>15 minutes</strong>.
      </p>
      <div style="text-align:center;margin:28px 0;">
        <a href="${resetUrl}"
          style="background:#f97316;color:#fff;padding:14px 28px;border-radius:9px;
                 text-decoration:none;font-weight:700;font-size:15px;">
          Reset My Password
        </a>
      </div>
      <p style="color:#999;font-size:13px;line-height:1.6;">
        If you didn't request this, you can safely ignore this email.
        Your password will not change.
      </p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
      <p style="color:#ccc;font-size:12px;text-align:center;">
        © ${new Date().getFullYear()} KitsuSpeak. All rights reserved.
      </p>
    </div>
  `;

  await transporter.sendMail({
    from:    `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
    to:      email,
    subject: 'KitsuSpeak — Reset Your Password',
    html,
  });
};