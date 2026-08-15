const mongoose = require('mongoose');

/* Per-part grammar progress. The previous grammar page kept completion in
   localStorage, so it vanished on a new device and could not feed the
   roadmap, the streak, or anything else. This is the server-side record.

   Keyed by "<chapterNumber>-<partIndex>" (e.g. "1-2") rather than by
   ObjectId so progress survives a chapter being re-authored in the admin
   panel — editing a part's text should not wipe the learner's history.
   A dash rather than a dot because Mongoose forbids dots in Map keys. */
const partResultSchema = new mongoose.Schema({
  done:     { type: Boolean, default: false },
  best:     { type: Number, default: 0, min: 0, max: 100 },
  attempts: { type: Number, default: 0 },
  lastAt:   { type: Date },
}, { _id: false });

const grammarProgressSchema = new mongoose.Schema({
  user:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  parts: { type: Map, of: partResultSchema, default: () => new Map() },
}, { timestamps: true });

module.exports = mongoose.model('GrammarProgress', grammarProgressSchema);
