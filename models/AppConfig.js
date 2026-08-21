const mongoose = require('mongoose');

/* ══════════════════════════════════════════════════════════════
   APP CONFIG — one document, edited from the admin panel

   Two things that used to be hardcoded in the frontend and could
   only change with a redeploy:

     · which JLPT levels are live
     · whether a page is open or under maintenance

   Both are operational decisions, not code, so they live here. The
   server reads this too — hiding a page in the UI while its API keeps
   answering is theatre, not a maintenance mode.
══════════════════════════════════════════════════════════════ */

const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];

/* Every gateable page, with the API prefix that serves it. The prefix is
   what lets the server enforce a closed page rather than trusting the
   client to stop asking. */
const PAGES = [
  { key: 'learn',          label: 'Learn (path)',        route: '/dashboard',      api: null },
  { key: 'kana',           label: 'Hiragana & Katakana', route: '/kana',           api: '/kana' },
  { key: 'kanji',          label: 'Kanji',               route: '/kanji',          api: '/kanji' },
  { key: 'flashcards',     label: 'Flashcards',          route: '/flashcards',     api: null },
  { key: 'quiz',           label: 'JLPT Quiz',           route: '/quiz',           api: '/quiz' },
  { key: 'practice-tests', label: 'Practice Tests',      route: '/practice-tests', api: '/practice-tests' },
  { key: 'grammar',        label: 'Grammar',             route: '/grammar',        api: '/grammar' },
  { key: 'profile',        label: 'Profile',             route: '/profile',        api: null },
];

const pageStateSchema = new mongoose.Schema({
  enabled: { type: Boolean, default: true },
  /* Shown to learners instead of the page. Blank falls back to a generic
     line, so an admin can close a page in one click without writing copy. */
  message: { type: String, default: '', trim: true },
}, { _id: false });

const appConfigSchema = new mongoose.Schema({
  /* A fixed key so findOneAndUpdate can upsert the singleton without a
     race creating two of them. */
  singleton: { type: String, default: 'app', unique: true, immutable: true },

  levels: {
    type: Map,
    of: Boolean,
    default: () => new Map(LEVELS.map(l => [l, l === 'N5'])),
  },

  pages: {
    type: Map,
    of: pageStateSchema,
    default: () => new Map(PAGES.map(p => [p.key, { enabled: true, message: '' }])),
  },

  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

/* Plain objects for the API, with every known level and page present even
   if the stored document predates one being added. */
appConfigSchema.methods.toPublic = function toPublic() {
  const levels = {};
  LEVELS.forEach(l => { levels[l] = this.levels?.get(l) ?? (l === 'N5'); });

  const pages = {};
  PAGES.forEach(p => {
    const stored = this.pages?.get(p.key);
    pages[p.key] = {
      label: p.label,
      route: p.route,
      enabled: stored?.enabled !== false,
      message: stored?.message || '',
    };
  });

  return { levels, pages };
};

const AppConfig = mongoose.model('AppConfig', appConfigSchema);

AppConfig.LEVELS = LEVELS;
AppConfig.PAGES = PAGES;

/* Cached so the maintenance middleware doesn't hit Mongo on every single
   request. Any write clears it, so a toggle takes effect immediately. */
let cache = null;
AppConfig.load = async function load() {
  if (cache) return cache;
  const doc = await AppConfig.findOneAndUpdate(
    { singleton: 'app' }, { $setOnInsert: { singleton: 'app' } },
    { new: true, upsert: true },
  );
  cache = doc.toPublic();
  return cache;
};
AppConfig.clearCache = () => { cache = null; };

module.exports = AppConfig;
