function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 80);
}

function subjectLabel(test) {
  const chapter = String(test.chapter || '').trim();
  if (chapter) return chapter;
  const category = String(test.category || '').trim();
  return category || 'General';
}

function availabilityClauses(now) {
  return [
    { $or: [{ availableFrom: null }, { availableFrom: { $lte: now } }] },
    { $or: [{ availableUntil: null }, { availableUntil: { $gte: now } }] },
  ];
}

function subjectClause(subject) {
  const exact = new RegExp(`^${escapeRegex(subject.trim())}$`, 'i');
  return {
    $or: [
      { chapter: exact },
      {
        $and: [
          { $or: [{ chapter: '' }, { chapter: null }, { chapter: { $exists: false } }] },
          { category: exact },
        ],
      },
    ],
  };
}

function toCatalogCard(test, access = {}) {
  const isFree = Boolean(test.isFree);
  return {
    _id: test._id,
    title: test.title,
    description: test.description || '',
    subject: subjectLabel(test),
    durationMinutes: test.durationMinutes,
    maxMarks: test.maxMarks,
    questionCount: typeof test.questionCount === 'number'
      ? test.questionCount
      : (Array.isArray(test.publishedSnapshot) ? test.publishedSnapshot.length : 0),
    isFree,
    price: isFree ? 0 : Number(test.price) || 0,
    attemptLimit: test.attemptLimit,
    hasAccess: Boolean(access.hasAccess),
    attemptsUsed: access.attemptsUsed || 0,
    inProgressAttemptId: access.inProgressAttemptId || null,
    offers: access.offers || [],
  };
}

module.exports = {
  escapeRegex,
  subjectLabel,
  availabilityClauses,
  subjectClause,
  toCatalogCard,
};
