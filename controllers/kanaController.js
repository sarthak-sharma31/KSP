const Kana           = require('../models/Kana');
const { asyncHandler } = require('../middleware/error');

/* ── GET /api/kana ───────────────────────────────────────────── */
exports.getAll = asyncHandler(async (req, res) => {
  const { type, group, limit = 200 } = req.query;
  const filter = { isActive: true };
  if (type)  filter.type  = type;
  if (group) filter.group = group;

  const data = await Kana.find(filter).sort({ type:1, order:1 });
  res.json({ success: true, total: data.length, data });
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