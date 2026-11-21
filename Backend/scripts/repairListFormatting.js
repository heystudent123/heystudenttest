/**
 * One-time repair: restore line breaks in flattened "Match List I with List II"
 * questions that were imported before line breaks were preserved.
 *
 *   node scripts/repairListFormatting.js            dry run, writes nothing
 *   node scripts/repairListFormatting.js --apply    backs up, then writes
 *
 * Safety: only whitespace is changed (a space becomes a line break). Every
 * rewrite is re-hashed with the same contentHash the importer uses and is
 * skipped unless the hash is identical, so wording, options and the correct
 * answer cannot change. Anything that does not match a strict pattern is
 * skipped and listed.
 */
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Question = require('../models/Question');
const MockTest = require('../models/MockTest');
const { contentHash } = require('../utils/questionImport');

const APPLY = process.argv.includes('--apply');
const NL = '\n';

// Marker styles. Each regex puts the label in group 2 or 3. Labels are compared case-insensitively.
const STYLES = [
  { name: 'letters', re: /(^|\s)(?:\(([A-Fa-f])\)|([A-Fa-f])[.)])\s/g, labels: ['a', 'b', 'c', 'd', 'e', 'f'] },
  { name: 'roman', re: /(^|\s)(?:\((VI|IV|III|II|I|V|vi|iv|iii|ii|i|v)\)|(VI|IV|III|II|I|V|vi|iv|iii|ii|i|v)[.)])\s/g, labels: ['i', 'ii', 'iii', 'iv', 'v', 'vi'] },
  { name: 'digits', re: /(^|\s)(?:\((\d{1,2})\)|(\d{1,2})[.)])\s/g, labels: ['1', '2', '3', '4', '5', '6'] },
];

// Split a list body into items if its markers form a clean 1..n sequence.
function splitItems(body) {
  for (const style of STYLES) {
    const found = [];
    let m;
    style.re.lastIndex = 0;
    while ((m = style.re.exec(body)) !== null) {
      found.push({ label: String(m[2] || m[3]).toLowerCase(), start: m.index + m[1].length });
    }
    if (found.length < 2) continue;
    if (found[0].start !== 0) continue;
    if (!found.every((f, i) => f.label === style.labels[i])) continue;
    const items = found.map((f, i) => body.slice(f.start, i + 1 < found.length ? found[i + 1].start : body.length).trim());
    return { items, style: style.name };
  }
  return null;
}

// A heading is "List I" / "List II" (optional colon) that is directly followed by the first list marker.
const H1_RE = /\bList[\s-]*I(?!I)\s*:?\s*(?=\(?[A-Za-z0-9]{1,4}[.)])/gi;
const H2_RE = /\bList[\s-]*II\s*:?\s*(?=\(?[A-Za-z0-9]{1,4}[.)])/gi;

function lastMatchBefore(re, text, limit) {
  let last = null;
  let m;
  re.lastIndex = 0;
  while ((m = re.exec(text)) !== null) {
    if (limit !== undefined && m.index >= limit) break;
    last = m;
    if (m[0].length === 0) re.lastIndex += 1;
  }
  return last;
}

const PIPE_RE = /\bList[\s-]*I\s*\|\s*List[\s-]*II\s*:?\s*(?=\(?[A-Za-z0-9]{1,4}[.)])/gi;
const TRAILING_INSTRUCTION = /\b(choose|select (the|one)|correct (answer|option)|codes? given|which of the (following|options)|answer (the|is))\b/i;

// "... last item Choose the correct answer:" -> moves the instruction sentence out of the last item.
const PEEL_RE = /^([\s\S]*?)\s+((?:Choose|Select)\s+the\s+(?:correct|right|most appropriate|best)\b[\s\S]*)$/i;
function peelInstruction(items) {
  const m = PEEL_RE.exec(items[items.length - 1]);
  if (!m || m[2].length > 100 || !m[1].trim()) return '';
  items[items.length - 1] = m[1].trim();
  return m[2].trim();
}

function reformatPipeTable(text) {
  const mp = lastMatchBefore(PIPE_RE, text);
  if (!mp) return null;
  const intro = text.slice(0, mp.index).trim();
  const body = text.slice(mp.index + mp[0].length).trim();
  const list = splitItems(body);
  if (!list) return { skip: 'pipe table rows are not a clean A-B-C / 1-2 sequence' };
  if (!list.items.every((item) => item.includes('|'))) return { skip: 'pipe table row is missing its | divider' };
  const instruction = peelInstruction(list.items);
  const last = list.items[list.items.length - 1];
  if (TRAILING_INSTRUCTION.test(last)) return { skip: 'other text appears after the last row' };
  const out = [];
  if (intro) out.push(intro, '');
  out.push(mp[0].trim(), ...list.items);
  if (instruction) out.push('', instruction);
  return { text: out.join(NL), styles: ['pipe table', list.style], longLast: last.length > 140 };
}

function reformat(text) {
  if (text.includes(NL)) return { skip: 'already has line breaks' };
  const table = reformatPipeTable(text);
  if (table) return table;
  const m2 = lastMatchBefore(H2_RE, text);
  const m1 = m2 ? lastMatchBefore(H1_RE, text, m2.index) : null;
  if (!m1 || !m2) return { skip: 'could not find the "List I" / "List II" list headings' };

  const intro = text.slice(0, m1.index).trim();
  const body1 = text.slice(m1.index + m1[0].length, m2.index).trim();
  const body2 = text.slice(m2.index + m2[0].length).trim();
  const list1 = splitItems(body1);
  const list2 = splitItems(body2);
  if (!list1) return { skip: 'List I items are not a clean A-B-C / I-II / 1-2 sequence' };
  if (!list2) return { skip: 'List II items are not a clean A-B-C / I-II / 1-2 sequence' };

  const instruction = peelInstruction(list2.items);
  const last = list2.items[list2.items.length - 1];
  if (TRAILING_INSTRUCTION.test(last)) return { skip: 'other text appears after the last List II item' };
  const out = [];
  if (intro) out.push(intro, '');
  out.push(m1[0].trim(), ...list1.items, '', m2[0].trim(), ...list2.items);
  if (instruction) out.push('', instruction);
  return { text: out.join(NL), styles: [list1.style, list2.style], longLast: last.length > 110 };
}

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is missing.');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);

  const candidates = await Question.find({ question: /List\s*I\b/i }).lean();
  const changes = [];
  const skipped = {};
  const styleCount = {};

  for (const doc of candidates) {
    const result = reformat(doc.question);
    if (result.skip) {
      (skipped[result.skip] = skipped[result.skip] || []).push(doc);
      continue;
    }
    const options = [doc.optionA, doc.optionB, doc.optionC, doc.optionD];
    const sameHash = contentHash(result.text, options, doc.correctAnswer) === doc.contentHash;
    if (!sameHash) {
      (skipped['rewrite would change the content hash (not whitespace-only)'] = skipped['rewrite would change the content hash (not whitespace-only)'] || []).push(doc);
      continue;
    }
    result.styles.forEach((s) => { styleCount[s] = (styleCount[s] || 0) + 1; });
    changes.push({ _id: doc._id, old: doc.question, next: result.text, longLast: result.longLast });
  }

  console.log(`Candidates containing "List I": ${candidates.length}`);
  console.log(`Safe to reformat: ${changes.length}`);
  console.log('Marker styles used:', styleCount);
  const longLast = changes.filter((c) => c.longLast);
  console.log('Last List II item unusually long (may include trailing text):', longLast.length);
  longLast.slice(0, 3).forEach((c) => console.log('   e.g.', JSON.stringify(c.next.split(String.fromCharCode(10)).slice(-1)[0].slice(0, 160))));
  Object.entries(skipped).forEach(([reason, docs]) => {
    console.log(`Skipped (${docs.length}): ${reason}`);
    docs.slice(0, 2).forEach((d) => console.log('   e.g.', JSON.stringify(d.question.slice(0, 140))));
  });

  if (changes.length) {
    console.log('\n--- sample before/after ---');
    const peeled = changes.find((c) => /Choose the correct/i.test(c.next.split(NL).slice(-1)[0]));
    const parenPipe = changes.find((c) => c.next.includes(' | (') && c.next.includes('(A)'));
    [changes[0], peeled, parenPipe].filter(Boolean).forEach((c) => {
      console.log('BEFORE:', c.old);
      console.log('AFTER :');
      console.log(c.next);
      console.log('');
    });
  }

  if (!APPLY) {
    console.log('Dry run only. Nothing was written. Re-run with --apply to write.');
    await mongoose.disconnect();
    return;
  }

  const backupDir = path.join(__dirname, 'backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const backupFile = path.join(backupDir, `list-formatting-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(backupFile, JSON.stringify(changes.map((c) => ({ _id: String(c._id), question: c.old })), null, 2));
  console.log(`Backup of original text written: ${backupFile}`);

  // Only touch a question (and a published snapshot) if it still holds the exact old text.
  const questionOps = changes.map((c) => ({
    updateOne: { filter: { _id: c._id, question: c.old }, update: { $set: { question: c.next } } },
  }));
  const questionResult = await Question.bulkWrite(questionOps, { ordered: false });

  const testOps = changes.map((c) => ({
    updateMany: {
      filter: { 'publishedSnapshot.questionId': c._id },
      update: { $set: { 'publishedSnapshot.$[e].question': c.next } },
      arrayFilters: [{ 'e.questionId': c._id, 'e.question': c.old }],
    },
  }));
  const testsBefore = await MockTest.countDocuments({ 'publishedSnapshot.questionId': { $in: changes.map((c) => c._id) } });
  const testResult = await MockTest.bulkWrite(testOps, { ordered: false });

  console.log(`Questions updated: ${questionResult.modifiedCount}`);
  console.log(`Published tests holding these questions: ${testsBefore} (snapshot rows refreshed: ${testResult.modifiedCount})`);
  await mongoose.disconnect();
}

module.exports = { reformat };

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
