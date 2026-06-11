const Kana = require('../models/Kana');
const KanaProgress = require('../models/KanaProgress');
const { asyncHandler } = require('../middleware/error');

const MIN_SESSION = 20;
const MAX_SESSION = 25;

const clamp = value => Math.max(0, Math.min(100, Number(value) || 0));

const progressToObject = progress => ({
  hiragana: Object.fromEntries(progress?.hiragana || []),
  katakana: Object.fromEntries(progress?.katakana || []),
});

const getMastery = (progress, type, kana) => clamp(progress?.[type]?.get?.(kana) || 0);

const shuffle = items => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const randomSessionSize = total => {
  const size = MIN_SESSION + Math.floor(Math.random() * (MAX_SESSION - MIN_SESSION + 1));
  return Math.min(total, size);
};

const weightedSample = (items, progress, type, target) => {
  const pool = [...items];
  const picked = [];

  while (pool.length && picked.length < target) {
    const totalWeight = pool.reduce((sum, item) => (
      sum + Math.max(6, 106 - getMastery(progress, type, item.kana))
    ), 0);
    let cursor = Math.random() * totalWeight;
    const index = pool.findIndex(item => {
      cursor -= Math.max(6, 106 - getMastery(progress, type, item.kana));
      return cursor <= 0;
    });
    const safeIndex = index === -1 ? pool.length - 1 : index;
    picked.push(pool.splice(safeIndex, 1)[0]);
  }

  return picked;
};

const buildAdaptiveSession = (items, progress, type) => {
  const target = randomSessionSize(items.length);
  const masteries = items.map(item => getMastery(progress, type, item.kana));
  const allSame = masteries.every(value => value === masteries[0]);
  const allZero = masteries.every(value => value === 0);

  if (allSame || allZero) return shuffle(items).slice(0, target);
  return weightedSample(items, progress, type, target);
};

const getOrCreateProgress = async userId => (
  KanaProgress.findOneAndUpdate(
    { user: userId },
    { $setOnInsert: { user: userId, hiragana: {}, katakana: {} } },
    { new: true, upsert: true }
  )
);

const validateType = type => ['hiragana', 'katakana'].includes(type);

const withMastery = (items, progress, type) => items.map(item => ({
  ...item.toObject(),
  mastery: getMastery(progress, type, item.kana),
}));

/* ── GET /api/kana ───────────────────────────────────────────── */
exports.getAll = asyncHandler(async (req, res) => {
  const { type, group, limit = 200 } = req.query;
  const filter = { isActive: true };
  if (type)  filter.type  = type;
  if (group) filter.group = group;

  const data = await Kana.find(filter).sort({ type:1, order:1 });
  res.json({ success: true, total: data.length, data });
});

/* ── GET /api/kana/progress ──────────────────────────────────── */
exports.getProgress = asyncHandler(async (req, res) => {
  const progress = await getOrCreateProgress(req.user._id);
  res.json({ success: true, data: progressToObject(progress) });
});

/* ── GET /api/kana/session?type=hiragana ─────────────────────── */
exports.getSession = asyncHandler(async (req, res) => {
  const type = req.query.type || 'hiragana';
  if (!validateType(type)) {
    return res.status(400).json({ success: false, message: 'Invalid kana type' });
  }

  const progress = await getOrCreateProgress(req.user._id);
  const allKana = await Kana.find({ type, isActive: true }).sort({ order: 1 });
  const session = buildAdaptiveSession(allKana, progress, type);

  res.json({
    success: true,
    total: session.length,
    data: withMastery(session, progress, type),
    progress: progressToObject(progress),
  });
});

/* ── PATCH /api/kana/progress ────────────────────────────────── */
exports.updateProgress = asyncHandler(async (req, res) => {
  const results = Array.isArray(req.body.results)
    ? req.body.results
    : [{ type: req.body.type, kana: req.body.kana, correct: req.body.correct }];

  const progress = await getOrCreateProgress(req.user._id);
  const updated = [];

  results.forEach(result => {
    const type = result.type || 'hiragana';
    if (!validateType(type) || !result.kana) return;

    const current = getMastery(progress, type, result.kana);
    const next = clamp(current + (result.correct ? 12 : -7));
    progress[type].set(result.kana, next);
    updated.push({ type, kana: result.kana, mastery: next });
  });

  await progress.save();
  res.json({ success: true, data: progressToObject(progress), updated });
});

/* ── POST /api/admin/kana ────────────────────────────────────── */
exports.create = asyncHandler(async (req, res) => {
  const item = await Kana.create({ ...req.body, createdBy: req.user._id });
  res.status(201).json({ success: true, data: item });
});

/* ── PUT /api/admin/kana/:id ─────────────────────────────────── */
exports.update = asyncHandler(async (req, res) => {
  const item = await Kana.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!item) return res.status(404).json({ success: false, message: 'Kana not found' });
  res.json({ success: true, data: item });
});

/* ── DELETE /api/admin/kana/:id ──────────────────────────────── */
exports.remove = asyncHandler(async (req, res) => {
  const item = await Kana.findByIdAndDelete(req.params.id);
  if (!item) return res.status(404).json({ success: false, message: 'Kana not found' });
  res.json({ success: true, message: 'Kana deleted' });
});
