const { Kanji, QuizAttempt } = require('../models/index');
const Vocabulary = require('../models/Vocabulary');
const KanaProgress = require('../models/KanaProgress');
const KanjiProgress = require('../models/KanjiProgress');
const VocabularyProgress = require('../models/VocabularyProgress');
const RoadmapProgress = require('../models/RoadmapProgress');
const { asyncHandler } = require('../middleware/error');
const KANA_GROUPS = require('../data/kanaGroups');
const {
  LESSON_REQUIREMENTS, MASTERY_THRESHOLD, MASTERY_STEPS,
  stagesFor, isStaged, evaluate,
} = require('../utils/roadmap');

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
    stagesDone: lessonId => new Set(roadmap.stages?.get(lessonId) || []),
    kanaByGroup: (script, groups) => groups.flatMap(g => KANA_GROUPS[script]?.[g] || []),
  };
}

/* ── GET /api/roadmap ───────────────────────────────────────────── */
exports.getRoadmap = asyncHandler(async (req, res) => {
  const ctx = await buildContext(req.user._id);

  const lessons = {};
  for (const [lessonId, req_] of Object.entries(LESSON_REQUIREMENTS)) {
    const result = evaluate(req_, { ...ctx, manualDone: ctx.manualSet.has(lessonId) }, lessonId);

    // 0..1 progress toward finishing this node. Mastery-based kinds report
    // their average so the UI can move after every session; count-based
    // kinds are already granular, so have/need is the honest ratio.
    const ratio = typeof result.ratio === 'number'
      ? result.ratio
      : (result.need > 0 ? Math.min(1, result.have / result.need) : 0);

    // The ring is drawn from steps/filled, so a staged lesson gets one
    // segment per stage (visibly a quarter per exercise) while everything
    // else keeps the fine-grained mastery scale.
    const staged = Array.isArray(result.stages);
    const steps = staged ? result.stages.length : MASTERY_STEPS;
    const filled = staged
      ? result.stages.filter(s => s.done).length
      : Math.min(steps - 1, Math.floor(ratio * steps));

    lessons[lessonId] = {
      done: result.done,
      have: result.have,
      need: result.need,
      auto: result.auto,
      kind: req_.kind,
      ratio,
      steps,
      filled: result.done ? steps : filled,
      ...(staged && {
        stages: result.stages,
        nextStage: result.stages.findIndex(s => !s.done),
        mastered: result.mastered,
        totalChars: result.totalChars,
      }),
    };
  }

  res.json({
    success: true,
    data: { threshold: MASTERY_THRESHOLD, steps: MASTERY_STEPS, lessons },
  });
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

/* ── POST /api/roadmap/stage ────────────────────────────────────────
   Banks one stage of a staged lesson. The pass mark lives on the server
   so the client can only report what it scored, not what counts. */
exports.completeStage = asyncHandler(async (req, res) => {
  const { lessonId, stage, scorePct = 0 } = req.body;

  if (!isStaged(lessonId)) {
    return res.status(400).json({ success: false, message: 'This lesson has no stages.' });
  }

  const plan = stagesFor(lessonId);
  const index = Number(stage);
  if (!Number.isInteger(index) || index < 0 || index >= plan.length) {
    return res.status(400).json({ success: false, message: 'Unknown stage' });
  }

  const required = plan[index].pass;
  const passed = Number(scorePct) >= required;

  const roadmap = await getOrCreateRoadmap(req.user._id);
  const banked = new Set(roadmap.stages?.get(lessonId) || []);

  if (passed && !banked.has(index)) {
    banked.add(index);
    roadmap.stages.set(lessonId, [...banked].sort((a, b) => a - b));
    await roadmap.save();
  }

  res.json({
    success: true,
    data: {
      passed,
      required,
      stagesDone: [...banked].sort((a, b) => a - b),
      total: plan.length,
      lessonDone: banked.size >= plan.length,
    },
  });
});
