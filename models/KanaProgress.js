const mongoose = require('mongoose');

const kanaProgressSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true,
  },
  hiragana: {
    type: Map,
    of: Number,
    default: {},
  },
  katakana: {
    type: Map,
    of: Number,
    default: {},
  },
}, { timestamps: true });

module.exports = mongoose.model('KanaProgress', kanaProgressSchema);
