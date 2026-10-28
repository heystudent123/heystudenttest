const { sanitizeStr, isObjectId } = require('../middleware/validate');

const LIMITS = {
  title: 200,
  description: 2000,
  instructions: 5000,
  category: 100,
  chapter: 200,
  questions: 300,
  durationMin: 1,
  durationMax: 300,
  marksMax: 100,
};

function asBoolean(value, fallback) {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

function asNumber(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
}

function parseDate(value) {
  if (value === '' || value === null || value === undefined) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'invalid' : date;
}

/**
 * Validate a mock-test draft. Question existence is checked by the controller.
 */
function validateMockTest(body, { publishing = false } = {}) {
  const errors = [];
  const title = sanitizeStr(body.title || '').slice(0, LIMITS.title);
  const description = sanitizeStr(body.description || '').slice(0, LIMITS.description);
  const instructions = sanitizeStr(body.instructions || '').slice(0, LIMITS.instructions);
  const category = sanitizeStr(body.category || 'General').slice(0, LIMITS.category) || 'General';
  const chapter = sanitizeStr(body.chapter || '').slice(0, LIMITS.chapter);

  if (!title) errors.push('Title is required.');

  const durationMinutes = asNumber(body.durationMinutes);
  if (!Number.isInteger(durationMinutes) || durationMinutes < LIMITS.durationMin || durationMinutes > LIMITS.durationMax) {
    errors.push(`Duration must be a whole number of minutes from ${LIMITS.durationMin} to ${LIMITS.durationMax}.`);
  }

  const positiveMarks = asNumber(body.positiveMarks ?? 1);
  const negativeMarks = asNumber(body.negativeMarks ?? 0);
  if (!Number.isFinite(positiveMarks) || positiveMarks < 0 || positiveMarks > LIMITS.marksMax) {
    errors.push('Positive marks must be a number from 0 to 100.');
  }
  if (!Number.isFinite(negativeMarks) || negativeMarks < 0 || negativeMarks > LIMITS.marksMax) {
    errors.push('Negative marks must be a number from 0 to 100.');
  }

  const attemptLimit = asNumber(body.attemptLimit ?? 1);
  if (!Number.isInteger(attemptLimit) || attemptLimit < 0 || attemptLimit > 20) {
    errors.push('Attempt limit must be a whole number from 0 (unlimited) to 20.');
  }

  const rawIds = Array.isArray(body.questionIds) ? body.questionIds : [];
  const questionIds = [];
  const seen = new Set();
  rawIds.forEach((id) => {
    const value = String(id);
    if (!isObjectId(value)) {
      errors.push('One or more selected questions are invalid.');
      return;
    }
    if (!seen.has(value)) {
      seen.add(value);
      questionIds.push(value);
    }
  });
  if (questionIds.length > LIMITS.questions) {
    errors.push(`A test can include at most ${LIMITS.questions} questions.`);
  }
  if (publishing && questionIds.length === 0) {
    errors.push('Add at least one question before publishing.');
  }
  if (publishing && !instructions) {
    errors.push('Instructions are required before publishing.');
  }

  const isFree = asBoolean(body.isFree, true);
  const price = asNumber(body.price ?? 0);
  if (!Number.isFinite(price) || price < 0 || price > 100000) {
    errors.push('Price must be a number from 0 to 100000.');
  }
  if (!isFree && publishing && (!Number.isFinite(price) || price <= 0)) {
    errors.push('A paid test needs a price greater than 0.');
  }

  const courseId = body.courseId ? String(body.courseId) : '';
  if (courseId && !isObjectId(courseId)) {
    errors.push('The linked course id is invalid.');
  }

  const questionBankId = body.questionBankId ? String(body.questionBankId) : '';
  if (questionBankId && !isObjectId(questionBankId)) {
    errors.push('The linked question bank is invalid.');
  }

  const availableFrom = parseDate(body.availableFrom);
  const availableUntil = parseDate(body.availableUntil);
  if (availableFrom === 'invalid' || availableUntil === 'invalid') {
    errors.push('Availability dates must be valid dates.');
  }
  if (availableFrom && availableUntil && availableFrom !== 'invalid' && availableUntil !== 'invalid' && availableFrom >= availableUntil) {
    errors.push('The end date must be after the start date.');
  }

  const maxMarks = questionIds.length * (Number.isFinite(positiveMarks) ? positiveMarks : 0);

  return {
    errors: [...new Set(errors)],
    value: {
      title,
      description,
      instructions,
      category,
      chapter,
      durationMinutes: Number.isInteger(durationMinutes) ? durationMinutes : undefined,
      positiveMarks: Number.isFinite(positiveMarks) ? positiveMarks : undefined,
      negativeMarks: Number.isFinite(negativeMarks) ? negativeMarks : undefined,
      attemptLimit: Number.isInteger(attemptLimit) ? attemptLimit : undefined,
      questionIds,
      questionBankId: questionBankId || null,
      isFree,
      price: isFree ? 0 : (Number.isFinite(price) ? price : 0),
      courseId: courseId || null,
      availableFrom: availableFrom && availableFrom !== 'invalid' ? availableFrom : null,
      availableUntil: availableUntil && availableUntil !== 'invalid' ? availableUntil : null,
      // Every test shuffles question order and option order for every attempt — not admin-configurable.
      shuffleQuestions: true,
      shuffleOptions: true,
      maxMarks,
    },
  };
}

module.exports = { validateMockTest, LIMITS };
