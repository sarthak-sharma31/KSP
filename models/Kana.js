const mongoose = require('mongoose');

const kanaSchema = new mongoose.Schema({
  type:    { type: String, required: true, enum: ['hiragana', 'katakana'], index: true },
  kana:    { type: String, required: true, trim: true },
  romaji:  { type: String, required: true, trim: true, lowercase: true },
  group:   { type: String, required: true, enum: ['vowels','k','s','t','n','h','m','y','r','w','special'] },
  order:   { type: Number, default: 0 },
  isActive:{ type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

kanaSchema.index({ type: 1, group: 1, order: 1 });

module.exports = mongoose.model('Kana', kanaSchema);