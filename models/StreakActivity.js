const mongoose = require('mongoose');

/* One row per user per calendar day they completed any exercise.
   Backs the streak calendar view — `updateStreak` on User only tracks the
   running count, this is what lets us render which days were actually hit. */
const streakActivitySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  date: { type: String, required: true }, // 'YYYY-MM-DD', UTC
}, { timestamps: true });

streakActivitySchema.index({ user: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('StreakActivity', streakActivitySchema);
