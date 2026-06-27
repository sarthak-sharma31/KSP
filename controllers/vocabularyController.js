const Vocabulary        = require('../models/Vocabulary');
const VocabularyProgress = require('../models/VocabularyProgress');
const { asyncHandler }  = require('../middleware/error');

const clamp = value => Math.max(0, Math.min(100, Number(value) || 0));
const randomInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
const getMastery = (progress, id) => clamp(progress?.mastery?.get?.(String(id)) || 0);
const serializeProgress = progress => Object.fromEntries(progress?.mastery || []);
const getOrCreateProgress = user => VocabularyProgress.findOneAndUpdate(
  { user }, { $setOnInsert: { user, mastery: {} } }, { new: true, upsert: true }
);

const sampleAdaptive = (items, progress, size) => {
  const pool = [...items];
  const picked = [];
  while (pool.length && picked.length < size) {
    const total = pool.reduce((sum, item) => sum + Math.max(6, 106 - getMastery(progress, item._id)), 0);
    let cursor = Math.random() * total;
    const index = pool.findIndex(item => {
      cursor -= Math.max(6, 106 - getMastery(progress, item._id));
      return cursor <= 0;
    });
    picked.push(pool.splice(index === -1 ? pool.length - 1 : index, 1)[0]);
  }
  return picked;
};

/* ── GET /api/vocabulary ─────────────────────────────────────── */
exports.getAll = asyncHandler(async (req, res) => {
  const { level, type, page = 1, limit = 50, search } = req.query;

  const filter = { isActive: true };
  if (level)  filter.level = level;
  if (type)   filter.type  = type;
  if (search) {
    filter.$or = [
      { kanji:   { $regex: search, $options: 'i' } },
      { kana:    { $regex: search, $options: 'i' } },
      { meaning: { $regex: search, $options: 'i' } },
    ];
  }

  const skip  = (parseInt(page) - 1) * parseInt(limit);
  const total = await Vocabulary.countDocuments(filter);
  const words = await Vocabulary.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  res.json({
    success: true,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / parseInt(limit)),
    data: words,
  });
});

exports.getProgress = asyncHandler(async (req, res) => {
  const progress = await getOrCreateProgress(req.user._id);
  res.json({ success: true, data: serializeProgress(progress) });
});

exports.getSession = asyncHandler(async (req, res) => {
  const { level = 'N5' } = req.query;
  const progress = await getOrCreateProgress(req.user._id);
  const words = await Vocabulary.find({ level, isActive: true });
  const size = Math.min(words.length, randomInt(14, 25));
  const session = sampleAdaptive(words, progress, size).map(word => ({
    ...word.toObject(), mastery: getMastery(progress, word._id),
  }));
  res.json({ success: true, total: session.length, data: session, progress: serializeProgress(progress) });
});

exports.updateMastery = asyncHandler(async (req, res) => {
  const { vocabularyId, correct } = req.body;
  if (!vocabularyId) return res.status(400).json({ success: false, message: 'Vocabulary id is required' });
  const progress = await getOrCreateProgress(req.user._id);
  const current = getMastery(progress, vocabularyId);
  const delta = correct ? randomInt(4, 9) : -randomInt(6, 12);
  const mastery = clamp(current + delta);
  progress.mastery.set(String(vocabularyId), mastery);
  await progress.save();
  res.json({ success: true, data: serializeProgress(progress), updated: { vocabularyId, mastery, delta } });
});

/* ── GET /api/vocabulary/:id ─────────────────────────────────── */
exports.getOne = asyncHandler(async (req, res) => {
  const word = await Vocabulary.findById(req.params.id);
  if (!word) return res.status(404).json({ success: false, message: 'Word not found' });
  res.json({ success: true, data: word });
});

/* ── POST /api/admin/vocabulary ──────────────────────────────── */
exports.create = asyncHandler(async (req, res) => {
  const word = await Vocabulary.create({ ...req.body, createdBy: req.user._id });
  res.status(201).json({ success: true, data: word });
});

/* ── PUT /api/admin/vocabulary/:id ───────────────────────────── */
exports.update = asyncHandler(async (req, res) => {
  const word = await Vocabulary.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!word) return res.status(404).json({ success: false, message: 'Word not found' });
  res.json({ success: true, data: word });
});

/* ── DELETE /api/admin/vocabulary/:id ────────────────────────── */
exports.remove = asyncHandler(async (req, res) => {
  const word = await Vocabulary.findByIdAndDelete(req.params.id);
  if (!word) return res.status(404).json({ success: false, message: 'Word not found' });
  res.json({ success: true, message: 'Word deleted' });
});

/* ── GET /api/vocabulary/due  (SRS — cards due for review) ──── */
exports.getDueCards = asyncHandler(async (req, res) => {
  const { level = 'N5', limit = 20 } = req.query;
  const words = await Vocabulary.aggregate([
    { $match: { level, isActive: true } },
    { $sample: { size: parseInt(limit) } },
  ]);
  res.json({ success: true, data: words });
});
