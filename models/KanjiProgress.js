const mongoose = require('mongoose');

const kanjiProgressSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true,
  },
  kanji: {
    type: Map,
    of: Number,
    default: {},
  },
}, { timestamps: true });

module.exports = mongoose.model('KanjiProgress', kanjiProgressSchema);
