const { body, validationResult } = require('express-validator');

/* ── Run validation and return errors ────────────────────────── */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: errors.array()[0].msg,
      errors:  errors.array(),
    });
  }
  next();
};

/* ── Auth validators ─────────────────────────────────────────── */
exports.validateSignup = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 60 }),
  body('email').isEmail().withMessage('Valid email required').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  validate,
];

exports.validateLogin = [
  body('email').isEmail().withMessage('Valid email required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
  validate,
];

exports.validateForgotPassword = [
  body('email').isEmail().withMessage('Valid email required').normalizeEmail(),
  validate,
];

exports.validatePreregistration = [
  body('email').isEmail().withMessage('Valid email required').normalizeEmail(),
  validate,
];

exports.validateResetPassword = [
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  validate,
];

/* ── Vocabulary validators ───────────────────────────────────── */
exports.validateVocab = [
  body('level').isIn(['N5','N4','N3','N2','N1']).withMessage('Valid level required'),
  body('kanji').trim().notEmpty().withMessage('Kanji/word is required'),
  body('kana').trim().notEmpty().withMessage('Kana reading is required'),
  body('meaning').trim().notEmpty().withMessage('Meaning is required'),
  body('type').optional().isIn(['noun','verb','adj','adverb','particle','expression']),
  validate,
];

/* ── Kanji validators ────────────────────────────────────────── */
exports.validateKanji = [
  body('level').isIn(['N5','N4','N3','N2','N1']).withMessage('Valid level required'),
  body('char').trim().notEmpty().withMessage('Kanji character is required'),
  body('meaning').trim().notEmpty().withMessage('Meaning is required'),
  body('readings').optional().trim(),
  body('names').optional().trim(),
  body('kunyomi').optional().trim(),
  body('kunyomiEnglish').optional().trim(),
  body('onyomi').optional().trim(),
  body('onyomiEnglish').optional().trim(),
  body('popularReading').optional().trim(),
  body('strokes').isInt({ min: 1 }).withMessage('Stroke count must be a positive number'),
  validate,
];

/* ── Grammar validators ──────────────────────────────────────── */
exports.validateGrammar = [
  body('level').isIn(['N5','N4','N3','N2','N1']).withMessage('Valid level required'),
  body('title').trim().notEmpty().withMessage('Grammar title is required'),
  body('explanation').trim().notEmpty().withMessage('Explanation is required'),
  validate,
];

/* ── Quiz validators ─────────────────────────────────────────── */
exports.validateQuiz = [
  body('level').isIn(['N5','N4','N3','N2','N1']).withMessage('Valid level required'),
  body('question').trim().notEmpty().withMessage('Question is required'),
  body('options').isArray({ min: 4, max: 4 }).withMessage('Exactly 4 options required'),
  body('answer').isInt({ min: 0, max: 3 }).withMessage('Answer must be 0–3'),
  validate,
];

/* ── Announcement validators ─────────────────────────────────── */
exports.validateAnnouncement = [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('body').trim().notEmpty().withMessage('Message body is required'),
  body('status').optional().isIn(['draft','published']),
  validate,
];
