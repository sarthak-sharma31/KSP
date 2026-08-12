const User = require('../models/User');
const StreakActivity = require('../models/StreakActivity');

const todayKey = () => new Date().toISOString().slice(0, 10);

/* Call this from anywhere a user completes a study action (grading a card,
   submitting a quiz, finishing a practice test, ...). Idempotent per day —
   safe to call once per graded item without inflating the streak. */
async function registerStudyActivity(userId) {
  try {
    await StreakActivity.create({ user: userId, date: todayKey() });
  } catch (err) {
    if (err.code !== 11000) throw err; // already logged today — fine
  }

  const user = await User.findById(userId);
  if (!user) return null;
  user.updateStreak();
  await user.save();
  return user;
}

module.exports = { registerStudyActivity, todayKey };
