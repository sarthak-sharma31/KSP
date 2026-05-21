// Add this to your existing seed.js file
// or run it separately as: node src/utils/seedKana.js

require('dotenv').config();
const mongoose   = require('mongoose');
const connectDB  = require('../config/db');
const Kana       = require('../models/Kana');
const User       = require('../models/User');

const HIRAGANA = [
  { type:'hiragana', kana:'あ', romaji:'a',   group:'vowels',  order:1  },
  { type:'hiragana', kana:'い', romaji:'i',   group:'vowels',  order:2  },
  { type:'hiragana', kana:'う', romaji:'u',   group:'vowels',  order:3  },
  { type:'hiragana', kana:'え', romaji:'e',   group:'vowels',  order:4  },
  { type:'hiragana', kana:'お', romaji:'o',   group:'vowels',  order:5  },
  { type:'hiragana', kana:'か', romaji:'ka',  group:'k',       order:6  },
  { type:'hiragana', kana:'き', romaji:'ki',  group:'k',       order:7  },
  { type:'hiragana', kana:'く', romaji:'ku',  group:'k',       order:8  },
  { type:'hiragana', kana:'け', romaji:'ke',  group:'k',       order:9  },
  { type:'hiragana', kana:'こ', romaji:'ko',  group:'k',       order:10 },
  { type:'hiragana', kana:'さ', romaji:'sa',  group:'s',       order:11 },
  { type:'hiragana', kana:'し', romaji:'shi', group:'s',       order:12 },
  { type:'hiragana', kana:'す', romaji:'su',  group:'s',       order:13 },
  { type:'hiragana', kana:'せ', romaji:'se',  group:'s',       order:14 },
  { type:'hiragana', kana:'そ', romaji:'so',  group:'s',       order:15 },
  { type:'hiragana', kana:'た', romaji:'ta',  group:'t',       order:16 },
  { type:'hiragana', kana:'ち', romaji:'chi', group:'t',       order:17 },
  { type:'hiragana', kana:'つ', romaji:'tsu', group:'t',       order:18 },
  { type:'hiragana', kana:'て', romaji:'te',  group:'t',       order:19 },
  { type:'hiragana', kana:'と', romaji:'to',  group:'t',       order:20 },
  { type:'hiragana', kana:'な', romaji:'na',  group:'n',       order:21 },
  { type:'hiragana', kana:'に', romaji:'ni',  group:'n',       order:22 },
  { type:'hiragana', kana:'ぬ', romaji:'nu',  group:'n',       order:23 },
  { type:'hiragana', kana:'ね', romaji:'ne',  group:'n',       order:24 },
  { type:'hiragana', kana:'の', romaji:'no',  group:'n',       order:25 },
  { type:'hiragana', kana:'は', romaji:'ha',  group:'h',       order:26 },
  { type:'hiragana', kana:'ひ', romaji:'hi',  group:'h',       order:27 },
  { type:'hiragana', kana:'ふ', romaji:'fu',  group:'h',       order:28 },
  { type:'hiragana', kana:'へ', romaji:'he',  group:'h',       order:29 },
  { type:'hiragana', kana:'ほ', romaji:'ho',  group:'h',       order:30 },
  { type:'hiragana', kana:'ま', romaji:'ma',  group:'m',       order:31 },
  { type:'hiragana', kana:'み', romaji:'mi',  group:'m',       order:32 },
  { type:'hiragana', kana:'む', romaji:'mu',  group:'m',       order:33 },
  { type:'hiragana', kana:'め', romaji:'me',  group:'m',       order:34 },
  { type:'hiragana', kana:'も', romaji:'mo',  group:'m',       order:35 },
  { type:'hiragana', kana:'や', romaji:'ya',  group:'y',       order:36 },
  { type:'hiragana', kana:'ゆ', romaji:'yu',  group:'y',       order:37 },
  { type:'hiragana', kana:'よ', romaji:'yo',  group:'y',       order:38 },
  { type:'hiragana', kana:'ら', romaji:'ra',  group:'r',       order:39 },
  { type:'hiragana', kana:'り', romaji:'ri',  group:'r',       order:40 },
  { type:'hiragana', kana:'る', romaji:'ru',  group:'r',       order:41 },
  { type:'hiragana', kana:'れ', romaji:'re',  group:'r',       order:42 },
  { type:'hiragana', kana:'ろ', romaji:'ro',  group:'r',       order:43 },
  { type:'hiragana', kana:'わ', romaji:'wa',  group:'w',       order:44 },
  { type:'hiragana', kana:'を', romaji:'wo',  group:'w',       order:45 },
  { type:'hiragana', kana:'ん', romaji:'n',   group:'special', order:46 },
];

const KATAKANA = [
  { type:'katakana', kana:'ア', romaji:'a',   group:'vowels',  order:1  },
  { type:'katakana', kana:'イ', romaji:'i',   group:'vowels',  order:2  },
  { type:'katakana', kana:'ウ', romaji:'u',   group:'vowels',  order:3  },
  { type:'katakana', kana:'エ', romaji:'e',   group:'vowels',  order:4  },
  { type:'katakana', kana:'オ', romaji:'o',   group:'vowels',  order:5  },
  { type:'katakana', kana:'カ', romaji:'ka',  group:'k',       order:6  },
  { type:'katakana', kana:'キ', romaji:'ki',  group:'k',       order:7  },
  { type:'katakana', kana:'ク', romaji:'ku',  group:'k',       order:8  },
  { type:'katakana', kana:'ケ', romaji:'ke',  group:'k',       order:9  },
  { type:'katakana', kana:'コ', romaji:'ko',  group:'k',       order:10 },
  { type:'katakana', kana:'サ', romaji:'sa',  group:'s',       order:11 },
  { type:'katakana', kana:'シ', romaji:'shi', group:'s',       order:12 },
  { type:'katakana', kana:'ス', romaji:'su',  group:'s',       order:13 },
  { type:'katakana', kana:'セ', romaji:'se',  group:'s',       order:14 },
  { type:'katakana', kana:'ソ', romaji:'so',  group:'s',       order:15 },
  { type:'katakana', kana:'タ', romaji:'ta',  group:'t',       order:16 },
  { type:'katakana', kana:'チ', romaji:'chi', group:'t',       order:17 },
  { type:'katakana', kana:'ツ', romaji:'tsu', group:'t',       order:18 },
  { type:'katakana', kana:'テ', romaji:'te',  group:'t',       order:19 },
  { type:'katakana', kana:'ト', romaji:'to',  group:'t',       order:20 },
  { type:'katakana', kana:'ナ', romaji:'na',  group:'n',       order:21 },
  { type:'katakana', kana:'ニ', romaji:'ni',  group:'n',       order:22 },
  { type:'katakana', kana:'ヌ', romaji:'nu',  group:'n',       order:23 },
  { type:'katakana', kana:'ネ', romaji:'ne',  group:'n',       order:24 },
  { type:'katakana', kana:'ノ', romaji:'no',  group:'n',       order:25 },
  { type:'katakana', kana:'ハ', romaji:'ha',  group:'h',       order:26 },
  { type:'katakana', kana:'ヒ', romaji:'hi',  group:'h',       order:27 },
  { type:'katakana', kana:'フ', romaji:'fu',  group:'h',       order:28 },
  { type:'katakana', kana:'ヘ', romaji:'he',  group:'h',       order:29 },
  { type:'katakana', kana:'ホ', romaji:'ho',  group:'h',       order:30 },
  { type:'katakana', kana:'マ', romaji:'ma',  group:'m',       order:31 },
  { type:'katakana', kana:'ミ', romaji:'mi',  group:'m',       order:32 },
  { type:'katakana', kana:'ム', romaji:'mu',  group:'m',       order:33 },
  { type:'katakana', kana:'メ', romaji:'me',  group:'m',       order:34 },
  { type:'katakana', kana:'モ', romaji:'mo',  group:'m',       order:35 },
  { type:'katakana', kana:'ヤ', romaji:'ya',  group:'y',       order:36 },
  { type:'katakana', kana:'ユ', romaji:'yu',  group:'y',       order:37 },
  { type:'katakana', kana:'ヨ', romaji:'yo',  group:'y',       order:38 },
  { type:'katakana', kana:'ラ', romaji:'ra',  group:'r',       order:39 },
  { type:'katakana', kana:'リ', romaji:'ri',  group:'r',       order:40 },
  { type:'katakana', kana:'ル', romaji:'ru',  group:'r',       order:41 },
  { type:'katakana', kana:'レ', romaji:'re',  group:'r',       order:42 },
  { type:'katakana', kana:'ロ', romaji:'ro',  group:'r',       order:43 },
  { type:'katakana', kana:'ワ', romaji:'wa',  group:'w',       order:44 },
  { type:'katakana', kana:'ヲ', romaji:'wo',  group:'w',       order:45 },
  { type:'katakana', kana:'ン', romaji:'n',   group:'special', order:46 },
];

const seedKana = async () => {
  try {
    await connectDB();
    console.log('🌱 Seeding kana...');

    // Get admin user
    const admin = await User.findOne({ role: 'admin' });
    if (!admin) {
      console.error('❌ No admin user found. Run npm run seed first.');
      process.exit(1);
    }

    // Clear existing kana
    await Kana.deleteMany({});
    console.log('🗑️  Cleared existing kana');

    // Insert all kana
    const allKana = [...HIRAGANA, ...KATAKANA].map(k => ({ ...k, createdBy: admin._id }));
    await Kana.insertMany(allKana);

    console.log(`✅ ${HIRAGANA.length} hiragana seeded`);
    console.log(`✅ ${KATAKANA.length} katakana seeded`);
    console.log(`\n🦊 Kana seed complete! Total: ${allKana.length} characters`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Kana seed failed:', err.message);
    process.exit(1);
  }
};

seedKana();