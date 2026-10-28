const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const EmailUser = require('../models/EmailUser');
const Question = require('../models/Question');
const QuestionBank = require('../models/QuestionBank');

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is missing. Add it to Backend/.env and run this script again.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const unassignedCount = await Question.countDocuments({ bankId: { $exists: false } });
  if (unassignedCount === 0) {
    console.log('No unassigned questions found. Nothing to migrate.');
    await mongoose.disconnect();
    return;
  }

  const owner = await EmailUser.findOne({ role: 'admin' }) || await EmailUser.findOne();
  if (!owner) {
    console.error('No user exists yet. Sign in once so an EmailUser is created, then run this script again.');
    process.exit(1);
  }

  let bank = await QuestionBank.findOne({ title: 'General' });
  if (!bank) {
    bank = await QuestionBank.create({
      title: 'General',
      description: 'Default bank created for questions that existed before question banks were introduced.',
      createdBy: owner._id,
    });
    console.log(`Created "General" bank (${bank._id}).`);
  } else {
    console.log(`Using existing "General" bank (${bank._id}).`);
  }

  const result = await Question.updateMany(
    { bankId: { $exists: false } },
    { $set: { bankId: bank._id } }
  );
  console.log(`Moved ${result.modifiedCount} question(s) into "General".`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
