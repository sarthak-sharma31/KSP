const mongoose = require('mongoose');

/* ══════════════════════════════════════════════════════════════
   PRACTICE TEST
   Represents a full JLPT practice test with 3 sections:
   1. Vocabulary (MCQ)
   2. Grammar & Reading (MCQ with optional images)
   3. Listening (MCQ with audio)
══════════════════════════════════════════════════════════════ */

const questionSchema = new mongoose.Schema({
  _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
  question: { type: String, required: true, trim: true },
  imageUrl: { type: String, trim: true, default: '' }, // URL to image if applicable
  options: {
    type: [String],
    required: true,
    validate: { validator: v => v.length === 4, message: 'Must have exactly 4 options' },
  },
  answer: { type: Number, required: true, min: 0, max: 3 }, // index of correct option
  explanation: { type: String, trim: true, default: '' }, // explanation for the answer
}, { _id: true });

const sectionSchema = new mongoose.Schema({
  name: { type: String, required: true, enum: ['vocabulary', 'grammar-reading', 'listening'] },
  displayName: { type: String, required: true }, // "Vocabulary", "Grammar & Reading", "Listening"
  duration: { type: Number, required: true, min: 1 }, // in minutes
  questions: [questionSchema],
  audioUrl: { type: String, trim: true, default: '' }, // URL for listening section audio
}, { _id: false });

const practiceTestSchema = new mongoose.Schema({
  level: {
    type: String,
    required: true,
    enum: ['N5', 'N4', 'N3', 'N2', 'N1'],
    index: true,
  },
  title: { type: String, required: true, trim: true }, // e.g., "N5 Practice Test 1"
  description: { type: String, trim: true, default: '' },
  version: { type: String, trim: true, default: '1.0' }, // e.g., "Official Mock Exam 1"
  totalDuration: { type: Number, required: true }, // total time in minutes (sum of all sections)
  sections: {
    type: [sectionSchema],
    validate: {
      validator: v => v.length === 3,
      message: 'Must have exactly 3 sections (vocabulary, grammar-reading, listening)',
    },
  },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('PracticeTest', practiceTestSchema);
