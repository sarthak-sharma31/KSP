const { body, validationResult } = require('express-validator');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: errors.array()[0].msg,
      errors: errors.array(),
    });
  }
  next();
};

exports.validatePracticeTest = [
  body('level').isIn(['N5', 'N4', 'N3', 'N2', 'N1']).withMessage('Valid level required'),
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('description').optional().trim(),
  body('version').optional().trim(),
  body('sections').isArray({ min: 3, max: 3 }).withMessage('Must have exactly 3 sections'),
  body('sections.*.name').isIn(['vocabulary', 'grammar-reading', 'listening']).withMessage('Invalid section name'),
  body('sections.*.displayName').notEmpty().withMessage('Section display name required'),
  body('sections.*.duration').isInt({ min: 1 }).withMessage('Duration must be a positive number'),
  body('sections.*.questions').isArray().withMessage('Questions must be an array'),
  body('sections.*.questions.*.question').notEmpty().withMessage('Question text required'),
  body('sections.*.questions.*.options').isArray({ min: 4, max: 4 }).withMessage('Exactly 4 options required'),
  body('sections.*.questions.*.answer').isInt({ min: 0, max: 3 }).withMessage('Answer must be 0-3'),
  body('sections.*.questions.*.imageUrl').optional().trim(),
  body('sections.*.questions.*.explanation').optional().trim(),
  body('sections.*.audioUrl').optional().trim(),
  validate,
];

exports.validateTestSubmission = [
  body('answers').notEmpty().withMessage('Answers are required'),
  validate,
];
