const User = require('../models/User');
const StreakActivity = require('../models/StreakActivity');

const todayKey = () => new Date().toISOString().slice(0, 10);

/* Call this from anywhere a user completes a study action (grading a card,
   submitting a quiz, finishing a practice test, ...). Idempotent per day —
   safe to call once per graded item without inflating the streak. */
async function registerStudyActivity(userId) {
  const user = await User.findById(userId);
  if (!user) return null;

  const today = todayKey();
  const last = user.lastStudied ? new Date(user.lastStudied).toISOString().slice(0, 10) : null;

  // Practice grades one card at a time, so this runs on every answer. Once
  // the day is already banked there is nothing left to write — bail before
  // the insert and the save rather than doing three round trips per card.
  if (last === today) return user;

  try {
    await StreakActivity.create({ user: userId, date: today });
  } catch (err) {
    if (err.code !== 11000) throw err; // already logged today — fine
  }

  user.updateStreak();
  await user.save();
  return user;
}

module.exports = { registerStudyActivity, todayKey };
