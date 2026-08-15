/* ══════════════════════════════════════════════════════════════
   GRAMMAR SEED
   The 25-chapter N5 sequence in the order Minna no Nihongo teaches
   it. The ordering of grammar points is a fact about how Japanese
   is taught; all explanations and example sentences here are our
   own, so nothing is copied from the book.

   Chapters 1 and 2 are authored in full as the reference for how a
   chapter is written. The rest are created as empty published
   shells so the shelf shows the whole course and the admin panel
   has something concrete to fill in.

   Run:  node utils/seedGrammar.js
══════════════════════════════════════════════════════════════ */

require('dotenv').config();
const mongoose = require('mongoose');
const GrammarChapter = require('../models/GrammarChapter');

/* Shorthand for a token. Keeping this terse is what makes authoring a
   fully-glossed sentence practical rather than a wall of JSON. */
const t = (jp, romaji, gloss, role, note = '', silentInEnglish = false) =>
  ({ jp, romaji, gloss, role, note, silentInEnglish });

/* Reused function words — written once so their explanation is identical
   everywhere they appear. */
const WA = () => t('は', 'wa', '(topic marker)', 'particle',
  'Written は, but pronounced "wa" when it does this job. It marks what the sentence is about — English has no word for it.', true);
const DESU = (gloss = 'is') => t('です', 'desu', gloss, 'copula',
  'The polite "to be". Japanese puts it at the very end, where English puts it in the middle.');
const KA = () => t('か', 'ka', '(question marker)', 'particle',
  'Add か to the end and the statement becomes a question. Nothing else moves — no word order change, no rising word.', true);
const NO = () => t('の', 'no', "'s / of", 'particle',
  'Joins two nouns. Whatever comes before の describes whatever comes after it.');
const SAN = () => t('さん', 'san', 'Mr / Ms', 'suffix',
  "A polite tag on someone else's name. Never attach it to your own.");

const CHAPTER_1 = {
  number: 1,
  level: 'N5',
  title: 'わたしは がくせいです',
  titleEn: 'I am a student',
  summary: 'Your first complete sentence: naming what something is.',
  intro: `Japanese sentences do not start by telling you who is doing what. They start by putting something on the table and saying "right — about this…". The word that does that is は.

Take "Kore wa pen desu". Word for word it is "this — about it — pen — is". There is no word for "a", no word for "the", and the verb "is" waits until the very end. Once you can see that shape, the sentence stops being four mystery syllables and becomes a pattern you can pour any two nouns into.

は is the piece with no English equivalent, so it is the piece worth slowing down on. It does not mean "is". It is a signpost that says "the thing I just said is the topic; here comes what I want to tell you about it". You will meet it in every chapter from here on.

One warning that trips up every beginner: the character は is normally read "ha". When it is doing this job, it is read "wa". Same symbol, different sound.`,
  keyPoints: [
    'は marks the topic — the thing the sentence is about.',
    'です is the polite "is/am/are", and it always comes last.',
    'は is written "ha" but pronounced "wa" when used as a particle.',
    'Japanese has no words for "a" or "the".',
  ],
  isPublished: true,
  parts: [
    {
      index: 1,
      title: 'A は B です',
      pattern: 'A は B です',
      patternEn: 'A is B',
      explanation: 'The backbone of Japanese. Put a topic in slot A, put what it is in slot B, and close with です. Both slots take nouns.',
      notes: [
        'です is polite. You will meet the casual version (だ) much later.',
        'Nothing between A and B changes form — you are only swapping nouns.',
      ],
      sentences: [
        {
          jp: 'これは ペンです',
          romaji: 'Kore wa pen desu',
          en: 'This is a pen',
          literal: 'this — (topic) — pen — is',
          note: 'The sentence every Japanese course starts with, and the whole pattern in four words.',
          tokens: [
            t('これ', 'kore', 'this', 'pronoun', 'Something close to you, the speaker.'),
            WA(),
            t('ペン', 'pen', 'pen', 'noun', 'A borrowed English word, so it is written in katakana.'),
            DESU('is'),
          ],
        },
        {
          jp: 'わたしは がくせいです',
          romaji: 'Watashi wa gakusei desu',
          en: 'I am a student',
          literal: 'I — (topic) — student — am',
          tokens: [
            t('わたし', 'watashi', 'I', 'pronoun', 'Neutral and polite. Japanese drops it whenever it is obvious who you mean.'),
            WA(),
            t('がくせい', 'gakusei', 'student', 'noun'),
            DESU('am'),
          ],
        },
        {
          jp: 'たなかさんは せんせいです',
          romaji: 'Tanaka-san wa sensei desu',
          en: 'Mr Tanaka is a teacher',
          literal: 'Tanaka — Mr — (topic) — teacher — is',
          tokens: [
            t('たなか', 'Tanaka', 'Tanaka', 'name'),
            SAN(),
            WA(),
            t('せんせい', 'sensei', 'teacher', 'noun'),
            DESU('is'),
          ],
        },
        {
          jp: 'やまださんは いしゃです',
          romaji: 'Yamada-san wa isha desu',
          en: 'Ms Yamada is a doctor',
          literal: 'Yamada — Ms — (topic) — doctor — is',
          tokens: [
            t('やまだ', 'Yamada', 'Yamada', 'name'),
            SAN(),
            WA(),
            t('いしゃ', 'isha', 'doctor', 'noun'),
            DESU('is'),
          ],
        },
      ],
    },
    {
      index: 2,
      title: 'A は B じゃありません',
      pattern: 'A は B じゃありません',
      patternEn: 'A is not B',
      explanation: 'To say something is *not* the case, swap です for じゃありません. The rest of the sentence is untouched.',
      notes: [
        'ではありません is the same thing in a more formal register — common in writing.',
        'Only the ending changes. Resist the urge to add a word for "not" earlier in the sentence.',
      ],
      sentences: [
        {
          jp: 'わたしは せんせいじゃありません',
          romaji: 'Watashi wa sensei ja arimasen',
          en: 'I am not a teacher',
          literal: 'I — (topic) — teacher — am not',
          tokens: [
            t('わたし', 'watashi', 'I', 'pronoun'),
            WA(),
            t('せんせい', 'sensei', 'teacher', 'noun'),
            t('じゃありません', 'ja arimasen', 'am not', 'copula', 'The negative of です. It replaces です entirely.'),
          ],
        },
        {
          jp: 'これは ほんじゃありません',
          romaji: 'Kore wa hon ja arimasen',
          en: 'This is not a book',
          literal: 'this — (topic) — book — is not',
          tokens: [
            t('これ', 'kore', 'this', 'pronoun'),
            WA(),
            t('ほん', 'hon', 'book', 'noun'),
            t('じゃありません', 'ja arimasen', 'is not', 'copula', 'The negative of です.'),
          ],
        },
        {
          jp: 'たなかさんは がくせいじゃありません',
          romaji: 'Tanaka-san wa gakusei ja arimasen',
          en: 'Mr Tanaka is not a student',
          literal: 'Tanaka — Mr — (topic) — student — is not',
          tokens: [
            t('たなか', 'Tanaka', 'Tanaka', 'name'),
            SAN(),
            WA(),
            t('がくせい', 'gakusei', 'student', 'noun'),
            t('じゃありません', 'ja arimasen', 'is not', 'copula', 'The negative of です.'),
          ],
        },
      ],
    },
    {
      index: 3,
      title: 'A は B ですか',
      pattern: 'A は B ですか',
      patternEn: 'Is A B?',
      explanation: 'Questions are the easiest thing in Japanese: leave the sentence exactly as it is and add か at the end.',
      notes: [
        'No inversion. "You are a student" and "Are you a student?" differ by one syllable.',
        'A question mark is optional in Japanese — か already does that job.',
      ],
      sentences: [
        {
          jp: 'これは ほんですか',
          romaji: 'Kore wa hon desu ka',
          en: 'Is this a book?',
          literal: 'this — (topic) — book — is — ?',
          tokens: [
            t('これ', 'kore', 'this', 'pronoun'),
            WA(),
            t('ほん', 'hon', 'book', 'noun'),
            DESU('is'),
            KA(),
          ],
        },
        {
          jp: 'たなかさんは いしゃですか',
          romaji: 'Tanaka-san wa isha desu ka',
          en: 'Is Mr Tanaka a doctor?',
          literal: 'Tanaka — Mr — (topic) — doctor — is — ?',
          tokens: [
            t('たなか', 'Tanaka', 'Tanaka', 'name'),
            SAN(),
            WA(),
            t('いしゃ', 'isha', 'doctor', 'noun'),
            DESU('is'),
            KA(),
          ],
        },
      ],
    },
    {
      index: 4,
      title: 'A も B です',
      pattern: 'A も B です',
      patternEn: 'A is B too',
      explanation: 'When the new thing you are saying matches what was just said, replace は with も. も carries the meaning "too / also".',
      notes: [
        'も does not sit alongside は — it takes its place.',
        'Unlike は, も does translate: it really does mean "too".',
      ],
      sentences: [
        {
          jp: 'わたしも がくせいです',
          romaji: 'Watashi mo gakusei desu',
          en: 'I am a student too',
          literal: 'I — too — student — am',
          tokens: [
            t('わたし', 'watashi', 'I', 'pronoun'),
            t('も', 'mo', 'too / also', 'particle', 'Takes the place of は when you are adding to something already said.'),
            t('がくせい', 'gakusei', 'student', 'noun'),
            DESU('am'),
          ],
        },
        {
          jp: 'やまださんも せんせいです',
          romaji: 'Yamada-san mo sensei desu',
          en: 'Ms Yamada is a teacher too',
          literal: 'Yamada — Ms — too — teacher — is',
          tokens: [
            t('やまだ', 'Yamada', 'Yamada', 'name'),
            SAN(),
            t('も', 'mo', 'too / also', 'particle', 'Replaces は.'),
            t('せんせい', 'sensei', 'teacher', 'noun'),
            DESU('is'),
          ],
        },
      ],
    },
    {
      index: 5,
      title: 'A の B',
      pattern: 'A の B',
      patternEn: "A's B / B of A",
      explanation: 'の glues two nouns together. The first one describes the second — ownership, origin, category, whatever fits.',
      notes: [
        'Read it right to left: わたしの ほん is "book" first, "mine" second.',
        'The same の covers "my", "the company\'s", "a Japanese-language ~". Context decides.',
      ],
      sentences: [
        {
          jp: 'これは わたしの ほんです',
          romaji: 'Kore wa watashi no hon desu',
          en: 'This is my book',
          literal: "this — (topic) — I — 's — book — is",
          tokens: [
            t('これ', 'kore', 'this', 'pronoun'),
            WA(),
            t('わたし', 'watashi', 'I / my', 'pronoun'),
            NO(),
            t('ほん', 'hon', 'book', 'noun'),
            DESU('is'),
          ],
        },
        {
          jp: 'たなかさんは にほんごの せんせいです',
          romaji: 'Tanaka-san wa nihongo no sensei desu',
          en: 'Mr Tanaka is a Japanese teacher',
          literal: 'Tanaka — Mr — (topic) — Japanese language — of — teacher — is',
          note: 'Here の marks a category rather than ownership: a teacher *of* Japanese.',
          tokens: [
            t('たなか', 'Tanaka', 'Tanaka', 'name'),
            SAN(),
            WA(),
            t('にほんご', 'nihongo', 'Japanese (language)', 'noun', 'にほん = Japan, ご = language.'),
            NO(),
            t('せんせい', 'sensei', 'teacher', 'noun'),
            DESU('is'),
          ],
        },
      ],
    },
  ],
};

const CHAPTER_2 = {
  number: 2,
  level: 'N5',
  title: 'これ・それ・あれ',
  titleEn: 'This, that, that over there',
  summary: 'Pointing at things — and why Japanese needs three words where English has two.',
  intro: `English splits the world in two: things near me are "this", everything else is "that". Japanese splits it in three, and the dividing line is not distance from you — it is who the thing is near.

これ is near me. それ is near you. あれ is near neither of us. If a pen is on your desk and you are across the room, an English speaker says "that pen" and a Japanese speaker says それ — not because it is far, but because it is on your side of the conversation.

There is a second set that behaves differently, and mixing them up is the most common mistake in this chapter. これ stands alone as a whole noun: "this one". この cannot stand alone — it must be glued to a noun: この ペン, "this pen". Same three-way split, two different jobs.`,
  keyPoints: [
    'これ = near me, それ = near you, あれ = near neither.',
    'これ/それ/あれ stand alone. この/その/あの must be followed by a noun.',
    'The matching question word is どれ ("which one") or どの ("which ~").',
  ],
  isPublished: true,
  parts: [
    {
      index: 1,
      title: 'これ・それ・あれ',
      pattern: 'これ / それ / あれ は B です',
      patternEn: 'This / that / that over there is B',
      explanation: 'Three stand-alone pronouns for pointing. Which one you pick depends on whose side of the conversation the thing is on.',
      notes: ['These replace a whole noun, so nothing follows them but a particle.'],
      sentences: [
        {
          jp: 'それは かばんです',
          romaji: 'Sore wa kaban desu',
          en: 'That is a bag',
          literal: 'that (near you) — (topic) — bag — is',
          tokens: [
            t('それ', 'sore', 'that (near you)', 'pronoun', 'Near the listener, whatever the actual distance.'),
            WA(),
            t('かばん', 'kaban', 'bag', 'noun'),
            DESU('is'),
          ],
        },
        {
          jp: 'あれは くるまです',
          romaji: 'Are wa kuruma desu',
          en: 'That over there is a car',
          literal: 'that over there — (topic) — car — is',
          tokens: [
            t('あれ', 'are', 'that over there', 'pronoun', 'Away from both of you.'),
            WA(),
            t('くるま', 'kuruma', 'car', 'noun'),
            DESU('is'),
          ],
        },
      ],
    },
    {
      index: 2,
      title: 'この・その・あの + noun',
      pattern: 'この / その / あの + noun',
      patternEn: 'this ~ / that ~ / that ~ over there',
      explanation: 'The attached versions. They cannot stand alone — a noun must follow immediately.',
      notes: ['この ペン is correct. この on its own is not a sentence.'],
      sentences: [
        {
          jp: 'この ほんは わたしのです',
          romaji: 'Kono hon wa watashi no desu',
          en: 'This book is mine',
          literal: 'this — book — (topic) — I — \'s — is',
          note: 'の at the end stands in for the noun you would otherwise repeat: "mine" rather than "my book".',
          tokens: [
            t('この', 'kono', 'this ~', 'prefix', 'Must be followed by a noun.'),
            t('ほん', 'hon', 'book', 'noun'),
            WA(),
            t('わたし', 'watashi', 'I / my', 'pronoun'),
            NO(),
            DESU('is'),
          ],
        },
        {
          jp: 'あの ひとは やまださんです',
          romaji: 'Ano hito wa Yamada-san desu',
          en: 'That person is Ms Yamada',
          literal: 'that over there — person — (topic) — Yamada — Ms — is',
          tokens: [
            t('あの', 'ano', 'that ~ over there', 'prefix', 'Must be followed by a noun.'),
            t('ひと', 'hito', 'person', 'noun'),
            WA(),
            t('やまだ', 'Yamada', 'Yamada', 'name'),
            SAN(),
            DESU('is'),
          ],
        },
      ],
    },
    {
      index: 3,
      title: 'そうです / ちがいます',
      pattern: 'はい、そうです / いいえ、ちがいます',
      patternEn: 'Yes, that\'s right / No, that\'s wrong',
      explanation: 'The standard short answers to a です question. You do not have to repeat the whole sentence back.',
      notes: ['そうです only answers noun questions — it will not work on verbs.'],
      sentences: [
        {
          jp: 'はい、そうです',
          romaji: 'Hai, sou desu',
          en: "Yes, that's right",
          literal: 'yes — so — is',
          tokens: [
            t('はい', 'hai', 'yes', 'expression'),
            t('そう', 'sou', 'so / that way', 'adverb'),
            DESU('is'),
          ],
        },
        {
          jp: 'いいえ、ちがいます',
          romaji: 'Iie, chigaimasu',
          en: "No, that's wrong",
          literal: 'no — differs',
          note: 'Literally "it differs" — softer than saying "no" twice.',
          tokens: [
            t('いいえ', 'iie', 'no', 'expression'),
            t('ちがいます', 'chigaimasu', 'that is not it', 'verb', 'Literally "it differs". The normal way to correct someone politely.'),
          ],
        },
      ],
    },
  ],
};

/* Chapters 3–25. The grammar sequence is fixed; the content is authored in
   the admin panel. Published with no parts so the shelf shows the whole
   course rather than pretending it stops at chapter 2. */
const REMAINING = [
  [3,  'ここ・そこ・あそこ',      'Here, there, over there',        'Talking about places, and asking how much something costs.'],
  [4,  'いま なんじですか',       'What time is it?',               'Clock time, "from ~ to ~", and your first verbs.'],
  [5,  '〜へ いきます',           'Going places',                   'Movement verbs, how you travelled, and who with.'],
  [6,  '〜を たべます',           'Doing things',                   'Objects with を, where an action happens, and inviting someone.'],
  [7,  '〜で きります',           'Tools and giving',               'Doing something with a tool, plus giving and receiving.'],
  [8,  'けいようし',              'Adjectives',                     'い- and な-adjectives, and describing what things are like.'],
  [9,  'すきです・わかります',     'Likes and abilities',            'What you like, what you understand, and saying why.'],
  [10, 'あります・います',         'Existence',                      'Saying something exists, and where it is.'],
  [11, 'かぞえかた',              'Counting',                       'Counters for people, things, and how many you want.'],
  [12, 'ひかく',                  'Past tense and comparison',      'Past forms, "A is more ~ than B", and picking a favourite.'],
  [13, '〜が ほしいです',          'Wants',                          'What you want, what you want to do, and going somewhere to do it.'],
  [14, 'てフォーム',              'The て-form',                    'The form everything else is built on — requests and "-ing".'],
  [15, '〜ても いいです',          'Permission',                     'May I ~, you must not ~, and describing ongoing states.'],
  [16, '〜て、〜て',               'Joining sentences',              'Sequences of actions and "after doing ~".'],
  [17, 'ないフォーム',            'The ない-form',                  'Please don\'t ~, you have to ~, and you don\'t have to ~.'],
  [18, 'じしょけい',              'Dictionary form',                'Can do ~, before doing ~, and talking about hobbies.'],
  [19, 'たフォーム',              'The た-form',                    'Have you ever ~, doing things like ~ and ~, and becoming.'],
  [20, 'ふつうけい',              'Casual speech',                  'The plain forms, and when polite Japanese is the wrong choice.'],
  [21, '〜と おもいます',          'Thoughts and quotes',            'I think that ~, they said that ~, and probably.'],
  [22, 'めいしの しゅうしょく',    'Describing nouns',               'Using a whole clause to describe a noun.'],
  [23, '〜とき・〜と',            'When and if',                    'When ~ happens, and automatic consequences.'],
  [24, 'あげます・くれます',       'Giving and receiving',           'Doing something for someone, and having it done for you.'],
  [25, '〜たら・〜ても',           'Conditions',                     'If ~ then ~, and even if ~.'],
].map(([number, title, titleEn, summary]) => ({
  number, title, titleEn, summary,
  level: 'N5',
  intro: '',
  keyPoints: [],
  parts: [],
  isPublished: true,
}));

const CHAPTERS = [CHAPTER_1, CHAPTER_2, ...REMAINING];

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('connected');

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const chapter of CHAPTERS) {
    const existing = await GrammarChapter.findOne({ number: chapter.number });

    if (!existing) {
      await GrammarChapter.create(chapter);
      created += 1;
      continue;
    }

    // Never clobber authored content: an existing chapter that already has
    // parts is left exactly as it is. Empty shells get refreshed so title
    // and summary edits in this file still land.
    if (existing.parts.length > 0) { skipped += 1; continue; }

    Object.assign(existing, chapter);
    await existing.save();
    updated += 1;
  }

  console.log(`chapters: ${created} created, ${updated} refreshed, ${skipped} left alone (already authored)`);
  await mongoose.disconnect();
}

if (require.main === module) {
  seed().catch(err => { console.error(err); process.exit(1); });
}

module.exports = { CHAPTERS, seed };
