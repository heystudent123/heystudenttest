/**
 * Fixes flattened "List I / List II" text inside published tests for questions
 * that no longer exist in the question bank (so the main repair could not reach them).
 *
 *   node scripts/repairOrphanSnapshots.js            dry run
 *   node scripts/repairOrphanSnapshots.js --apply    backs up, then writes
 *
 * Safety: only whitespace may differ between old and new text (checked), and a
 * snapshot row is only touched if it still holds the exact old text.
 */
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Question = require('../models/Question');
const MockTest = require('../models/MockTest');
const { reformat } = require('./repairListFormatting');

const APPLY = process.argv.includes('--apply');
const NL = '\n';
const squash = (text) => String(text).replace(/\s+/g, '');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const tests = await MockTest.find({ status: 'published' }).select('title publishedSnapshot').lean();

  const candidates = [];
  tests.forEach((test) => (test.publishedSnapshot || []).forEach((row) => {
    if (/List\s*I\b/i.test(row.question) && !row.question.includes(NL)) candidates.push({ testId: test._id, title: test.title, row });
  }));

  const ids = [...new Set(candidates.map((c) => String(c.row.questionId)))];
  const inBank = new Set((await Question.find({ _id: { $in: ids } }).select('_id').lean()).map((q) => String(q._id)));
  const orphans = candidates.filter((c) => !inBank.has(String(c.row.questionId)));

  const changes = [];
  const skipped = [];
  orphans.forEach((c) => {
    const result = reformat(c.row.question);
    if (result.skip || squash(result.text) !== squash(c.row.question)) skipped.push({ c, reason: result.skip || 'not whitespace-only' });
    else changes.push({ ...c, next: result.text });
  });

  console.log(`Flat List I copies in published tests: ${candidates.length}; of those not in the bank: ${orphans.length}`);
  console.log(`Safe to reformat: ${changes.length}; skipped: ${skipped.length}`);
  skipped.forEach((s) => console.log('  skipped:', s.reason, JSON.stringify(s.c.row.question.slice(0, 90))));
  if (changes[0]) console.log('\nSAMPLE AFTER:\n' + changes[0].next + '\n');

  if (!APPLY) {
    console.log('Dry run only. Nothing was written.');
    await mongoose.disconnect();
    return;
  }

  const backupDir = path.join(__dirname, 'backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const backupFile = path.join(backupDir, `orphan-snapshots-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(backupFile, JSON.stringify(changes.map((c) => ({ testId: String(c.testId), title: c.title, questionId: String(c.row.questionId), question: c.row.question })), null, 2));
  console.log(`Backup written: ${backupFile}`);

  const ops = changes.map((c) => ({
    updateOne: {
      filter: { _id: c.testId },
      update: { $set: { 'publishedSnapshot.$[e].question': c.next } },
      arrayFilters: [{ 'e.questionId': c.row.questionId, 'e.question': c.row.question }],
    },
  }));
  const result = await MockTest.bulkWrite(ops, { ordered: false });
  console.log(`Snapshot rows updated: ${result.modifiedCount}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
