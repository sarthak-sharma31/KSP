const mongoose = require('mongoose');

const vocabularyProgressSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  mastery: { type: Map, of: Number, default: {} },
}, { timestamps: true });

module.exports = mongoose.model('VocabularyProgress', vocabularyProgressSchema);
