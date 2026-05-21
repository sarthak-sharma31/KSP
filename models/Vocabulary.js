const mongoose = require('mongoose');

const vocabularySchema = new mongoose.Schema({
  level: {
    type: String,
    required: true,
    enum: ['N5','N4','N3','N2','N1'],
    index: true,
  },
  kanji:     { type: String, required: true, trim: true },
  kana:      { type: String, required: true, trim: true },
  meaning:   { type: String, required: true, trim: true },
  type:      { type: String, enum: ['noun','verb','adj','adverb','particle','expression'], default: 'noun' },
  example:   { type: String, trim: true, default: '' },
  exampleEn: { type: String, trim: true, default: '' },
  isActive:  { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

// Compound index for fast level + type queries
vocabularySchema.index({ level: 1, type: 1 });

module.exports = mongoose.model('Vocabulary', vocabularySchema);
