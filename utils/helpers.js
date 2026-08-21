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
      authProvider: user.authProvider,
      status:       user.status,
      currentLevel: user.currentLevel,
      xp:           user.xp,
      streak:       user.streak,
      lastStudied:  user.lastStudied,
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

const formatAddress = (name, email) => {
  const safeName = String(name || '').trim();
  const safeEmail = String(email || '').trim();
  return safeName ? `"${safeName}" <${safeEmail}>` : safeEmail;
};

const sendMail = async ({ toEmail, toName, subject, html, text, attachments }) => {
  await transporter.sendMail({
    from:    formatAddress(process.env.FROM_NAME, process.env.FROM_EMAIL),
    to:      formatAddress(toName, toEmail),
    envelope: {
      from: process.env.FROM_EMAIL,
      to: toEmail,
    },
    subject,
    text,
    html,
    /* The logo travels with the message as an inline attachment; see
       the note above the templates for why cid: rather than a URL. */
    ...(attachments ? { attachments } : {}),
  });
};

/* ══════════════════════════════════════════════════════════════
   EMAIL TEMPLATES

   Every message shares one shell so the four of them read as one
   product. Three rules the old templates broke:

   1. Tables, not divs. Outlook on Windows renders mail through the
      Word engine, which ignores max-width, border-radius and most
      box styling on a <div>. A 600px table with inline styles is
      the only layout every client agrees on.
   2. The logo is a real image, embedded by CID. Gmail strips inline
      <svg> and refuses `src="data:..."` outright, so an attachment
      referenced as cid: is the only way a logo reliably renders. If
      the recipient blocks images anyway, the wordmark beside it is
      live text, so the header never collapses to a broken icon.
   3. The dark palette is declared, not assumed. `color-scheme` stops
      Gmail and Apple Mail from "helpfully" inverting a design that is
      already dark, and every cell carries a bgcolor attribute so
      Outlook paints it too.
══════════════════════════════════════════════════════════════ */

const path = require('path');

/* Straight from the app's own palette — data/constants.js. */
const MAIL = {
  /* One flat surface. The card used to float on a darker page, which read
     as a black frame around a grey box rather than as depth — email clients
     letterbox the message anyway, so the outer colour only ever showed up
     as that frame. Page and card are now the same value. */
  page:    '#16232a',
  card:    '#16232a',
  edge:    '#16232a',
  accent:  '#f97316',
  text:    '#f7f3ea',
  muted:   '#a8b0b4',
  faint:   '#6f7a80',
  chip:    '#0f1a1f',   // OTP digit wells
};

const LOGO_CID = 'kitsuspeak-logo';
const LOGO_PATH = path.join(__dirname, '..', 'assets', 'kitsuspeak-logo.png');

/* Attached to every message and referenced as cid:. `cid` must be
   unique within the message; nodemailer marks it inline for us. */
const logoAttachment = () => ([{
  filename: 'kitsuspeak.png',
  path: LOGO_PATH,
  cid: LOGO_CID,
}]);

/* A button that survives Outlook, which ignores padding on an <a>.
   The VML fallback gives it a real filled rectangle there; every
   other client reads the <a> and skips the comment. */
const button = (href, label) => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
    <tr>
      <td align="center" bgcolor="${MAIL.accent}" style="border-radius:10px;">
        <!--[if mso]>
        <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${href}" style="height:46px;v-text-anchor:middle;width:230px;" arcsize="21%" stroke="f" fillcolor="${MAIL.accent}">
        <w:anchorlock/><center style="color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;">${label}</center>
        </v:roundrect>
        <![endif]-->
        <!--[if !mso]><!-- -->
        <a href="${href}"
           style="display:inline-block;padding:14px 30px;font-family:'Nunito',Helvetica,Arial,sans-serif;
                  font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">
          ${label}
        </a>
        <!--<![endif]-->
      </td>
    </tr>
  </table>`;

/* One digit per cell, laid out as a row of table cells rather than
   inline-blocks so the spacing holds in Outlook. */
const otpDigits = (otp) => {
  const cells = String(otp).split('').map(d => `
    <td align="center" width="52" bgcolor="${MAIL.chip}"
        style="width:52px;height:58px;border:1px solid rgba(249,115,22,0.38);border-radius:10px;
               font-family:'Nunito',Helvetica,Arial,sans-serif;font-size:27px;font-weight:800;
               color:${MAIL.accent};">${d}</td>
    <td width="8" style="width:8px;font-size:0;line-height:0;">&nbsp;</td>`).join('');

  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
    <tr>${cells}</tr>
  </table>`;
};

/* The shell. `preheader` is the grey line clients show next to the
   subject in the inbox list; without one they scrape the first text
   they find, which is usually the alt text of the logo. */
const layout = ({ preheader, heading, body, footNote }) => `<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>KitsuSpeak</title>
  <!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:${MAIL.page};" bgcolor="${MAIL.page}">

  <div style="display:none;font-size:1px;color:${MAIL.page};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    ${preheader}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${MAIL.page}" style="background-color:${MAIL.page};">
    <tr>
      <td align="center" style="padding:32px 16px;">

        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
               style="width:600px;max-width:600px;background-color:${MAIL.card};"
               bgcolor="${MAIL.card}">

          <!-- Brand -->
          <tr>
            <td align="center" style="padding:36px 32px 8px;">
              <img src="cid:${LOGO_CID}" width="52" height="52" alt="KitsuSpeak"
                   style="display:block;width:52px;height:52px;border:0;">
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:0 32px 26px;">
              <span style="font-family:'Nunito',Helvetica,Arial,sans-serif;font-size:21px;font-weight:800;
                           letter-spacing:-0.4px;color:${MAIL.text};">Kitsu<span style="color:${MAIL.accent};">Speak</span></span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:0 32px;">
              <h1 style="margin:0 0 16px;font-family:'Nunito',Helvetica,Arial,sans-serif;font-size:20px;
                         font-weight:800;color:${MAIL.text};letter-spacing:-0.2px;">${heading}</h1>
              ${body}
            </td>
          </tr>

          <!-- Foot note -->
          <tr>
            <td style="padding:26px 32px 0;">
              <p style="margin:0;font-family:'Nunito',Helvetica,Arial,sans-serif;font-size:13px;
                        line-height:1.65;color:${MAIL.faint};">${footNote}</p>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 32px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td height="1" bgcolor="#243139" style="height:1px;line-height:1px;font-size:0;">&nbsp;</td></tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:18px 32px 30px;">
              <p style="margin:0;font-family:'Nunito',Helvetica,Arial,sans-serif;font-size:12px;color:${MAIL.faint};">
                &copy; ${new Date().getFullYear()} KitsuSpeak &middot; Learn Japanese, like a fox.
              </p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;

/* Body paragraph, so every template spaces its prose identically. */
const p = (html, extra = '') => `
  <p style="margin:0 0 14px;font-family:'Nunito',Helvetica,Arial,sans-serif;font-size:15px;
            line-height:1.7;color:${MAIL.muted};${extra}">${html}</p>`;

const strong = txt => `<strong style="color:${MAIL.text};font-weight:700;">${txt}</strong>`;

const spacer = h => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td height="${h}" style="height:${h}px;line-height:${h}px;font-size:0;">&nbsp;</td></tr></table>`;

/* ── Send password reset email ───────────────────────────────── */
exports.sendPasswordResetEmail = async ({ email, name, resetUrl }) => {
  const html = layout({
    preheader: 'Reset your KitsuSpeak password — the link expires in 15 minutes.',
    heading: 'Reset your password',
    body: `
      ${p(`Hi ${strong(name)},`)}
      ${p(`We received a request to reset your KitsuSpeak password. Use the button below to choose a new one — it expires in ${strong('15 minutes')}.`)}
      ${spacer(12)}
      ${button(resetUrl, 'Reset my password')}
      ${spacer(8)}
    `,
    footNote: "If you didn't request this, you can safely ignore this email — your password will not change.",
  });

  await sendMail({
    toEmail: email,
    toName: name,
    subject: 'Reset your KitsuSpeak password',
    text: [
      `Hi ${name},`,
      '',
      'We received a request to reset your KitsuSpeak password.',
      'Open the link below to set a new password:',
      resetUrl,
      '',
      'This link expires in 15 minutes.',
      "If you didn't request this, you can safely ignore this email.",
    ].join('\n'),
    html,
    attachments: logoAttachment(),
  });
};

/* ── Send password reset OTP ─────────────────────────────────── */
exports.sendPasswordResetOtpEmail = async ({ email, name, otp, ttlMinutes = 10 }) => {
  const html = layout({
    preheader: `${otp} is your KitsuSpeak password reset code.`,
    heading: 'Your password reset code',
    body: `
      ${p(`Hi ${strong(name)},`)}
      ${p(`Use the code below to reset your KitsuSpeak password. It expires in ${strong(`${ttlMinutes} minutes`)}.`)}
      ${spacer(16)}
      ${otpDigits(otp)}
      ${spacer(10)}
    `,
    footNote: "If you didn't request this, you can safely ignore this email — your password will not change. Never share this code with anyone.",
  });

  await sendMail({
    toEmail: email,
    toName: name,
    subject: `${otp} is your KitsuSpeak password reset code`,
    text: [
      `Hi ${name},`,
      '',
      `Your KitsuSpeak password reset code is: ${otp}`,
      '',
      `This code expires in ${ttlMinutes} minutes.`,
      "If you didn't request this, you can safely ignore this email.",
    ].join('\n'),
    html,
    attachments: logoAttachment(),
  });
};

/* ── Send welcome email ──────────────────────────────────────── */
exports.sendWelcomeEmail = async ({ email, name }) => {
  const html = layout({
    preheader: 'Your Japanese journey starts now — here is where to begin.',
    heading: 'Your Japanese journey starts now',
    body: `
      ${p(`Hi ${strong(name)},`)}
      ${p('Thanks for joining KitsuSpeak. Your account is ready, and so is the whole course — the kana alphabets, kanji review, grammar chapters, flashcards, and full JLPT mock exams.')}
      ${p(`Start at the top of the learning path. Each step unlocks the next, so you never have to guess what to study today.`)}
      ${spacer(12)}
      ${button(process.env.CLIENT_URL || '#', 'Start learning')}
      ${spacer(8)}
    `,
    footNote: 'Studying a few minutes a day beats one long session a week — your streak is there to make that easy.',
  });

  await sendMail({
    toEmail: email,
    toName: name,
    subject: 'Welcome to KitsuSpeak',
    text: [
      `Hi ${name},`,
      '',
      'Thanks for joining KitsuSpeak.',
      'Your account is ready: kana, kanji, grammar chapters, flashcards and full JLPT mock exams.',
      '',
      'Start here:',
      `${process.env.CLIENT_URL || ''}`,
    ].join('\n'),
    html,
    attachments: logoAttachment(),
  });
};

/* ── Send signup verification OTP ────────────────────────────────
   Same digit treatment as the reset code so the two feel like one
   system, but worded so a stranger who receives it (because someone
   typed their address by mistake) knows to do nothing. */
exports.sendSignupOtpEmail = async ({ email, name, otp, ttlMinutes = 15 }) => {
  const html = layout({
    preheader: `${otp} is your KitsuSpeak verification code.`,
    heading: 'Confirm your email',
    body: `
      ${p(`Hi ${strong(name)},`)}
      ${p(`Enter this code to finish creating your KitsuSpeak account. It expires in ${strong(`${ttlMinutes} minutes`)}.`)}
      ${spacer(16)}
      ${otpDigits(otp)}
      ${spacer(10)}
    `,
    footNote: "Didn't sign up? Someone probably mistyped their address. No account has been created, and nothing will happen if you ignore this email.",
  });

  await sendMail({
    toEmail: email,
    toName: name,
    subject: `${otp} is your KitsuSpeak verification code`,
    text: [
      `Hi ${name},`,
      '',
      `Your KitsuSpeak verification code is: ${otp}`,
      '',
      `This code expires in ${ttlMinutes} minutes.`,
      "Didn't sign up? No account has been created — you can ignore this email.",
    ].join('\n'),
    html,
    attachments: logoAttachment(),
  });
};
