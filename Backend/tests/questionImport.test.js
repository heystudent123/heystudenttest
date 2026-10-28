const test = require('node:test');
const assert = require('node:assert/strict');
const XLSX = require('xlsx');
const {
  HEADERS,
  parseQuestionWorkbook,
  buildTemplateBuffer,
  contentHash,
  stemHash,
} = require('../utils/questionImport');
const { validateMockTest } = require('../utils/mockTestValidation');

function workbookBuffer(rows, { sheetName = 'Questions', extraSheet = false } = {}) {
  const workbook = XLSX.utils.book_new();
  if (extraSheet) {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['Ignore me']]), 'Notes');
  }
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), sheetName);
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

function validRow(overrides = []) {
  const row = ['Which gas do plants absorb?', 'Oxygen', 'Nitrogen', 'Carbon dioxide', 'Hydrogen', 'C', 'Biology', ''];
  overrides.forEach(([index, value]) => {
    row[index] = value;
  });
  return row;
}

test('template has the required headers and a valid example row', () => {
  const parsed = parseQuestionWorkbook(Buffer.from(buildTemplateBuffer()));
  assert.equal(parsed.fatal, null);
  assert.equal(parsed.valid.length, 1);
  assert.equal(parsed.valid[0].correctAnswer, 'A');
  assert.deepEqual(HEADERS, ['question', 'option_a', 'option_b', 'option_c', 'option_d', 'correct_answer', 'chapter', 'remarks']);
});

test('a valid workbook imports every complete row and skips empty rows', () => {
  const buffer = workbookBuffer([
    HEADERS,
    validRow(),
    ['', '', '', '', '', '', '', ''],
    ['2 + 2 equals?', '3', '4', '5', '6', 'b', 'Maths', 'Easy'],
  ], { extraSheet: true });
  const parsed = parseQuestionWorkbook(buffer);
  assert.equal(parsed.fatal, null);
  assert.equal(parsed.skippedEmpty, 1);
  assert.equal(parsed.valid.length, 2);
  assert.equal(parsed.invalid.length, 0);
  assert.equal(parsed.valid[1].correctAnswer, 'B');
  assert.equal(parsed.valid[1].remarks, 'Easy');
});

test('wrong headers are rejected', () => {
  const buffer = workbookBuffer([['Question', 'A', 'B', 'C', 'D', 'Answer'], ['Stem', '1', '2', '3', '4', 'A']]);
  const parsed = parseQuestionWorkbook(buffer);
  assert.match(parsed.fatal, /header row/i);
});

test('missing options and invalid answer letters are reported on the row', () => {
  const buffer = workbookBuffer([
    HEADERS,
    validRow([[2, ''], [5, 'Mumbai']]),
    validRow([[0, 'A second valid question?']]),
  ]);
  const parsed = parseQuestionWorkbook(buffer);
  assert.equal(parsed.valid.length, 1);
  assert.equal(parsed.invalid.length, 1);
  assert.match(parsed.invalid[0].errors.join(' '), /option_b/);
  assert.match(parsed.invalid[0].errors.join(' '), /correct_answer must be A, B, C, or D/);
});

test('duplicate rows in the file are rejected and exact bank matches are not imported again', () => {
  const row = validRow();
  const buffer = workbookBuffer([HEADERS, row, [...row]]);
  const first = parseQuestionWorkbook(buffer);
  assert.equal(first.valid.length, 1);
  assert.match(first.invalid[0].errors.join(' '), /Duplicate of spreadsheet row 2/);

  const again = parseQuestionWorkbook(buffer, {
    contentHashes: new Set([first.valid[0].contentHash]),
    stemHashes: new Set(),
  });
  assert.equal(again.valid.length, 0);
  assert.match(again.invalid.map((rowItem) => rowItem.errors.join(' ')).join(' '), /already in the question bank/);
});

test('a conflicting answer already in the bank is rejected', () => {
  const row = validRow();
  const options = [row[1], row[2], row[3], row[4]];
  const buffer = workbookBuffer([HEADERS, row]);
  const parsed = parseQuestionWorkbook(buffer, {
    contentHashes: new Set(),
    stemHashes: new Set([stemHash(row[0], options)]),
  });
  assert.equal(parsed.valid.length, 0);
  assert.match(parsed.invalid[0].errors.join(' '), /different correct answer/);
});

test('content hash changes when the correct letter changes', () => {
  const options = ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Hydrogen'];
  assert.notEqual(
    contentHash('Which gas do plants absorb?', options, 'C'),
    contentHash('Which gas do plants absorb?', options, 'A')
  );
});

test('non-spreadsheet bytes are rejected', () => {
  const parsed = parseQuestionWorkbook(Buffer.from('not an excel file'));
  assert.match(parsed.fatal, /not an Excel workbook/);
});

test('publishing requires questions, instructions, and a paid price', () => {
  const id = '64b7f3a2c1d4e5f678901234';
  const missing = validateMockTest({
    title: 'English PYQ',
    durationMinutes: 60,
    positiveMarks: 5,
    negativeMarks: 1,
    questionIds: [],
    instructions: '',
    isFree: false,
    price: 0,
  }, { publishing: true });
  assert.ok(missing.errors.some((error) => /at least one question/i.test(error)));
  assert.ok(missing.errors.some((error) => /instructions/i.test(error)));
  assert.ok(missing.errors.some((error) => /price/i.test(error)));

  const ready = validateMockTest({
    title: 'English PYQ',
    durationMinutes: 60,
    positiveMarks: 5,
    negativeMarks: 1,
    questionIds: [id, id],
    instructions: 'Read each passage carefully.',
    isFree: true,
  }, { publishing: true });
  assert.deepEqual(ready.errors, []);
  assert.equal(ready.value.questionIds.length, 1);
  assert.equal(ready.value.maxMarks, 5);
  assert.equal(ready.value.price, 0);
});

test('duration and marks outside the allowed range are rejected', () => {
  const result = validateMockTest({
    title: '',
    durationMinutes: 0,
    positiveMarks: -1,
    negativeMarks: 200,
    questionIds: ['not-an-id'],
  });
  assert.ok(result.errors.length >= 4);
});
