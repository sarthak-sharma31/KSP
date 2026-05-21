const mongoose = require('mongoose');

const splitReadings = value => String(value || '')
  .split(/[、,]/)
  .map(v => v.trim())
  .filter(Boolean)
  .reduce((acc, reading) => {
    if (/[\u30a0-\u30ff]/.test(reading)) acc.onyomi.push(reading);
    else acc.kunyomi.push(reading);
    return acc;
  }, { onyomi: [], kunyomi: [] });

/* ══════════════════════════════════════════════════════════════
   KANJI
══════════════════════════════════════════════════════════════ */
const kanjiSchema = new mongoose.Schema({
  level:           { type: String, required: true, enum: ['N5','N4','N3','N2','N1'], index: true },
  char:            { type: String, required: true, trim: true, unique: true },
  meaning:         { type: String, required: true, trim: true }, // display name
  names:           { type: String, trim: true, default: '' },    // comma-separated all/alternate names
  readings:        { type: String, trim: true, default: '' },    // legacy combined readings
  kunyomi:         { type: String, trim: true, default: '' },    // comma-separated Japanese readings
  kunyomiEnglish:  { type: String, trim: true, default: '' },    // comma-separated English reading notes
  onyomi:          { type: String, trim: true, default: '' },    // comma-separated Japanese readings
  onyomiEnglish:   { type: String, trim: true, default: '' },    // comma-separated English reading notes
  popularReading:  { type: String, trim: true, default: '' },
  strokes:         { type: Number, required: true, min: 1 },
  examples:        { type: String, trim: true, default: '' },    // comma-separated
  isActive:        { type: Boolean, default: true },
  createdBy:       { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

kanjiSchema.pre('validate', function normalizeKanji(next) {
  if (!this.names && this.meaning) this.names = this.meaning;
  if (this.readings && (!this.onyomi || !this.kunyomi)) {
    const split = splitReadings(this.readings);
    if (!this.onyomi) this.onyomi = split.onyomi.join(', ');
    if (!this.kunyomi) this.kunyomi = split.kunyomi.join(', ');
  }
  if (!this.readings) {
    this.readings = [this.onyomi, this.kunyomi].filter(Boolean).join(', ');
  }
  next();
});

/* ══════════════════════════════════════════════════════════════
   GRAMMAR
══════════════════════════════════════════════════════════════ */
const grammarSchema = new mongoose.Schema({
  level:       { type: String, required: true, enum: ['N5','N4','N3','N2','N1'], index: true },
  title:       { type: String, required: true, trim: true },
  structure:   { type: String, trim: true, default: '' },
  explanation: { type: String, required: true, trim: true },
  example:     { type: String, trim: true, default: '' },
  exampleEn:   { type: String, trim: true, default: '' },
  isActive:    { type: Boolean, default: true },
  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

/* ══════════════════════════════════════════════════════════════
   QUIZ QUESTION
══════════════════════════════════════════════════════════════ */
const quizSchema = new mongoose.Schema({
  level:    { type: String, required: true, enum: ['N5','N4','N3','N2','N1'], index: true },
  question: { type: String, required: true, trim: true },
  options:  {
    type: [String],
    required: true,
    validate: { validator: v => v.length === 4, message: 'Must have exactly 4 options' },
  },
  answer:   { type: Number, required: true, min: 0, max: 3 }, // index of correct option
  isActive: { type: Boolean, default: true },
  createdBy:{ type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

/* ══════════════════════════════════════════════════════════════
   USER PROGRESS  (SRS card state per user per card)
══════════════════════════════════════════════════════════════ */
const progressSchema = new mongoose.Schema({
  user:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  cardId:     { type: mongoose.Schema.Types.ObjectId, required: true },   // vocab / kanji id
  cardType:   { type: String, enum: ['vocabulary','kanji'], required: true },
  level:      { type: String, enum: ['N5','N4','N3','N2','N1'] },

  // SM-2 SRS fields
  repetitions: { type: Number, default: 0 },
  easeFactor:  { type: Number, default: 2.5 },
  interval:    { type: Number, default: 1 },    // days until next review
  nextReview:  { type: Date,   default: Date.now },
  lastResult:  { type: String, enum: ['know','unknown'], default: 'unknown' },
}, { timestamps: true });

progressSchema.index({ user: 1, cardType: 1, nextReview: 1 }); // fast SRS query

/* ══════════════════════════════════════════════════════════════
   QUIZ ATTEMPT  (record every quiz a user takes)
══════════════════════════════════════════════════════════════ */
const quizAttemptSchema = new mongoose.Schema({
  user:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  level:    { type: String, enum: ['N5','N4','N3','N2','N1'] },
  score:    { type: Number, required: true },     // number correct
  total:    { type: Number, required: true },     // total questions
  duration: { type: Number, default: 0 },        // seconds taken
  answers:  [{ questionId: mongoose.Schema.Types.ObjectId, correct: Boolean }],
}, { timestamps: true });

/* ══════════════════════════════════════════════════════════════
   ANNOUNCEMENT
══════════════════════════════════════════════════════════════ */
const announcementSchema = new mongoose.Schema({
  title:     { type: String, required: true, trim: true },
  body:      { type: String, required: true, trim: true },
  target:    { type: String, default: 'all' },  // 'all' | 'N5' | 'N4' | 'premium'
  status:    { type: String, enum: ['draft','published'], default: 'draft' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

/* ══════════════════════════════════════════════════════════════
   PREREGISTRATION / WAITLIST
══════════════════════════════════════════════════════════════ */
const preregistrationSchema = new mongoose.Schema({
  email:     { type: String, required: true, lowercase: true, trim: true, unique: true, index: true },
  source:    { type: String, trim: true, default: 'website' },
  userAgent: { type: String, trim: true, default: '' },
  ip:        { type: String, trim: true, default: '' },
}, { timestamps: true });

module.exports = {
  Kanji:        mongoose.model('Kanji',        kanjiSchema),
  Grammar:      mongoose.model('Grammar',      grammarSchema),
  Quiz:         mongoose.model('Quiz',         quizSchema),
  Progress:     mongoose.model('Progress',     progressSchema),
  QuizAttempt:  mongoose.model('QuizAttempt',  quizAttemptSchema),
  Announcement: mongoose.model('Announcement', announcementSchema),
  Preregistration: mongoose.model('Preregistration', preregistrationSchema),
};
