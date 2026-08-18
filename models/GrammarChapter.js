const mongoose = require('mongoose');

/* ══════════════════════════════════════════════════════════════
   GRAMMAR — chapter › part › sentence
   Modelled on the Minna no Nihongo sequence: 25 chapters, each
   split into numbered parts (1.1, 1.2, …), each part teaching one
   pattern through annotated example sentences.

   Parts and sentences are embedded rather than separate collections
   because a chapter is always read as a whole and always edited as
   a whole — the same shape PracticeTest already uses for its
   sections and questions.
══════════════════════════════════════════════════════════════ */

/* What a word is *doing* in the sentence. This is the field that makes
   grammar teachable: a beginner can be told that ペン means "pen", but
   は means nothing on its own — it can only be explained by its role. */
const TOKEN_ROLES = [
  'noun', 'pronoun', 'name', 'verb', 'i-adjective', 'na-adjective',
  'particle', 'copula', 'adverb', 'question', 'number', 'counter',
  'conjunction', 'prefix', 'suffix', 'expression', 'other',
];

/* One word of a sentence, fully annotated.

   `gloss` is the meaning *in this position*, not a dictionary entry —
   for a particle it is a description of the job it does, which is why
   glosses like "(topic marker)" are both allowed and expected. */
const tokenSchema = new mongoose.Schema({
  jp:     { type: String, required: true, trim: true },   // これ
  romaji: { type: String, required: true, trim: true },   // kore
  gloss:  { type: String, default: '', trim: true },      // this
  role:   { type: String, enum: TOKEN_ROLES, default: 'other' },
  /* Anything surprising about this word: "written は but pronounced wa",
     "always comes at the end", "drops in casual speech". Surfaced as a
     tappable footnote on the token chip. */
  note:   { type: String, default: '', trim: true },
  /* Tokens with no English of their own (particles, copula) are not
     offered as tiles when the learner builds the English sentence. */
  silentInEnglish: { type: Boolean, default: false },
}, { _id: false });

/* One tile of the English sentence, in ENGLISH order, each optionally
   pointing back at the Japanese word it comes from.

   It lives on the sentence rather than on the token because the two
   languages disagree about order: です is last in Japanese but "is" is
   third in English, and さん follows the name while "Mr" precedes it. A
   per-token English field could never reassemble a natural sentence.

   Words with no Japanese counterpart ("a", "the") simply leave jp blank.
   Concatenating `text` in order must reproduce the sentence's `en`; when
   it doesn't, the runner falls back to plain word-splitting with no
   secondary text, so half-authored data degrades instead of breaking. */
const enTokenSchema = new mongoose.Schema({
  text:   { type: String, required: true, trim: true },   // "Mr"
  jp:     { type: String, default: '', trim: true },      // さん
  romaji: { type: String, default: '', trim: true },      // san
}, { _id: false });

const sentenceSchema = new mongoose.Schema({
  jp:      { type: String, required: true, trim: true },  // これはペンです
  romaji:  { type: String, default: '', trim: true },     // Kore wa pen desu
  en:      { type: String, required: true, trim: true },  // This is a pen
  /* Word-for-word in Japanese order — "this / (topic) / pen / is".
     Showing this next to the natural English is what makes the word
     order visible instead of something the learner has to infer. */
  literal: { type: String, default: '', trim: true },
  note:    { type: String, default: '', trim: true },
  tokens:  { type: [tokenSchema], default: [] },
  /* English tiles with their Japanese counterparts — see enTokenSchema. */
  enTokens: { type: [enTokenSchema], default: [] },
  /* Which derived drills this sentence takes part in. Every drill is
     generated from the tokens above, so authoring a sentence once is
     enough — there is no separate exercise to write and keep in sync. */
  drills:  { type: [String], default: ['gloss', 'translate', 'build', 'particle'] },
  order:   { type: Number, default: 1 },
}, { _id: true });

const partSchema = new mongoose.Schema({
  /* Displayed as "1.2". The chapter supplies the 1; this is the 2. */
  index:       { type: Number, required: true, min: 1 },
  title:       { type: String, required: true, trim: true },
  /* The abstract skeleton the sentences are instances of: "A は B です".
     Learners are shown this before any sentence, so each example reads
     as the pattern with the slots filled rather than a new mystery. */
  pattern:     { type: String, default: '', trim: true },
  patternEn:   { type: String, default: '', trim: true },   // "A is B"
  explanation: { type: String, default: '', trim: true },
  notes:       { type: [String], default: [] },
  sentences:   { type: [sentenceSchema], default: [] },
  isPublished: { type: Boolean, default: true },
}, { _id: true });

const grammarChapterSchema = new mongoose.Schema({
  number:  { type: Number, required: true, min: 1, max: 99, unique: true, index: true },
  level:   { type: String, enum: ['N5', 'N4', 'N3', 'N2', 'N1'], default: 'N5', index: true },
  title:   { type: String, required: true, trim: true },       // これは ペンです
  titleEn: { type: String, default: '', trim: true },          // This is a pen
  summary: { type: String, default: '', trim: true },          // one line for the shelf card

  /* The "what is は, why do we use it" briefing shown before any
     exercise. Plain paragraphs separated by blank lines. */
  intro:     { type: String, default: '', trim: true },
  keyPoints: { type: [String], default: [] },

  parts:       { type: [partSchema], default: [] },
  isPublished: { type: Boolean, default: false },
  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

/* Keep parts and sentences in their authored order without the client
   having to sort, and renumber parts so deleting 1.2 doesn't leave a hole. */
grammarChapterSchema.pre('save', function normalise(next) {
  this.parts.forEach((part, i) => {
    part.index = i + 1;
    part.sentences.forEach((s, j) => { s.order = j + 1; });
  });
  next();
});

grammarChapterSchema.virtual('sentenceCount').get(function count() {
  return this.parts.reduce((sum, p) => sum + p.sentences.length, 0);
});

grammarChapterSchema.set('toJSON', { virtuals: true });
grammarChapterSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('GrammarChapter', grammarChapterSchema);
module.exports.TOKEN_ROLES = TOKEN_ROLES;
