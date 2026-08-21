const AppConfig = require('../models/AppConfig');
const { asyncHandler } = require('../middleware/error');

/* ── GET /api/config ────────────────────────────────────────────
   Read by every app page on load. Public: knowing that N4 is live or
   that practice tests are down is not sensitive. */
exports.getConfig = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await AppConfig.load() });
});

/* ── GET /api/admin/config ──────────────────────────────────────
   Same shape plus the catalogue of levels and pages, so the admin UI
   doesn't need its own hardcoded copy of either list. */
exports.adminGetConfig = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: {
      ...(await AppConfig.load()),
      catalogue: { levels: AppConfig.LEVELS, pages: AppConfig.PAGES },
    },
  });
});

/* ── PUT /api/admin/config ────────────────────────────────────── */
exports.adminUpdateConfig = asyncHandler(async (req, res) => {
  const doc = await AppConfig.findOneAndUpdate(
    { singleton: 'app' }, { $setOnInsert: { singleton: 'app' } },
    { new: true, upsert: true },
  );

  const { levels, pages } = req.body;

  if (levels && typeof levels === 'object') {
    AppConfig.LEVELS.forEach(l => {
      if (l in levels) doc.levels.set(l, !!levels[l]);
    });
    // N5 is the whole beginner path — closing it leaves nothing to learn.
    doc.levels.set('N5', true);
  }

  if (pages && typeof pages === 'object') {
    AppConfig.PAGES.forEach(p => {
      const next = pages[p.key];
      if (!next) return;
      doc.pages.set(p.key, {
        enabled: next.enabled !== false,
        message: String(next.message || '').slice(0, 300),
      });
    });
  }

  doc.updatedBy = req.user._id;
  await doc.save();
  AppConfig.clearCache();

  res.json({ success: true, data: doc.toPublic() });
});
