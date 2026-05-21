const Vocabulary        = require('../models/Vocabulary');
const { asyncHandler }  = require('../middleware/error');

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
