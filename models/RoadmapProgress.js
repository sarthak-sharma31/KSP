const mongoose = require('mongoose');

/* Stores the two things that cannot be derived from mastery data:
   - `manualDone` — lessons the user explicitly ticked off (the `manual` kind).
   - `stages`     — which numbered stages of a staged lesson have been banked.
                    lessonId → sorted array of stage indexes.

   A stage is banked only after actually finishing that exercise at or above
   its pass mark, so it records work done rather than a button pressed.
   Everything else is still derived live from real mastery data. */
const roadmapProgressSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  manualDone: { type: [String], default: [] },
  stages: { type: Map, of: [Number], default: () => new Map() },
}, { timestamps: true });

module.exports = mongoose.model('RoadmapProgress', roadmapProgressSchema);
