const mongoose = require('mongoose');
const User = require('../models/User');
const StreakActivity = require('../models/StreakActivity');
const Kana = require('../models/Kana');
const Vocabulary = require('../models/Vocabulary');
const GrammarChapter = require('../models/GrammarChapter');
const GrammarProgress = require('../models/GrammarProgress');
const PracticeTest = require('../models/PracticeTest');
const TestAttempt = require('../models/TestAttempt');
const PendingSignup = require('../models/PendingSignup');
const { Kanji, Quiz, QuizAttempt } = require('../models/index');
const { asyncHandler } = require('../middleware/error');

/* ══════════════════════════════════════════════════════════════
   ADMIN ANALYTICS

   Every number here is computed from the database. The page used to
   plot two hardcoded arrays, which looked convincing and told you
   nothing.

   StreakActivity is the backbone: one row per user per day they
   studied, with the date already stored as 'YYYY-MM-DD' UTC. That
   makes "who was active when" a cheap string prefix match instead of
   a date-range scan over every progress collection.
══════════════════════════════════════════════════════════════ */

const DAY = 24 * 60 * 60 * 1000;
const dayKey = d => d.toISOString().slice(0, 10);
const monthKey = d => d.toISOString().slice(0, 7);
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/* The last `count` months, oldest first, as { key: '2026-08', label: 'Aug' }. */
function recentMonths(count) {
  const out = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push({ key: monthKey(d), label: MONTH_LABELS[d.getUTCMonth()], start: d });
  }
  return out;
}

/* ── GET /api/admin/analytics ───────────────────────────────────── */
exports.getAnalytics = asyncHandler(async (req, res) => {
  const now = new Date();
  const weekAgo = new Date(now - 7 * DAY);
  const monthAgo = new Date(now - 30 * DAY);
  const months = recentMonths(6);
  const since = months[0].start;

  const [
    totalUsers, bannedUsers, newThisWeek, verifiedUsers, pendingSignups,
    kanaCount, kanjiCount, vocabCount, quizCount, testCount,
    chapters, quizAttempts, testAttempts,
  ] = await Promise.all([
    User.countDocuments({ role: 'user' }),
    User.countDocuments({ role: 'user', status: 'banned' }),
    User.countDocuments({ role: 'user', createdAt: { $gte: weekAgo } }),
    User.countDocuments({ role: 'user', emailVerified: true }),
    PendingSignup.countDocuments(),
    Kana.countDocuments({ isActive: true }),
    Kanji.countDocuments(),
    Vocabulary.countDocuments(),
    Quiz.countDocuments(),
    PracticeTest.countDocuments(),
    GrammarChapter.find().select('number isPublished parts').lean(),
    QuizAttempt.find().select('score total createdAt').lean(),
    TestAttempt.countDocuments(),
  ]);

  /* ── Activity, straight from the streak log ── */
  const activityRows = await StreakActivity.find({ date: { $gte: months[0].key } })
    .select('user date').lean();

  const activeThisWeekSet = new Set();
  const activeThisMonthSet = new Set();
  const byMonth = new Map();     // '2026-08' -> Set(userId)
  const byDay = new Map();       // '2026-08-17' -> count

  const weekKey = dayKey(weekAgo);
  const monthAgoKey = dayKey(monthAgo);

  for (const row of activityRows) {
    const uid = String(row.user);
    if (row.date >= weekKey) activeThisWeekSet.add(uid);
    if (row.date >= monthAgoKey) activeThisMonthSet.add(uid);

    const m = row.date.slice(0, 7);
    if (!byMonth.has(m)) byMonth.set(m, new Set());
    byMonth.get(m).add(uid);

    byDay.set(row.date, (byDay.get(row.date) || 0) + 1);
  }

  /* ── Signups per month, and each cohort's survival ──
     "Retention" here is a real cohort measure: of the people who joined
     in month M, what share have studied in the last 30 days. A month
     with no signups reports null rather than a misleading 0%. */
  const cohorts = await User.find({ role: 'user', createdAt: { $gte: since } })
    .select('createdAt').lean();

  const signupsByMonth = new Map();
  for (const u of cohorts) {
    const m = monthKey(new Date(u.createdAt));
    if (!signupsByMonth.has(m)) signupsByMonth.set(m, []);
    signupsByMonth.get(m).push(String(u._id));
  }

  const growth = months.map(({ key, label }) => {
    const ids = signupsByMonth.get(key) || [];
    const stillActive = ids.filter(id => activeThisMonthSet.has(id)).length;
    return {
      label,
      signups: ids.length,
      activeUsers: byMonth.get(key)?.size || 0,
      retentionPct: ids.length ? Math.round((stillActive / ids.length) * 100) : null,
    };
  });

  /* ── Last 14 days of study sessions ── */
  const daily = [];
  for (let i = 13; i >= 0; i -= 1) {
    const d = new Date(now - i * DAY);
    const key = dayKey(d);
    daily.push({ date: key, label: key.slice(8), sessions: byDay.get(key) || 0 });
  }

  /* ── Streak leaderboard-ish summary ── */
  const streaks = await User.find({ role: 'user' }).select('streak').lean();
  const streakValues = streaks.map(u => u.streak || 0);
  const longestStreak = streakValues.length ? Math.max(...streakValues) : 0;
  const onAStreak = streakValues.filter(v => v > 0).length;

  /* ── Content and engagement ── */
  const publishedChapters = chapters.filter(c => c.isPublished).length;
  const authoredChapters = chapters.filter(c => (c.parts || []).length > 0).length;
  const grammarParts = chapters.reduce((n, c) => n + (c.parts || []).length, 0);

  const scored = quizAttempts.filter(a => a.total > 0);
  const avgQuizScore = scored.length
    ? Math.round(scored.reduce((sum, a) => sum + (a.score / a.total) * 100, 0) / scored.length)
    : 0;

  const grammarProgressDocs = await GrammarProgress.find().select('parts').lean();
  const grammarPartsCleared = grammarProgressDocs.reduce(
    (n, doc) => n + Object.values(doc.parts || {}).filter(p => p.done).length, 0,
  );

  res.json({
    success: true,
    data: {
      generatedAt: now,
      headline: {
        totalUsers,
        activeThisWeek: activeThisWeekSet.size,
        activeThisMonth: activeThisMonthSet.size,
        newThisWeek,
        bannedUsers,
        verifiedUsers,
        pendingSignups,
        studyDaysLogged: activityRows.length,
        longestStreak,
        onAStreak,
      },
      growth,
      daily,
      content: {
        kana: kanaCount,
        kanji: kanjiCount,
        vocabulary: vocabCount,
        quizQuestions: quizCount,
        practiceTests: testCount,
        grammarChapters: chapters.length,
        grammarPublished: publishedChapters,
        grammarAuthored: authoredChapters,
        grammarParts,
      },
      engagement: {
        quizAttempts: quizAttempts.length,
        avgQuizScore,
        practiceTestAttempts: testAttempts,
        grammarPartsCleared,
      },
    },
  });
});
