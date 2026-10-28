const Question = require('../models/Question');
const QuestionBank = require('../models/QuestionBank');
const QuestionImport = require('../models/QuestionImport');
const MockTest = require('../models/MockTest');
const ErrorResponse = require('../utils/errorResponse');
const { sanitizeStr, isObjectId } = require('../middleware/validate');
const {
  parseQuestionWorkbook,
  buildTemplateBuffer,
  buildErrorReportBuffer,
  contentHash,
  stemHash,
} = require('../utils/questionImport');

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function sendWorkbook(res, buffer, filename) {
  res.setHeader('Content-Type', XLSX_TYPE);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-store');
  res.send(Buffer.from(buffer));
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── Question Banks ──────────────────────────────────────────────────────

exports.listBanks = async (req, res, next) => {
  try {
    const banks = await QuestionBank.find().sort({ createdAt: -1 }).lean();
    const counts = await Question.aggregate([
      { $group: { _id: '$bankId', count: { $sum: 1 } } },
    ]);
    const countByBank = new Map(counts.map((row) => [String(row._id), row.count]));
    res.status(200).json({
      success: true,
      data: banks.map((bank) => ({ ...bank, questionCount: countByBank.get(String(bank._id)) || 0 })),
    });
  } catch (err) {
    next(err);
  }
};

exports.createBank = async (req, res, next) => {
  try {
    const title = sanitizeStr(req.body.title || '').slice(0, 200);
    const description = sanitizeStr(req.body.description || '').slice(0, 1000);
    if (!title) return next(new ErrorResponse('Bank title is required.', 400));
    const bank = await QuestionBank.create({ title, description, createdBy: req.user._id });
    res.status(201).json({ success: true, data: { ...bank.toObject(), questionCount: 0 } });
  } catch (err) {
    next(err);
  }
};

exports.updateBank = async (req, res, next) => {
  try {
    if (!isObjectId(req.params.id)) return next(new ErrorResponse('Bank not found.', 404));
    const title = sanitizeStr(req.body.title || '').slice(0, 200);
    const description = sanitizeStr(req.body.description || '').slice(0, 1000);
    if (!title) return next(new ErrorResponse('Bank title is required.', 400));
    const bank = await QuestionBank.findByIdAndUpdate(
      req.params.id,
      { $set: { title, description } },
      { new: true, runValidators: true }
    );
    if (!bank) return next(new ErrorResponse('Bank not found.', 404));
    res.status(200).json({ success: true, data: bank });
  } catch (err) {
    next(err);
  }
};

exports.deleteBank = async (req, res, next) => {
  try {
    if (!isObjectId(req.params.id)) return next(new ErrorResponse('Bank not found.', 404));
    const questionCount = await Question.countDocuments({ bankId: req.params.id });
    if (questionCount > 0) {
      return next(new ErrorResponse('Delete or move every question out of this bank before deleting it.', 409));
    }
    const bank = await QuestionBank.findByIdAndDelete(req.params.id);
    if (!bank) return next(new ErrorResponse('Bank not found.', 404));
    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    next(err);
  }
};

exports.downloadTemplate = (req, res) => {
  sendWorkbook(res, buildTemplateBuffer(), 'heystudents-question-template.xlsx');
};

exports.previewImport = async (req, res, next) => {
  try {
    if (!req.file || !req.file.buffer) {
      return next(new ErrorResponse('Choose an .xlsx file to upload.', 400));
    }
    const bankId = String(req.body.bankId || '');
    if (!isObjectId(bankId)) return next(new ErrorResponse('Choose a question bank to import into.', 400));
    const bank = await QuestionBank.findById(bankId).select('_id');
    if (!bank) return next(new ErrorResponse('Question bank not found.', 404));

    const preliminary = parseQuestionWorkbook(req.file.buffer);
    if (preliminary.fatal) {
      return next(new ErrorResponse(preliminary.fatal, 400));
    }

    const hashes = preliminary.valid.map((row) => row.contentHash);
    const stems = preliminary.valid.map((row) => row.stemHash);
    const [exactMatches, stemMatches] = await Promise.all([
      hashes.length ? Question.find({ contentHash: { $in: hashes } }).select('contentHash').lean() : [],
      stems.length ? Question.find({ stemHash: { $in: stems } }).select('stemHash').lean() : [],
    ]);

    const reviewed = parseQuestionWorkbook(req.file.buffer, {
      contentHashes: new Set(exactMatches.map((item) => item.contentHash)),
      stemHashes: new Set(stemMatches.map((item) => item.stemHash)),
    });
    if (reviewed.fatal) {
      return next(new ErrorResponse(reviewed.fatal, 400));
    }

    const record = await QuestionImport.create({
      bankId,
      createdBy: req.user._id,
      fileName: sanitizeStr(req.file.originalname || '').slice(0, 200),
      validRows: reviewed.valid,
      invalidRows: reviewed.invalid,
      skippedEmpty: reviewed.skippedEmpty,
      result: { inserted: 0, skippedDuplicates: reviewed.invalid.length, rejected: reviewed.invalid.length },
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    res.status(200).json({
      success: true,
      data: {
        importId: record._id,
        fileName: record.fileName,
        validCount: reviewed.valid.length,
        invalidCount: reviewed.invalid.length,
        skippedEmpty: reviewed.skippedEmpty,
        valid: reviewed.valid,
        invalid: reviewed.invalid,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.approveImport = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) {
      return next(new ErrorResponse('Import not found.', 404));
    }

    const claimed = await QuestionImport.findOneAndUpdate(
      { _id: id, status: 'pending' },
      { $set: { status: 'importing', approvedBy: req.user._id } },
      { new: true }
    );

    if (!claimed) {
      const existing = await QuestionImport.findById(id);
      if (!existing) return next(new ErrorResponse('Import not found.', 404));
      if (existing.status === 'imported') {
        return res.status(200).json({
          success: true,
          data: { ...existing.result, alreadyImported: true, rejected: existing.invalidRows.length },
        });
      }
      const stale = existing.status === 'importing'
        && Date.now() - new Date(existing.updatedAt).getTime() > 2 * 60 * 1000;
      if (stale) {
        existing.status = 'pending';
        await existing.save();
        return next(new ErrorResponse('The previous save was interrupted. Approve the import again.', 409));
      }
      return next(new ErrorResponse('This import is already being saved. Retry in a moment.', 409));
    }

    if (!claimed.validRows.length) {
      claimed.status = 'pending';
      claimed.approvedBy = undefined;
      await claimed.save();
      return next(new ErrorResponse('No valid questions to import. Fix the spreadsheet and upload it again.', 400));
    }

    const docs = claimed.validRows.map((row) => ({
      bankId: claimed.bankId,
      question: row.question,
      optionA: row.optionA,
      optionB: row.optionB,
      optionC: row.optionC,
      optionD: row.optionD,
      correctAnswer: row.correctAnswer,
      chapter: row.chapter || '',
      remarks: row.remarks || '',
      contentHash: row.contentHash,
      stemHash: row.stemHash,
      createdBy: req.user._id,
    }));

    const hashes = docs.map((doc) => doc.contentHash);
    const before = await Question.countDocuments({ contentHash: { $in: hashes } });
    try {
      await Question.insertMany(docs, { ordered: false });
    } catch (err) {
      const duplicate = err.code === 11000 || err.name === 'MongoBulkWriteError' || err.name === 'BulkWriteError';
      if (!duplicate) {
        claimed.status = 'pending';
        await claimed.save();
        return next(err);
      }
    }
    const after = await Question.countDocuments({ contentHash: { $in: hashes } });
    const inserted = Math.max(0, after - before);
    const skippedDuplicates = docs.length - inserted;

    claimed.status = 'imported';
    claimed.expiresAt = undefined;
    claimed.result = {
      inserted,
      skippedDuplicates,
      rejected: claimed.invalidRows.length,
    };
    await claimed.save();

    res.status(201).json({
      success: true,
      data: {
        inserted,
        skippedDuplicates,
        rejected: claimed.invalidRows.length,
        alreadyImported: false,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.downloadErrorReport = async (req, res, next) => {
  try {
    if (!isObjectId(req.params.id)) {
      return next(new ErrorResponse('Import not found.', 404));
    }
    const record = await QuestionImport.findById(req.params.id).lean();
    if (!record) return next(new ErrorResponse('Import not found.', 404));
    if (!record.invalidRows.length) {
      return next(new ErrorResponse('This import has no rejected rows.', 404));
    }
    sendWorkbook(res, buildErrorReportBuffer(record.invalidRows), 'question-import-errors.xlsx');
  } catch (err) {
    next(err);
  }
};

exports.listQuestions = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const bankId = String(req.query.bankId || '');
    const filter = {};
    if (bankId) {
      if (!isObjectId(bankId)) return next(new ErrorResponse('Invalid question bank.', 400));
      filter.bankId = bankId;
    }
    const q = sanitizeStr(req.query.q || '');
    if (q) filter.question = { $regex: escapeRegex(q), $options: 'i' };

    const [total, questions] = await Promise.all([
      Question.countDocuments(filter),
      Question.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    res.status(200).json({
      success: true,
      count: questions.length,
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
      data: questions,
    });
  } catch (err) {
    next(err);
  }
};

exports.listChapters = async (req, res, next) => {
  try {
    const chapters = await Question.distinct('chapter', { chapter: { $nin: ['', null] } });
    chapters.sort((a, b) => a.localeCompare(b));
    res.status(200).json({ success: true, data: chapters });
  } catch (err) {
    next(err);
  }
};

exports.getQuestion = async (req, res, next) => {
  try {
    if (!isObjectId(req.params.id)) return next(new ErrorResponse('Question not found.', 404));
    const question = await Question.findById(req.params.id).lean();
    if (!question) return next(new ErrorResponse('Question not found.', 404));
    res.status(200).json({ success: true, data: question });
  } catch (err) {
    next(err);
  }
};

exports.createQuestion = async (req, res, next) => {
  try {
    const bankId = String(req.body.bankId || '');
    if (!isObjectId(bankId)) return next(new ErrorResponse('Choose a question bank.', 400));
    const bank = await QuestionBank.findById(bankId).select('_id');
    if (!bank) return next(new ErrorResponse('Question bank not found.', 404));

    const question = sanitizeStr(req.body.question || '').slice(0, 4000);
    const optionA = sanitizeStr(req.body.optionA || '').slice(0, 1000);
    const optionB = sanitizeStr(req.body.optionB || '').slice(0, 1000);
    const optionC = sanitizeStr(req.body.optionC || '').slice(0, 1000);
    const optionD = sanitizeStr(req.body.optionD || '').slice(0, 1000);
    const correctAnswer = String(req.body.correctAnswer || '').trim().toUpperCase();
    const chapter = sanitizeStr(req.body.chapter || '').slice(0, 200);
    const remarks = sanitizeStr(req.body.remarks || '').slice(0, 2000);
    const errors = [];
    if (!question) errors.push('Question text is required.');
    if (!optionA || !optionB || !optionC || !optionD) errors.push('All four options are required.');
    if (!['A', 'B', 'C', 'D'].includes(correctAnswer)) errors.push('Correct answer must be A, B, C, or D.');
    if (errors.length) return next(new ErrorResponse(errors.join(' '), 400));

    const options = [optionA, optionB, optionC, optionD];
    const nextContent = contentHash(question, options, correctAnswer);
    const nextStem = stemHash(question, options);
    const clash = await Question.findOne({ $or: [{ contentHash: nextContent }, { stemHash: nextStem }] }).select('_id');
    if (clash) {
      return next(new ErrorResponse('A question with this text and options already exists.', 409));
    }

    const created = await Question.create({
      bankId,
      question,
      optionA,
      optionB,
      optionC,
      optionD,
      correctAnswer,
      chapter,
      remarks,
      contentHash: nextContent,
      stemHash: nextStem,
      createdBy: req.user._id,
    });
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    next(err);
  }
};

exports.updateQuestion = async (req, res, next) => {
  try {
    if (!isObjectId(req.params.id)) return next(new ErrorResponse('Question not found.', 404));
    const question = await Question.findById(req.params.id);
    if (!question) return next(new ErrorResponse('Question not found.', 404));

    const nextQuestion = sanitizeStr(req.body.question ?? question.question).slice(0, 4000);
    const optionA = sanitizeStr(req.body.optionA ?? question.optionA).slice(0, 1000);
    const optionB = sanitizeStr(req.body.optionB ?? question.optionB).slice(0, 1000);
    const optionC = sanitizeStr(req.body.optionC ?? question.optionC).slice(0, 1000);
    const optionD = sanitizeStr(req.body.optionD ?? question.optionD).slice(0, 1000);
    const correctAnswer = String(req.body.correctAnswer ?? question.correctAnswer).trim().toUpperCase();
    const chapter = sanitizeStr(req.body.chapter ?? question.chapter).slice(0, 200);
    const remarks = sanitizeStr(req.body.remarks ?? question.remarks).slice(0, 2000);
    const errors = [];
    if (!nextQuestion) errors.push('Question text is required.');
    if (!optionA || !optionB || !optionC || !optionD) errors.push('All four options are required.');
    if (!['A', 'B', 'C', 'D'].includes(correctAnswer)) errors.push('correct answer must be A, B, C, or D.');
    if (errors.length) return next(new ErrorResponse(errors.join(' '), 400));

    const options = [optionA, optionB, optionC, optionD];
    const nextContent = contentHash(nextQuestion, options, correctAnswer);
    const nextStem = stemHash(nextQuestion, options);
    const clash = await Question.findOne({
      _id: { $ne: question._id },
      $or: [{ contentHash: nextContent }, { stemHash: nextStem }],
    }).select('_id');
    if (clash) {
      return next(new ErrorResponse('Another question already uses this text and options.', 409));
    }

    question.question = nextQuestion;
    question.optionA = optionA;
    question.optionB = optionB;
    question.optionC = optionC;
    question.optionD = optionD;
    question.correctAnswer = correctAnswer;
    question.chapter = chapter;
    question.remarks = remarks;
    question.contentHash = nextContent;
    question.stemHash = nextStem;
    await question.save();

    res.status(200).json({ success: true, data: question });
  } catch (err) {
    next(err);
  }
};

exports.bulkDeleteQuestions = async (req, res, next) => {
  try {
    const ids = Array.isArray(req.body.ids) ? [...new Set(req.body.ids.map(String))] : [];
    const validIds = ids.filter((id) => isObjectId(id));
    if (!validIds.length) return next(new ErrorResponse('Select at least one question to delete.', 400));

    const inUse = await MockTest.find({
      $or: [
        { questionIds: { $in: validIds } },
        { 'publishedSnapshot.questionId': { $in: validIds } },
      ],
    }).select('questionIds publishedSnapshot.questionId').lean();

    const blockedIds = new Set();
    inUse.forEach((test) => {
      (test.questionIds || []).forEach((id) => blockedIds.add(String(id)));
      (test.publishedSnapshot || []).forEach((q) => blockedIds.add(String(q.questionId)));
    });

    const deletableIds = validIds.filter((id) => !blockedIds.has(id));
    const skippedIds = validIds.filter((id) => blockedIds.has(id));

    const result = deletableIds.length
      ? await Question.deleteMany({ _id: { $in: deletableIds } })
      : { deletedCount: 0 };

    res.status(200).json({
      success: true,
      data: {
        deletedCount: result.deletedCount,
        skippedCount: skippedIds.length,
        skippedIds,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.deleteQuestion = async (req, res, next) => {
  try {
    if (!isObjectId(req.params.id)) return next(new ErrorResponse('Question not found.', 404));
    const inUse = await MockTest.exists({
      $or: [
        { questionIds: req.params.id },
        { 'publishedSnapshot.questionId': req.params.id },
      ],
    });
    if (inUse) {
      return next(new ErrorResponse('This question is used by a mock test. Remove it from that test before deleting it.', 409));
    }
    const question = await Question.findByIdAndDelete(req.params.id);
    if (!question) return next(new ErrorResponse('Question not found.', 404));
    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    next(err);
  }
};
