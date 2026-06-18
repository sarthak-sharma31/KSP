const { Kanji, Grammar, Quiz, Progress, QuizAttempt, Announcement, Preregistration} = require('../models/index');
const User              = require('../models/User');
const KanaProgress      = require('../models/KanaProgress');
const { asyncHandler }  = require('../middleware/error');

exports.createPreregistration = asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').toLowerCase().trim();
  const existing = await Preregistration.findOne({ email });

  if (existing) {
    return res.json({
      success: true,
      message: 'You are already on the early access list.',
      data: { email: existing.email },
    });
  }

  const item = await Preregistration.create({
    email,
    source: req.body.source || 'website',
    userAgent: req.get('user-agent') || '',
    ip: req.ip || '',
  });

  res.status(201).json({
    success: true,
    message: 'You are on the early access list.',
    data: { email: item.email },
  });
});


/* ════════════════════════════════════════════════════════════════
   KANJI
════════════════════════════════════════════════════════════════ */
exports.getAllKanji = asyncHandler(async (req, res) => {
  const { level, page = 1, limit = 500, search } = req.query;
  const filter = { isActive: true };
  if (level)  filter.level = level;
  if (search) filter.$or = [
    { char:           { $regex: search, $options: 'i' } },
    { meaning:        { $regex: search, $options: 'i' } },
    { names:          { $regex: search, $options: 'i' } },
    { readings:       { $regex: search, $options: 'i' } },
    { kunyomi:        { $regex: search, $options: 'i' } },
    { onyomi:         { $regex: search, $options: 'i' } },
    { popularReading: { $regex: search, $options: 'i' } },
  ];

  const skip  = (parseInt(page) - 1) * parseInt(limit);
  const total = await Kanji.countDocuments(filter);
  const data  = await Kanji.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit));
  res.json({ success: true, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)), data });
});

exports.getOneKanji = asyncHandler(async (req, res) => {
  const item = await Kanji.findById(req.params.id);
  if (!item) return res.status(404).json({ success: false, message: 'Kanji not found' });
  res.json({ success: true, data: item });
});

exports.createKanji = asyncHandler(async (req, res) => {
  const item = await Kanji.create({ ...req.body, createdBy: req.user._id });
  res.status(201).json({ success: true, data: item });
});

exports.updateKanji = asyncHandler(async (req, res) => {
  const item = await Kanji.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!item) return res.status(404).json({ success: false, message: 'Kanji not found' });
  res.json({ success: true, data: item });
});

exports.removeKanji = asyncHandler(async (req, res) => {
  const item = await Kanji.findByIdAndDelete(req.params.id);
  if (!item) return res.status(404).json({ success: false, message: 'Kanji not found' });
  res.json({ success: true, message: 'Kanji deleted' });
});

/* ════════════════════════════════════════════════════════════════
   GRAMMAR
════════════════════════════════════════════════════════════════ */
exports.getAllGrammar = asyncHandler(async (req, res) => {
  const { level, page = 1, limit = 100, search } = req.query;
  const filter = { isActive: true };
  if (level)  filter.level = level;
  if (search) filter.$or = [
    { title:       { $regex: search, $options: 'i' } },
    { chapter:     { $regex: search, $options: 'i' } },
    { structure:   { $regex: search, $options: 'i' } },
    { explanation: { $regex: search, $options: 'i' } },
    { objective:   { $regex: search, $options: 'i' } },
    { example:     { $regex: search, $options: 'i' } },
    { exampleEn:   { $regex: search, $options: 'i' } },
  ];

  const skip  = (parseInt(page) - 1) * parseInt(limit);
  const total = await Grammar.countDocuments(filter);
  const data  = await Grammar.find(filter).sort({ level: 1, order: 1, createdAt: -1 }).skip(skip).limit(parseInt(limit));
  res.json({ success: true, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)), data });
});

exports.createGrammar = asyncHandler(async (req, res) => {
  const item = await Grammar.create({ ...req.body, createdBy: req.user._id });
  res.status(201).json({ success: true, data: item });
});

exports.updateGrammar = asyncHandler(async (req, res) => {
  const item = await Grammar.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!item) return res.status(404).json({ success: false, message: 'Grammar rule not found' });
  res.json({ success: true, data: item });
});

exports.removeGrammar = asyncHandler(async (req, res) => {
  const item = await Grammar.findByIdAndDelete(req.params.id);
  if (!item) return res.status(404).json({ success: false, message: 'Grammar rule not found' });
  res.json({ success: true, message: 'Grammar rule deleted' });
});

/* ════════════════════════════════════════════════════════════════
   QUIZ QUESTIONS
════════════════════════════════════════════════════════════════ */
exports.getAllQuiz = asyncHandler(async (req, res) => {
  const { level, page = 1, limit = 30 } = req.query;
  const filter = { isActive: true };
  if (level) filter.level = level;

  const skip  = (parseInt(page) - 1) * parseInt(limit);
  const total = await Quiz.countDocuments(filter);
  const data  = await Quiz.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit));
  res.json({ success: true, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)), data });
});

exports.getQuizForUser = asyncHandler(async (req, res) => {
  // Returns randomised set of questions for a user quiz session
  const { level = 'N5', limit = 10 } = req.query;
  const data = await Quiz.aggregate([
    { $match: { level, isActive: true } },
    { $sample: { size: parseInt(limit) } },
  ]);
  res.json({ success: true, data });
});

exports.createQuiz = asyncHandler(async (req, res) => {
  const item = await Quiz.create({ ...req.body, createdBy: req.user._id });
  res.status(201).json({ success: true, data: item });
});

exports.updateQuiz = asyncHandler(async (req, res) => {
  const item = await Quiz.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!item) return res.status(404).json({ success: false, message: 'Question not found' });
  res.json({ success: true, data: item });
});

exports.removeQuiz = asyncHandler(async (req, res) => {
  const item = await Quiz.findByIdAndDelete(req.params.id);
  if (!item) return res.status(404).json({ success: false, message: 'Question not found' });
  res.json({ success: true, message: 'Question deleted' });
});

/* ════════════════════════════════════════════════════════════════
   PROGRESS (SRS)
════════════════════════════════════════════════════════════════ */

/* SM-2 algorithm */
function sm2(easeFactor, repetitions, interval, quality) {
  // quality: 0-2 = fail, 3-5 = pass
  if (quality >= 3) {
    if (repetitions === 0)      interval = 1;
    else if (repetitions === 1) interval = 6;
    else                        interval = Math.round(interval * easeFactor);
    repetitions += 1;
    easeFactor = Math.max(1.3, easeFactor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  } else {
    repetitions = 0;
    interval    = 1;
  }
  return { easeFactor, repetitions, interval };
}

exports.updateProgress = asyncHandler(async (req, res) => {
  const { cardId, cardType, result, level } = req.body;
  // result: 'know' (quality 4) or 'unknown' (quality 1)
  const quality = result === 'know' ? 4 : 1;

  let progress = await Progress.findOne({ user: req.user._id, cardId, cardType });

  if (!progress) {
    progress = new Progress({ user: req.user._id, cardId, cardType, level });
  }

  const { easeFactor, repetitions, interval } = sm2(
    progress.easeFactor, progress.repetitions, progress.interval, quality
  );

  progress.easeFactor  = easeFactor;
  progress.repetitions = repetitions;
  progress.interval    = interval;
  progress.nextReview  = new Date(Date.now() + interval * 24 * 60 * 60 * 1000);
  progress.lastResult  = result;
  await progress.save();

  // Update user XP and streak
  const xpGain = result === 'know' ? 10 : 2;
  const user   = await User.findById(req.user._id);
  user.updateStreak();
  user.xp += xpGain;
  await user.save();

  res.json({ success: true, data: progress, xpGained: xpGain });
});

exports.getDueCards = asyncHandler(async (req, res) => {
  const { cardType = 'vocabulary', limit = 20 } = req.query;
  const cards = await Progress.find({
    user:       req.user._id,
    cardType,
    nextReview: { $lte: new Date() },
  })
    .sort({ nextReview: 1 })
    .limit(parseInt(limit))
    .populate('cardId');
  res.json({ success: true, data: cards });
});

exports.submitQuizAttempt = asyncHandler(async (req, res) => {
  const { level, score, total, duration, answers } = req.body;
  const attempt = await QuizAttempt.create({ user: req.user._id, level, score, total, duration, answers });

  // Reward XP
  const xpGain = score * 15;
  await User.findByIdAndUpdate(req.user._id, { $inc: { xp: xpGain } });

  res.status(201).json({ success: true, data: attempt, xpGained: xpGain });
});

exports.getUserStats = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  const totalCards    = await Progress.countDocuments({ user: req.user._id });
  const masteredCards = await Progress.countDocuments({ user: req.user._id, repetitions: { $gte: 3 } });
  const dueCount      = await Progress.countDocuments({ user: req.user._id, nextReview: { $lte: new Date() } });
  const recentQuizzes = await QuizAttempt.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(5);

  res.json({
    success: true,
    data: {
      xp:           user.xp,
      streak:       user.streak,
      level:        user.currentLevel,
      totalCards,
      masteredCards,
      dueCount,
      recentQuizzes,
    },
  });
});

/* ════════════════════════════════════════════════════════════════
   ANNOUNCEMENTS
════════════════════════════════════════════════════════════════ */
exports.getAnnouncements = asyncHandler(async (req, res) => {
  // Users only see published ones
  const isAdmin = req.user?.role === 'admin';
  const filter  = isAdmin ? {} : { status: 'published' };
  const data    = await Announcement.find(filter).sort({ createdAt: -1 });
  res.json({ success: true, data });
});

exports.createAnnouncement = asyncHandler(async (req, res) => {
  const item = await Announcement.create({ ...req.body, createdBy: req.user._id });
  res.status(201).json({ success: true, data: item });
});

exports.updateAnnouncement = asyncHandler(async (req, res) => {
  const item = await Announcement.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!item) return res.status(404).json({ success: false, message: 'Announcement not found' });
  res.json({ success: true, data: item });
});

exports.removeAnnouncement = asyncHandler(async (req, res) => {
  const item = await Announcement.findByIdAndDelete(req.params.id);
  if (!item) return res.status(404).json({ success: false, message: 'Announcement not found' });
  res.json({ success: true, message: 'Announcement deleted' });
});

/* ════════════════════════════════════════════════════════════════
   ADMIN — USER MANAGEMENT
════════════════════════════════════════════════════════════════ */
exports.getAllUsers = asyncHandler(async (req, res) => {
  const { status, level, search, page = 1, limit = 20 } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (level)  filter.currentLevel = level;
  if (search) filter.$or = [
    { name:  { $regex: search, $options: 'i' } },
    { email: { $regex: search, $options: 'i' } },
  ];

  const skip  = (parseInt(page) - 1) * parseInt(limit);
  const total = await User.countDocuments(filter);
  const data  = await User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit));
  res.json({ success: true, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)), data });
});

exports.getOneUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  res.json({ success: true, data: user });
});

exports.updateUserStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!['active','inactive','banned'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status' });
  }
  const user = await User.findByIdAndUpdate(req.params.id, { status }, { new: true });
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  res.json({ success: true, data: user });
});

exports.deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  // Clean up their progress too
  await Progress.deleteMany({ user: req.params.id });
  await QuizAttempt.deleteMany({ user: req.params.id });
  await KanaProgress.deleteOne({ user: req.params.id });
  res.json({ success: true, message: 'User and all data deleted' });
});

exports.getAdminStats = asyncHandler(async (req, res) => {
  const [totalUsers, activeUsers, bannedUsers, totalVocab, totalKanji, totalQuiz] = await Promise.all([
    User.countDocuments({ role: 'user' }),
    User.countDocuments({ status: 'active' }),
    User.countDocuments({ status: 'banned' }),
    require('../models/Vocabulary').countDocuments(),
    Kanji.countDocuments(),
    Quiz.countDocuments(),
  ]);

  // New users in last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const newUsers     = await User.countDocuments({ createdAt: { $gte: sevenDaysAgo } });

  res.json({
    success: true,
    data: { totalUsers, activeUsers, bannedUsers, newUsers, totalVocab, totalKanji, totalQuiz },
  });
});
