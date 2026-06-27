const mongoose = require('mongoose');

/* ══════════════════════════════════════════════════════════════
   TEST PROGRESS
   Tracks a user's in-progress test state for resuming mid-test
   (This is a backup for localStorage, optional for DB persistence)
══════════════════════════════════════════════════════════════ */

const sectionProgressSchema = new mongoose.Schema({
  sectionName: { type: String, required: true, enum: ['vocabulary', 'grammar-reading', 'listening'] },
  currentQuestionIndex: { type: Number, default: 0 },
  answers: new mongoose.Schema({
    // Map of questionId -> userAnswerIndex
  }, { strict: false }),
  timeRemaining: { type: Number, required: true }, // in seconds
}, { _id: false });

const testProgressSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  practiceTest: { type: mongoose.Schema.Types.ObjectId, ref: 'PracticeTest', required: true },
  
  // Current section being worked on
  currentSection: { type: String, enum: ['vocabulary', 'grammar-reading', 'listening'], required: true },
  
  // Per-section progress
  sections: new mongoose.Schema({
    vocabulary: sectionProgressSchema,
    'grammar-reading': sectionProgressSchema,
    listening: sectionProgressSchema,
  }, { strict: false }),
  
  // Overall timing
  totalTimeRemaining: { type: Number, required: true }, // in seconds
  startedAt: { type: Date, default: Date.now },
  lastAccessedAt: { type: Date, default: Date.now },
  
}, { timestamps: true });

// Index for fast lookup
testProgressSchema.index({ user: 1, practiceTest: 1 });

module.exports = mongoose.model('TestProgress', testProgressSchema);
