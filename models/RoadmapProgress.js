const mongoose = require('mongoose');

/* Only stores lessons a user explicitly marked done (the `manual` kind).
   Everything else is derived live from real mastery data, so it can't drift
   out of sync with the learner's actual progress — or be faked by the client. */
const roadmapProgressSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  manualDone: { type: [String], default: [] },
}, { timestamps: true });

module.exports = mongoose.model('RoadmapProgress', roadmapProgressSchema);
