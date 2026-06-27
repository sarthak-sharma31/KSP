const { PracticeTest, TestAttempt, TestProgress } = require('../models/index');
const { asyncHandler } = require('../middleware/error');

/* ════════════════════════════════════════════════════════════════
   PUBLIC ENDPOINTS — User test-taking
════════════════════════════════════════════════════════════════ */

/**
 * GET /api/practice-tests
 * Get all available practice tests for a user
 */
exports.getAllTests = asyncHandler(async (req, res) => {
  const { level, page = 1, limit = 20 } = req.query;
  const filter = { isActive: true };
  if (level) filter.level = level;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const total = await PracticeTest.countDocuments(filter);
  const data = await PracticeTest.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  res.json({
    success: true,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / parseInt(limit)),
    data,
  });
});

/**
 * GET /api/practice-tests/:id
 * Get a specific practice test with all questions
 */
exports.getTest = asyncHandler(async (req, res) => {
  const test = await PracticeTest.findById(req.params.id);
  if (!test) {
    return res.status(404).json({ success: false, message: 'Test not found' });
  }
  res.json({ success: true, data: test });
});

/**
 * GET /api/practice-tests/:id/progress
 * Get user's in-progress test state (for resuming)
 */
exports.getTestProgress = asyncHandler(async (req, res) => {
  const progress = await TestProgress.findOne({
    user: req.user._id,
    practiceTest: req.params.id,
  });

  if (!progress) {
    return res.status(404).json({ success: false, message: 'No in-progress test found' });
  }

  res.json({ success: true, data: progress });
});

/**
 * POST /api/practice-tests/:id/start
 * Initialize a new test attempt
 */
exports.startTest = asyncHandler(async (req, res) => {
  const test = await PracticeTest.findById(req.params.id);
  if (!test) {
    return res.status(404).json({ success: false, message: 'Test not found' });
  }

  // Check if user already has an in-progress test
  let progress = await TestProgress.findOne({
    user: req.user._id,
    practiceTest: req.params.id,
  });

  if (!progress) {
    // Create new progress record
    const sections = {};
    test.sections.forEach(section => {
      sections[section.name] = {
        sectionName: section.name,
        currentQuestionIndex: 0,
        answers: {},
        timeRemaining: section.duration * 60, // convert to seconds
      };
    });

    progress = await TestProgress.create({
      user: req.user._id,
      practiceTest: req.params.id,
      currentSection: 'vocabulary',
      sections,
      totalTimeRemaining: test.totalDuration * 60,
      startedAt: new Date(),
      lastAccessedAt: new Date(),
    });
  }

  res.json({ success: true, data: progress });
});

/**
 * POST /api/practice-tests/:id/submit
 * Submit completed test and save results
 */
exports.submitTest = asyncHandler(async (req, res) => {
  const { answers } = req.body; // { vocabulary: {...}, 'grammar-reading': {...}, listening: {...} }

  if (!answers) {
    return res.status(400).json({ success: false, message: 'Answers are required' });
  }

  const test = await PracticeTest.findById(req.params.id);
  if (!test) {
    return res.status(404).json({ success: false, message: 'Test not found' });
  }

  // Calculate results for each section
  const sections = [];
  let totalCorrect = 0;
  let totalQuestions = 0;
  let totalTimeTaken = 0;

  test.sections.forEach(section => {
    const sectionAnswers = answers[section.name] || {};
    let correctCount = 0;
    const sectionResults = [];

    section.questions.forEach(question => {
      const userAnswer = sectionAnswers[question._id.toString()];
      const isCorrect = userAnswer === question.answer;
      if (isCorrect) correctCount++;

      sectionResults.push({
        questionId: question._id,
        question: question.question,
        userAnswer,
        correctAnswer: question.answer,
        isCorrect,
      });

      totalQuestions++;
    });

    const sectionScore = section.questions.length > 0
      ? Math.round((correctCount / section.questions.length) * 100)
      : 0;

    sections.push({
      sectionName: section.name,
      displayName: section.displayName,
      totalQuestions: section.questions.length,
      correctAnswers: correctCount,
      score: sectionScore,
      timeTaken: req.body.timeTaken?.[section.name] || 0,
      answers: sectionResults,
    });

    totalCorrect += correctCount;
    totalTimeTaken += req.body.timeTaken?.[section.name] || 0;
  });

  const totalScore = totalQuestions > 0
    ? Math.round((totalCorrect / totalQuestions) * 100)
    : 0;

  // Create test attempt record
  const attempt = await TestAttempt.create({
    user: req.user._id,
    practiceTest: req.params.id,
    level: test.level,
    testTitle: test.title,
    totalScore,
    totalQuestions,
    totalCorrect,
    totalDuration: totalTimeTaken,
    sections,
    status: 'completed',
  });

  // Delete in-progress record
  await TestProgress.deleteOne({
    user: req.user._id,
    practiceTest: req.params.id,
  });

  res.status(201).json({ success: true, data: attempt });
});

/**
 * GET /api/practice-tests/attempts/history
 * Get user's test history
 */
exports.getUserTestHistory = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const total = await TestAttempt.countDocuments({ user: req.user._id });
  const attempts = await TestAttempt.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .populate('practiceTest', 'title level');

  res.json({
    success: true,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / parseInt(limit)),
    data: attempts,
  });
});

/**
 * GET /api/practice-tests/attempts/:attemptId
 * Get detailed results of a specific test attempt
 */
exports.getAttemptDetails = asyncHandler(async (req, res) => {
  const attempt = await TestAttempt.findById(req.params.attemptId);

  if (!attempt) {
    return res.status(404).json({ success: false, message: 'Attempt not found' });
  }

  // Verify user owns this attempt
  if (attempt.user.toString() !== req.user._id.toString()) {
    return res.status(403).json({ success: false, message: 'Unauthorized' });
  }

  res.json({ success: true, data: attempt });
});

/* ════════════════════════════════════════════════════════════════
   ADMIN ENDPOINTS — Test management
════════════════════════════════════════════════════════════════ */

/**
 * GET /api/admin/practice-tests
 * Get all practice tests (admin)
 */
exports.adminGetAllTests = asyncHandler(async (req, res) => {
  const { level, page = 1, limit = 20 } = req.query;
  const filter = {};
  if (level) filter.level = level;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const total = await PracticeTest.countDocuments(filter);
  const data = await PracticeTest.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  res.json({
    success: true,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / parseInt(limit)),
    data,
  });
});

/**
 * POST /api/admin/practice-tests
 * Create a new practice test
 */
exports.adminCreateTest = asyncHandler(async (req, res) => {
  const { level, title, description, version, sections } = req.body;

  // Validate sections
  if (!sections || sections.length !== 3) {
    return res.status(400).json({
      success: false,
      message: 'Test must have exactly 3 sections',
    });
  }

  // Calculate total duration
  const totalDuration = sections.reduce((sum, s) => sum + s.duration, 0);

  const test = await PracticeTest.create({
    level,
    title,
    description,
    version,
    sections,
    totalDuration,
    createdBy: req.user._id,
  });

  res.status(201).json({ success: true, data: test });
});

/**
 * PUT /api/admin/practice-tests/:id
 * Update a practice test
 */
exports.adminUpdateTest = asyncHandler(async (req, res) => {
  const { sections } = req.body;

  // Recalculate total duration if sections changed
  let updateData = { ...req.body };
  if (sections) {
    updateData.totalDuration = sections.reduce((sum, s) => sum + s.duration, 0);
  }

  const test = await PracticeTest.findByIdAndUpdate(
    req.params.id,
    updateData,
    { new: true, runValidators: true }
  );

  if (!test) {
    return res.status(404).json({ success: false, message: 'Test not found' });
  }

  res.json({ success: true, data: test });
});

/**
 * DELETE /api/admin/practice-tests/:id
 * Delete a practice test
 */
exports.adminDeleteTest = asyncHandler(async (req, res) => {
  const test = await PracticeTest.findByIdAndDelete(req.params.id);

  if (!test) {
    return res.status(404).json({ success: false, message: 'Test not found' });
  }

  // Clean up associated attempts
  await TestAttempt.deleteMany({ practiceTest: req.params.id });
  await TestProgress.deleteMany({ practiceTest: req.params.id });

  res.json({ success: true, message: 'Test deleted' });
});

/**
 * GET /api/admin/practice-tests/:id/attempts
 * Get all attempts for a specific test
 */
exports.adminGetTestAttempts = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const total = await TestAttempt.countDocuments({ practiceTest: req.params.id });
  const attempts = await TestAttempt.find({ practiceTest: req.params.id })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .populate('user', 'name email');

  res.json({
    success: true,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / parseInt(limit)),
    data: attempts,
  });
});
