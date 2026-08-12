/* ══════════════════════════════════════════════════════════════
   ROADMAP REQUIREMENTS
   A roadmap lesson is "done" when the learner's real mastery data
   satisfies its requirement — never because they clicked it. The
   server is the only judge so the roadmap can't be faked client-side.
══════════════════════════════════════════════════════════════ */

const MASTERY_THRESHOLD = 60; // % per item, as requested

/* requirement kinds
   kana  → every character in `groups` of `script` must be >= threshold
   kanji → every listed character must be >= threshold
   vocab → at least `count` words (optionally of `wordType`) >= threshold
   quiz  → at least `count` quiz attempts scoring >= `minScorePct`
   manual→ no auto-check; completed via an explicit user action        */
const LESSON_REQUIREMENTS = {
  // ── Chapter 1 · Kana Foundations ──
  'hira-vowels': { kind: 'kana',  script: 'hiragana', groups: ['vowels'] },
  'hira-lines':  { kind: 'kana',  script: 'hiragana', groups: ['k', 's', 't', 'n', 'h'] },
  'kata-start':  { kind: 'kana',  script: 'katakana', groups: ['vowels'] },
  'kana-quiz':   { kind: 'kana',  script: 'hiragana', groups: ['m', 'y', 'r', 'w', 'special'] },

  // ── Chapter 2 · Core Vocabulary ──
  'flashcard-review': { kind: 'vocab', count: 10 },
  'noun-set':         { kind: 'vocab', count: 15, wordType: 'noun' },
  'verb-set':         { kind: 'vocab', count: 10, wordType: 'verb' },
  'vocab-check':      { kind: 'vocab', count: 30 },

  // ── Chapter 3 · N5 Kanji Path ──
  'numbers-kanji':  { kind: 'kanji', chars: ['一', '二', '三', '四', '五'] },
  'time-kanji':     { kind: 'kanji', chars: ['日', '月', '年', '時', '分'] },
  'people-kanji':   { kind: 'kanji', chars: ['人', '国', '中', '上', '下'] },
  'kanji-review':   { kind: 'kanjiCount', count: 20 },

  // ── Chapter 4 · JLPT Practice ──
  'grammar-intro':    { kind: 'manual' }, // grammar lessons have no per-item mastery model yet
  'mixed-quiz':       { kind: 'quiz', count: 1, minScorePct: 60 },
  'progress-review':  { kind: 'manual' },
  'n5-checkpoint':    { kind: 'quiz', count: 3, minScorePct: 80 },
};

const pct = (have, need) => (need <= 0 ? 100 : Math.min(100, Math.round((have / need) * 100)));

/* Evaluate one requirement against pre-loaded snapshots.
   Returns { done, have, need, label }. */
function evaluate(req, ctx) {
  if (!req || req.kind === 'manual') {
    return { done: !!ctx.manualDone, have: ctx.manualDone ? 1 : 0, need: 1, auto: false };
  }

  if (req.kind === 'kana') {
    const chars = ctx.kanaByGroup(req.script, req.groups);
    const map = ctx.kanaMastery[req.script] || {};
    const have = chars.filter(c => (Number(map[c]) || 0) >= MASTERY_THRESHOLD).length;
    return { done: chars.length > 0 && have === chars.length, have, need: chars.length, auto: true };
  }

  if (req.kind === 'kanji') {
    const ids = req.chars.map(c => ctx.kanjiIdByChar[c]).filter(Boolean);
    const have = ids.filter(id => (Number(ctx.kanjiMastery[id]) || 0) >= MASTERY_THRESHOLD).length;
    // need reflects characters we could actually resolve, so a missing seed
    // row can't make a lesson permanently uncompletable
    return { done: ids.length > 0 && have === ids.length, have, need: ids.length || req.chars.length, auto: true };
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

module.exports = { LESSON_REQUIREMENTS, MASTERY_THRESHOLD, evaluate, pct };
