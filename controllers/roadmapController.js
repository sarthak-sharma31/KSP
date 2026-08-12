const { Kanji, QuizAttempt } = require('../models/index');
const Vocabulary = require('../models/Vocabulary');
const KanaProgress = require('../models/KanaProgress');
const KanjiProgress = require('../models/KanjiProgress');
const VocabularyProgress = require('../models/VocabularyProgress');
const RoadmapProgress = require('../models/RoadmapProgress');
const { asyncHandler } = require('../middleware/error');
const KANA_GROUPS = require('../data/kanaGroups');
const { LESSON_REQUIREMENTS, MASTERY_THRESHOLD, evaluate } = require('../utils/roadmap');

const mapToObject = m => Object.fromEntries(m || []);

const getOrCreateRoadmap = user => RoadmapProgress.findOneAndUpdate(
  { user }, { $setOnInsert: { user, manualDone: [] } }, { new: true, upsert: true }
);

/* Which vocabulary ids belong to each word type we gate on — resolved once
   per request rather than per lesson. */
async function vocabIdsByType(types) {
  const out = {};
  for (const t of types) {
    const rows = await Vocabulary.find({ type: t, isActive: true }).select('_id').lean();
    out[t] = rows.map(r => String(r._id));
  }
  return out;
}

async function buildContext(userId) {
  const [kana, kanji, vocab, roadmap, quizAttempts] = await Promise.all([
    KanaProgress.findOne({ user: userId }),
    KanjiProgress.findOne({ user: userId }),
    VocabularyProgress.findOne({ user: userId }),
    getOrCreateRoadmap(userId),
    QuizAttempt.find({ user: userId }).select('score total').lean(),
  ]);

  const neededTypes = [...new Set(
    Object.values(LESSON_REQUIREMENTS).filter(r => r.kind === 'vocab' && r.wordType).map(r => r.wordType)
  )];
  const neededChars = [...new Set(
    Object.values(LESSON_REQUIREMENTS).filter(r => r.kind === 'kanji').flatMap(r => r.chars)
  )];

  const kanjiRows = await Kanji.find({ char: { $in: neededChars } }).select('_id char').lean();
  const kanjiIdByChar = Object.fromEntries(kanjiRows.map(k => [k.char, String(k._id)]));

  return {
    kanaMastery: {
      hiragana: mapToObject(kana?.hiragana),
      katakana: mapToObject(kana?.katakana),
    },
    kanjiMastery: mapToObject(kanji?.kanji),
    vocabMastery: mapToObject(vocab?.mastery),
    vocabIdsByType: await vocabIdsByType(neededTypes),
    kanjiIdByChar,
    quizAttempts,
    manualSet: new Set(roadmap.manualDone),
    kanaByGroup: (script, groups) => groups.flatMap(g => KANA_GROUPS[script]?.[g] || []),
  };
}

/* ── GET /api/roadmap ───────────────────────────────────────────── */
exports.getRoadmap = asyncHandler(async (req, res) => {
  const ctx = await buildContext(req.user._id);

  const lessons = {};
  for (const [lessonId, req_] of Object.entries(LESSON_REQUIREMENTS)) {
    const result = evaluate(req_, { ...ctx, manualDone: ctx.manualSet.has(lessonId) });
    lessons[lessonId] = {
      done: result.done,
      have: result.have,
      need: result.need,
      auto: result.auto,
      kind: req_.kind,
    };
  }

  res.json({ success: true, data: { threshold: MASTERY_THRESHOLD, lessons } });
});

/* ── POST /api/roadmap/complete ─────────────────────────────────────
   Only valid for `manual` lessons — auto-gated ones are derived from
   mastery and must not be settable by the client. */
exports.completeLesson = asyncHandler(async (req, res) => {
  const { lessonId, done = true } = req.body;
  const requirement = LESSON_REQUIREMENTS[lessonId];

  if (!requirement) {
    return res.status(400).json({ success: false, message: 'Unknown lesson' });
  }
  if (requirement.kind !== 'manual') {
    return res.status(400).json({
      success: false,
      message: 'This lesson completes automatically from your mastery progress.',
    });
  }

  const roadmap = await getOrCreateRoadmap(req.user._id);
  const set = new Set(roadmap.manualDone);
  if (done) set.add(lessonId); else set.delete(lessonId);
  roadmap.manualDone = [...set];
  await roadmap.save();

  res.json({ success: true, data: { manualDone: roadmap.manualDone } });
});
