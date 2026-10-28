const crypto = require('crypto');
const XLSX = require('xlsx');
const { sanitizeStr } = require('../middleware/validate');

const HEADERS = [
  'question',
  'option_a',
  'option_b',
  'option_c',
  'option_d',
  'correct_answer',
  'chapter',
  'remarks',
];

const MAX_DATA_ROWS = 500;
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_QUESTION_LEN = 4000;
const MAX_OPTION_LEN = 1000;
const MAX_CHAPTER_LEN = 200;
const MAX_REMARKS_LEN = 2000;

const EXAMPLE_ROW = [
  'What is the capital of India?',
  'New Delhi',
  'Mumbai',
  'Kolkata',
  'Chennai',
  'A',
  'Geography',
  'Example row. Delete this row before importing real questions.',
];

function normalize(value) {
  return String(value ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanText(value, maxLen) {
  const sanitized = sanitizeStr(normalize(value));
  return String(sanitized || '').slice(0, maxLen);
}

function stemHash(question, options) {
  const payload = [normalize(question).toLowerCase(), ...options.map((option) => normalize(option).toLowerCase())].join('\n');
  return crypto.createHash('sha256').update(payload).digest('hex');
}

function contentHash(question, options, correctAnswer) {
  const payload = `${stemHash(question, options)}|${correctAnswer}`;
  return crypto.createHash('sha256').update(payload).digest('hex');
}

function isXlsxBuffer(buffer) {
  return Buffer.isBuffer(buffer)
    && buffer.length >= 4
    && buffer[0] === 0x50
    && buffer[1] === 0x4b
    && buffer[2] === 0x03
    && buffer[3] === 0x04;
}

function headersMatch(row) {
  if (!Array.isArray(row)) return false;
  const cells = row.slice(0, HEADERS.length).map((cell) => normalize(cell).toLowerCase());
  return HEADERS.every((header, index) => cells[index] === header);
}

function sheetToRows(sheet) {
  return XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    raw: false,
    blankrows: true,
  });
}

function readWorkbook(buffer) {
  return XLSX.read(buffer, {
    type: 'buffer',
    cellFormula: false,
    cellHTML: false,
    cellNF: false,
    cellStyles: false,
    sheetRows: MAX_DATA_ROWS + 5,
    bookVBA: false,
  });
}

function findQuestionRows(workbook) {
  for (const name of workbook.SheetNames) {
    const rows = sheetToRows(workbook.Sheets[name]);
    if (headersMatch(rows[0])) {
      return { sheetName: name, rows };
    }
  }
  return null;
}

function isEmptyRow(row) {
  return HEADERS.every((_, index) => normalize(row[index]) === '');
}

/**
 * Parse and validate an Excel buffer.
 * existingStemHashes: Set of stemHash already stored in the question bank.
 * existingContentHashes: Set of exact contentHash already stored.
 */
function parseQuestionWorkbook(buffer, existing = {}) {
  const existingStem = existing.stemHashes || new Set();
  const existingContent = existing.contentHashes || new Set();

  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return { fatal: 'Upload an .xlsx file. The file is empty.' };
  }
  if (buffer.length > MAX_FILE_BYTES) {
    return { fatal: 'File exceeds the 2 MB limit.' };
  }
  if (!isXlsxBuffer(buffer)) {
    return { fatal: 'Upload a real .xlsx spreadsheet. The file contents are not an Excel workbook.' };
  }

  let workbook;
  try {
    workbook = readWorkbook(buffer);
  } catch {
    return { fatal: 'The spreadsheet could not be read. Export it again as .xlsx and retry.' };
  }

  const found = findQuestionRows(workbook);
  if (!found) {
    return {
      fatal: `The workbook needs a header row with these columns, in order: ${HEADERS.join(', ')}.`,
    };
  }

  const dataRows = found.rows.slice(1);
  if (dataRows.length > MAX_DATA_ROWS) {
    return { fatal: `A single import can contain at most ${MAX_DATA_ROWS} questions.` };
  }

  const valid = [];
  const invalid = [];
  const seenContent = new Map();
  const seenStem = new Map();
  let skippedEmpty = 0;

  dataRows.forEach((row, index) => {
    const rowNumber = index + 2;
    if (isEmptyRow(row)) {
      skippedEmpty += 1;
      return;
    }

    const question = cleanText(row[0], MAX_QUESTION_LEN);
    const optionA = cleanText(row[1], MAX_OPTION_LEN);
    const optionB = cleanText(row[2], MAX_OPTION_LEN);
    const optionC = cleanText(row[3], MAX_OPTION_LEN);
    const optionD = cleanText(row[4], MAX_OPTION_LEN);
    const correctRaw = normalize(row[5]).toUpperCase();
    const chapter = cleanText(row[6], MAX_CHAPTER_LEN);
    const remarks = cleanText(row[7], MAX_REMARKS_LEN);
    const errors = [];

    if (!question) errors.push('Question text is required.');
    if (!optionA) errors.push('option_a is required.');
    if (!optionB) errors.push('option_b is required.');
    if (!optionC) errors.push('option_c is required.');
    if (!optionD) errors.push('option_d is required.');
    if (!['A', 'B', 'C', 'D'].includes(correctRaw)) {
      errors.push('correct_answer must be A, B, C, or D. It is the option letter, not the option text.');
    }

    const options = [optionA, optionB, optionC, optionD];
    const stem = question ? stemHash(question, options) : '';
    const hash = question && ['A', 'B', 'C', 'D'].includes(correctRaw)
      ? contentHash(question, options, correctRaw)
      : '';

    if (hash && seenContent.has(hash)) {
      errors.push(`Duplicate of spreadsheet row ${seenContent.get(hash)}.`);
    }
    if (stem && seenStem.has(stem) && !seenContent.has(hash)) {
      errors.push(`Same question and options as row ${seenStem.get(stem)}, with a different correct answer. Keep one row.`);
    }
    if (hash && existingContent.has(hash)) {
      errors.push('This exact question is already in the question bank and will not be imported again.');
    } else if (stem && existingStem.has(stem)) {
      errors.push('The question bank already has this question with a different correct answer. Edit that question instead of importing a second copy.');
    }

    const preview = {
      rowNumber,
      question,
      optionA,
      optionB,
      optionC,
      optionD,
      correctAnswer: ['A', 'B', 'C', 'D'].includes(correctRaw) ? correctRaw : correctRaw,
      chapter,
      remarks,
    };

    if (errors.length) {
      invalid.push({ ...preview, errors });
      return;
    }

    seenContent.set(hash, rowNumber);
    seenStem.set(stem, rowNumber);
    valid.push({
      ...preview,
      contentHash: hash,
      stemHash: stem,
    });
  });

  return {
    fatal: null,
    sheetName: found.sheetName,
    skippedEmpty,
    valid,
    invalid,
  };
}

function buildTemplateBuffer() {
  const instructions = [
    ['Hey Students question import'],
    [''],
    ['Fill in the Questions sheet. Do not rename the column headers or change their order.'],
    ['Each row is one multiple-choice question. correct_answer must be A, B, C, or D.'],
    ['Delete the example row before you upload real questions.'],
    ['chapter and remarks are optional. remarks are visible to admins only.'],
    [`Maximum ${MAX_DATA_ROWS} questions and 2 MB per file.`],
    ['Question text is stored as plain text. Do not put HTML in the cells.'],
  ];
  const questions = [HEADERS, EXAMPLE_ROW];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(instructions), 'Instructions');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(questions), 'Questions');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

function buildErrorReportBuffer(invalidRows) {
  const header = ['row', 'errors', ...HEADERS];
  const body = invalidRows.map((row) => [
    row.rowNumber,
    (row.errors || []).join(' '),
    row.question,
    row.optionA,
    row.optionB,
    row.optionC,
    row.optionD,
    row.correctAnswer,
    row.chapter,
    row.remarks,
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([header, ...body]), 'Errors');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

module.exports = {
  HEADERS,
  MAX_DATA_ROWS,
  MAX_FILE_BYTES,
  EXAMPLE_ROW,
  stemHash,
  contentHash,
  parseQuestionWorkbook,
  buildTemplateBuffer,
  buildErrorReportBuffer,
};
