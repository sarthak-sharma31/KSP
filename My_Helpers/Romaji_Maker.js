const mongoose = require('mongoose');
const wanakana = require('wanakana');
const Word = require('../models/Vocabulary');

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

async function addRomaji() {
  await mongoose.connect('mongodb://localhost:27017/kitsuspeak');

  const docs = await Word.find({
    $or: [
      { romaji: { $exists: false } },
      { romaji: '' }
    ]
  });

  console.log(`Found ${docs.length} docs`);

  const operations = docs.map(doc => ({
    updateOne: {
      filter: { _id: doc._id },
      update: {
        $set: {
          romaji: capitalize(
            wanakana.toRomaji(doc.kana)
          )
        }
      }
    }
  }));

  if (operations.length) {
    const result = await Word.bulkWrite(operations);
    console.log(`Updated ${result.modifiedCount} docs`);
  }

  console.log('Done!');
  process.exit(0);
}

addRomaji().catch(err => {
  console.error(err);
  process.exit(1);
});