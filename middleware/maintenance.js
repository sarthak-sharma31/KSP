const AppConfig = require('../models/AppConfig');

/* ══════════════════════════════════════════════════════════════
   MAINTENANCE GATE

   Turning a page off in the admin panel has to mean the data stops
   being served, not just that a link disappears. Anyone with the URL,
   a stale tab, or curl would otherwise sail straight past it.

   Admin routes are never gated — closing a page for learners is
   usually the moment you most need to go in and fix its content.
══════════════════════════════════════════════════════════════ */

const PREFIXED = AppConfig.PAGES.filter(p => p.api);

module.exports = async function maintenanceGate(req, res, next) {
  if (req.path.startsWith('/admin')) return next();

  let config;
  try {
    config = await AppConfig.load();
  } catch (_) {
    return next();   // a config lookup failing must not take the API down
  }

  const hit = PREFIXED.find(p => req.path === p.api || req.path.startsWith(`${p.api}/`));
  if (!hit) return next();

  const state = config.pages[hit.key];
  if (state && state.enabled === false) {
    return res.status(503).json({
      success: false,
      maintenance: true,
      page: hit.key,
      message: state.message || `${hit.label} is temporarily unavailable. Please check back soon.`,
    });
  }

  return next();
};
