const mongoose = require('mongoose');

/* ══════════════════════════════════════════════════════════════
   TEST ATTEMPT
   Records a user's attempt at a practice test, including their
   answers, scores, and timing information
══════════════════════════════════════════════════════════════ */

const sectionResultSchema = new mongoose.Schema({
  sectionName: { type: String, required: true, enum: ['vocabulary', 'grammar-reading', 'listening'] },
  displayName: { type: String, required: true },
  totalQuestions: { type: Number, required: true },
  correctAnswers: { type: Number, required: true },
  score: { type: Number, required: true }, // percentage or points
  timeTaken: { type: Number, required: true }, // in seconds
  answers: [{
    questionId: mongoose.Schema.Types.ObjectId,
    question: String,
    userAnswer: { type: Number, min: 0, max: 3 }, // index of user's selected option
    correctAnswer: { type: Number, min: 0, max: 3 },
    isCorrect: Boolean,
  }],
}, { _id: false });

const testAttemptSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  practiceTest: { type: mongoose.Schema.Types.ObjectId, ref: 'PracticeTest', required: true },
  level: { type: String, enum: ['N5', 'N4', 'N3', 'N2', 'N1'] },
  testTitle: { type: String, trim: true }, // snapshot of test title at time of attempt
  
  // Overall results
  totalScore: { type: Number, required: true }, // overall percentage or points
  totalQuestions: { type: Number, required: true },
  totalCorrect: { type: Number, required: true },
  totalDuration: { type: Number, required: true }, // in seconds
  
  // Per-section results
  sections: [sectionResultSchema],
  
  // Status
  status: { type: String, enum: ['completed', 'abandoned'], default: 'completed' },
  
}, { timestamps: true });

// Index for fast user test history queries
testAttemptSchema.index({ user: 1, createdAt: -1 });
testAttemptSchema.index({ practiceTest: 1, createdAt: -1 });

module.exports = mongoose.model('TestAttempt', testAttemptSchema);
