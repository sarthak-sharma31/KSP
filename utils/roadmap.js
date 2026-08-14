/* ══════════════════════════════════════════════════════════════
   ROADMAP REQUIREMENTS
   A roadmap lesson is "done" when the learner's real mastery data
   satisfies its requirement — never because they clicked it. The
   server is the only judge so the roadmap can't be faked client-side.
══════════════════════════════════════════════════════════════ */

const MASTERY_THRESHOLD = 60; // % per item, as requested

/* One graded answer moves an item by randomInt(4, 9) — see the mastery
   updates in kana/kanji/vocabulary controllers. A practice session covers
   each item in the selected row about once, so a session is worth roughly
   this much. It's what lets us tell the learner "about N more sessions"
   instead of a number that only moves once a whole row crosses 60%. */
const AVG_GAIN_PER_SESSION = 6.5;
const MASTERY_STEPS = Math.ceil(MASTERY_THRESHOLD / AVG_GAIN_PER_SESSION); // 10

/* requirement kinds
   kana  → every character in `groups` of `script` must be >= threshold
   kanji → every listed character must be >= threshold
   vocab → at least `count` words (optionally of `wordType`) >= threshold
   quiz  → at least `count` quiz attempts scoring >= `minScorePct`
   manual→ no auto-check; completed via an explicit user action        */
/* Ordered so each stage only needs what the previous one taught:
   read hiragana → read katakana → words you can now read → the kanji
   behind those words → putting them in sentences → exam practice. */
const LESSON_REQUIREMENTS = {
  // ── Section 1 · Hiragana ──
  'hira-vowels':     { kind: 'kana', script: 'hiragana', groups: ['vowels'] },
  'hira-k':          { kind: 'kana', script: 'hiragana', groups: ['k'] },
  'hira-s':          { kind: 'kana', script: 'hiragana', groups: ['s'] },
  'hira-t':          { kind: 'kana', script: 'hiragana', groups: ['t'] },
  'hira-n':          { kind: 'kana', script: 'hiragana', groups: ['n'] },
  'hira-h':          { kind: 'kana', script: 'hiragana', groups: ['h'] },
  'hira-m':          { kind: 'kana', script: 'hiragana', groups: ['m'] },
  'hira-r':          { kind: 'kana', script: 'hiragana', groups: ['r'] },
  'hira-ywn':        { kind: 'kana', script: 'hiragana', groups: ['y', 'w', 'special'] },
  'hira-dakuten':    { kind: 'kana', script: 'hiragana', groups: ['dakuten'] },
  'hira-handakuten': { kind: 'kana', script: 'hiragana', groups: ['handakuten'] },

  // ── Section 2 · Katakana ──
  'kata-vowels':     { kind: 'kana', script: 'katakana', groups: ['vowels'] },
  'kata-k':          { kind: 'kana', script: 'katakana', groups: ['k'] },
  'kata-s':          { kind: 'kana', script: 'katakana', groups: ['s'] },
  'kata-t':          { kind: 'kana', script: 'katakana', groups: ['t'] },
  'kata-n':          { kind: 'kana', script: 'katakana', groups: ['n'] },
  'kata-h':          { kind: 'kana', script: 'katakana', groups: ['h'] },
  'kata-m':          { kind: 'kana', script: 'katakana', groups: ['m'] },
  'kata-r':          { kind: 'kana', script: 'katakana', groups: ['r'] },
  'kata-ywn':        { kind: 'kana', script: 'katakana', groups: ['y', 'w', 'special'] },
  'kata-dakuten':    { kind: 'kana', script: 'katakana', groups: ['dakuten'] },
  'kata-handakuten': { kind: 'kana', script: 'katakana', groups: ['handakuten'] },

  // ── Section 3 · First Words ──
  'words-first':      { kind: 'vocab', count: 10 },
  'words-nouns':      { kind: 'vocab', count: 20, wordType: 'noun' },
  'words-pronouns':   { kind: 'vocab', count: 8,  wordType: 'pronoun' },
  'words-numbers':    { kind: 'vocab', count: 10, wordType: 'numeric' },
  'words-verbs':      { kind: 'vocab', count: 15, wordType: 'verb' },
  'words-adjectives': { kind: 'vocab', count: 12, wordType: 'i-adjective' },
  'words-checkpoint': { kind: 'vocab', count: 60 },

  // ── Section 4 · First Kanji ──
  'kanji-numbers':    { kind: 'kanji', chars: ['一','二','三','四','五','六','七','八','九','十'] },
  'kanji-days':       { kind: 'kanji', chars: ['日','月','火','水','木','金','土'] },
  'kanji-time':       { kind: 'kanji', chars: ['年','時','分','間','今','午'] },
  'kanji-people':     { kind: 'kanji', chars: ['人','女','男','子','友','父','母'] },
  'kanji-position':   { kind: 'kanji', chars: ['大','小','上','下','中','外'] },
  'kanji-places':     { kind: 'kanji', chars: ['山','川','国','語','学','校'] },
  'kanji-checkpoint': { kind: 'kanjiCount', count: 40 },

  // ── Section 5 · Sentences ──
  // Grammar has no per-item mastery model yet, so these stay manual.
  'grammar-basics':    { kind: 'manual' },
  'grammar-particles': { kind: 'manual' },
  'grammar-quiz':      { kind: 'quiz', count: 1, minScorePct: 60 },

  // ── Section 6 · N5 Exam Prep ──
  'n5-mixed':    { kind: 'quiz', count: 3, minScorePct: 70 },
  'n5-practice': { kind: 'manual' },
  'n5-final':    { kind: 'quiz', count: 5, minScorePct: 80 },
};

const pct = (have, need) => (need <= 0 ? 100 : Math.min(100, Math.round((have / need) * 100)));

/* Average mastery across a set of items, as a fraction of the threshold.
   `have/need` only ticks when a whole item crosses 60%, which can leave a
   learner staring at 0/5 after several sessions of real progress. */
const clamp01 = n => Math.max(0, Math.min(1, n));
const ratioFromMastery = (values, threshold) => {
  if (!values.length) return 0;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return clamp01(avg / threshold);
};

/* Evaluate one requirement against pre-loaded snapshots.
   Returns { done, have, need, label }. */
function evaluate(req, ctx) {
  if (!req || req.kind === 'manual') {
    return { done: !!ctx.manualDone, have: ctx.manualDone ? 1 : 0, need: 1, auto: false };
  }

  if (req.kind === 'kana') {
    const chars = ctx.kanaByGroup(req.script, req.groups);
    const map = ctx.kanaMastery[req.script] || {};
    const values = chars.map(c => Number(map[c]) || 0);
    const have = values.filter(v => v >= MASTERY_THRESHOLD).length;
    const done = chars.length > 0 && have === chars.length;
    return {
      done, have, need: chars.length, auto: true,
      ratio: done ? 1 : ratioFromMastery(values, MASTERY_THRESHOLD),
    };
  }

  if (req.kind === 'kanji') {
    const ids = req.chars.map(c => ctx.kanjiIdByChar[c]).filter(Boolean);
    const values = ids.map(id => Number(ctx.kanjiMastery[id]) || 0);
    const have = values.filter(v => v >= MASTERY_THRESHOLD).length;
    const done = ids.length > 0 && have === ids.length;
    // need reflects characters we could actually resolve, so a missing seed
    // row can't make a lesson permanently uncompletable
    return {
      done, have, need: ids.length || req.chars.length, auto: true,
      ratio: done ? 1 : ratioFromMastery(values, MASTERY_THRESHOLD),
    };
  }

  if (req.kind === 'kanjiCount') {
    const have = Object.values(ctx.kanjiMastery).filter(v => (Number(v) || 0) >= MASTERY_THRESHOLD).length;
    return { done: have >= req.count, have: Math.min(have, req.count), need: req.count, auto: true };
  }

  if (req.kind === 'vocab') {
    const ids = req.wordType ? ctx.vocabIdsByType[req.wordType] || [] : null;
    const entries = Object.entries(ctx.vocabMastery);
    const have = entries.filter(([id, v]) =>
      (Number(v) || 0) >= MASTERY_THRESHOLD && (!ids || ids.includes(id))
    ).length;
    return { done: have >= req.count, have: Math.min(have, req.count), need: req.count, auto: true };
  }

  if (req.kind === 'quiz') {
    const have = ctx.quizAttempts.filter(a =>
      a.total > 0 && Math.round((a.score / a.total) * 100) >= req.minScorePct
    ).length;
    return { done: have >= req.count, have: Math.min(have, req.count), need: req.count, auto: true };
  }

  return { done: false, have: 0, need: 1, auto: true };
}

module.exports = { LESSON_REQUIREMENTS, MASTERY_THRESHOLD, MASTERY_STEPS, evaluate, pct };
