const GrammarChapter = require('../models/GrammarChapter');
const GrammarProgress = require('../models/GrammarProgress');
const { asyncHandler } = require('../middleware/error');
const { registerStudyActivity } = require('../utils/streak');

/* A part is cleared at 80%. Grammar drills are built from a small tile set,
   so the floor for "you understood this" is higher than the 60% used for
   kana recognition. */
const PASS_PCT = 80;

const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];

/* Mongoose rejects Map keys containing a dot, so the stored key is "1-2"
   even though the part is displayed as "1.2".

   Chapter numbers restart at 1 for every level, so the key has to carry
   the level too or N4 chapter 1 would inherit N5 chapter 1's progress.
   N5 keeps the original unprefixed form so progress recorded before
   levels existed is not orphaned. */
const partKey = (chapterNumber, partIndex, level = 'N5') =>
  (level === 'N5' ? `${chapterNumber}-${partIndex}` : `${level}-${chapterNumber}-${partIndex}`);

const getOrCreateProgress = userId => GrammarProgress.findOneAndUpdate(
  { user: userId },
  { $setOnInsert: { user: userId, parts: {} } },
  { new: true, upsert: true },
);

/* Chapters unlock in order: you can start chapter N once N-1 is finished.
   Chapter 1 is always open. */
const summarise = (chapter, progress) => {
  const parts = chapter.parts.map(part => {
    const result = progress?.parts?.get(partKey(chapter.number, part.index, chapter.level));
    return {
      _id: part._id,
      index: part.index,
      label: `${chapter.number}.${part.index}`,
      title: part.title,
      pattern: part.pattern,
      patternEn: part.patternEn,
      sentenceCount: part.sentences.length,
      done: !!result?.done,
      best: result?.best || 0,
    };
  });

  const done = parts.filter(p => p.done).length;
  return {
    parts,
    partsDone: done,
    partsTotal: parts.length,
    complete: parts.length > 0 && done === parts.length,
  };
};

/* ── GET /api/grammar/chapters ──────────────────────────────────── */
exports.listChapters = asyncHandler(async (req, res) => {
  /* Scoped to the level the learner is studying. Chapter numbering and the
     unlock chain run per level, so N4 starts at its own chapter 1 rather
     than continuing N5's sequence. */
  const level = LEVELS.includes(req.query.level) ? req.query.level : 'N5';

  const [chapters, progress] = await Promise.all([
    GrammarChapter.find({ isPublished: true, level }).sort({ number: 1 }),
    getOrCreateProgress(req.user._id),
  ]);

  let previousComplete = true; // chapter 1 has no prerequisite
  const data = chapters.map(chapter => {
    const stats = summarise(chapter, progress);
    const locked = !previousComplete;
    previousComplete = stats.complete;

    return {
      _id: chapter._id,
      number: chapter.number,
      level: chapter.level,
      title: chapter.title,
      titleEn: chapter.titleEn,
      summary: chapter.summary,
      partsDone: stats.partsDone,
      partsTotal: stats.partsTotal,
      complete: stats.complete,
      locked,
    };
  });

  res.json({ success: true, data: { passPct: PASS_PCT, chapters: data } });
});

/* ── GET /api/grammar/chapters/:number ──────────────────────────── */
exports.getChapter = asyncHandler(async (req, res) => {
  const number = Number(req.params.number);
  if (!Number.isInteger(number)) {
    return res.status(400).json({ success: false, message: 'Invalid chapter number' });
  }

  const level = LEVELS.includes(req.query.level) ? req.query.level : 'N5';

  const [chapter, progress] = await Promise.all([
    GrammarChapter.findOne({ number, isPublished: true, level }),
    getOrCreateProgress(req.user._id),
  ]);

  if (!chapter) {
    return res.status(404).json({ success: false, message: 'Chapter not found' });
  }

  // Locked purely by whether everything before it is finished, so a learner
  // cannot deep-link past the sequence.
  const earlier = await GrammarChapter.find({ isPublished: true, level, number: { $lt: number } }).sort({ number: 1 });
  const locked = earlier.some(prev => !summarise(prev, progress).complete);

  const stats = summarise(chapter, progress);
  const doneByIndex = new Map(stats.parts.map(p => [p.index, p]));

  res.json({
    success: true,
    data: {
      passPct: PASS_PCT,
      chapter: {
        _id: chapter._id,
        number: chapter.number,
        level: chapter.level,
        title: chapter.title,
        titleEn: chapter.titleEn,
        summary: chapter.summary,
        intro: chapter.intro,
        keyPoints: chapter.keyPoints,
        locked,
        partsDone: stats.partsDone,
        partsTotal: stats.partsTotal,
        complete: stats.complete,
        parts: chapter.parts.map(part => ({
          _id: part._id,
          index: part.index,
          label: `${chapter.number}.${part.index}`,
          title: part.title,
          pattern: part.pattern,
          patternEn: part.patternEn,
          explanation: part.explanation,
          notes: part.notes,
          sentences: part.sentences,
          done: !!doneByIndex.get(part.index)?.done,
          best: doneByIndex.get(part.index)?.best || 0,
        })),
      },
    },
  });
});

/* ── POST /api/grammar/parts/complete ───────────────────────────────
   Body: { chapter, part, scorePct }. The pass mark lives here so the
   client can only report what it scored, not what counts as cleared. */
exports.completePart = asyncHandler(async (req, res) => {
  const chapterNumber = Number(req.body.chapter);
  const partIndex = Number(req.body.part);
  const scorePct = Math.max(0, Math.min(100, Number(req.body.scorePct) || 0));

  const level = LEVELS.includes(req.body.level) ? req.body.level : 'N5';

  const chapter = await GrammarChapter.findOne({ number: chapterNumber, isPublished: true, level });
  if (!chapter) {
    return res.status(404).json({ success: false, message: 'Chapter not found' });
  }
  if (!chapter.parts.some(p => p.index === partIndex)) {
    return res.status(400).json({ success: false, message: 'Unknown part' });
  }

  const progress = await getOrCreateProgress(req.user._id);
  const key = partKey(chapterNumber, partIndex, level);
  const previous = progress.parts.get(key) || { done: false, best: 0, attempts: 0 };
  const passed = scorePct >= PASS_PCT;

  progress.parts.set(key, {
    done: previous.done || passed, // clearing a part is not undone by a worse retry
    best: Math.max(previous.best || 0, scorePct),
    attempts: (previous.attempts || 0) + 1,
    lastAt: new Date(),
  });
  await progress.save();

  // Grammar counts toward the daily streak like every other exercise.
  await registerStudyActivity(req.user._id);

  const stats = summarise(chapter, progress);
  res.json({
    success: true,
    data: {
      passed,
      required: PASS_PCT,
      scorePct,
      best: progress.parts.get(key).best,
      partsDone: stats.partsDone,
      partsTotal: stats.partsTotal,
      chapterComplete: stats.complete,
    },
  });
});

/* ══════════════════════════════════════════════════════════════
   ADMIN
══════════════════════════════════════════════════════════════ */

/* ── GET /api/admin/grammar-chapters ────────────────────────────── */
exports.adminList = asyncHandler(async (req, res) => {
  const chapters = await GrammarChapter.find().sort({ number: 1 });
  res.json({
    success: true,
    total: chapters.length,
    data: chapters.map(c => ({
      _id: c._id,
      number: c.number,
      level: c.level,
      title: c.title,
      titleEn: c.titleEn,
      summary: c.summary,
      isPublished: c.isPublished,
      partsTotal: c.parts.length,
      sentenceCount: c.sentenceCount,
    })),
  });
});

/* ── GET /api/admin/grammar-chapters/:id ────────────────────────── */
exports.adminGet = asyncHandler(async (req, res) => {
  const chapter = await GrammarChapter.findById(req.params.id);
  if (!chapter) return res.status(404).json({ success: false, message: 'Chapter not found' });
  res.json({ success: true, data: chapter });
});

/* ── POST /api/admin/grammar-chapters ───────────────────────────── */
exports.adminCreate = asyncHandler(async (req, res) => {
  const chapter = await GrammarChapter.create({ ...req.body, createdBy: req.user._id });
  res.status(201).json({ success: true, data: chapter });
});

/* ── PUT /api/admin/grammar-chapters/:id ────────────────────────────
   Whole-document replace: the editor sends the chapter back complete,
   including its parts and sentences, so nested edits, reorders and
   deletions all arrive as one atomic change. */
exports.adminUpdate = asyncHandler(async (req, res) => {
  const chapter = await GrammarChapter.findById(req.params.id);
  if (!chapter) return res.status(404).json({ success: false, message: 'Chapter not found' });

  const fields = ['number', 'level', 'title', 'titleEn', 'summary', 'intro', 'keyPoints', 'parts', 'isPublished'];
  fields.forEach(field => {
    if (req.body[field] !== undefined) chapter[field] = req.body[field];
  });

  await chapter.save(); // runs the renumbering hook
  res.json({ success: true, data: chapter });
});

/* ── DELETE /api/admin/grammar-chapters/:id ─────────────────────── */
exports.adminRemove = asyncHandler(async (req, res) => {
  const chapter = await GrammarChapter.findByIdAndDelete(req.params.id);
  if (!chapter) return res.status(404).json({ success: false, message: 'Chapter not found' });
  res.json({ success: true, message: `Chapter ${chapter.number} deleted` });
});
