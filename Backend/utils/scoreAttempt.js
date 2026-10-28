function round2(value) {
  return Math.round(value * 100) / 100;
}

/**
 * Score a finished attempt from the frozen question snapshot and saved responses.
 * Unanswered questions score 0. Accuracy is correct answers divided by attempted questions.
 */
function scoreAttempt({ questions, responses, positiveMarks, negativeMarks, startedAt, submittedAt }) {
  const byOrder = new Map((responses || []).map((response) => [response.order, response]));
  let correct = 0;
  let incorrect = 0;
  let unanswered = 0;
  let score = 0;

  const review = questions.map((question) => {
    const response = byOrder.get(question.order);
    const selected = response && ['A', 'B', 'C', 'D'].includes(response.selected) ? response.selected : null;
    let outcome = 'unanswered';
    let marksAwarded = 0;

    if (!selected) {
      unanswered += 1;
    } else if (selected === question.correctAnswer) {
      outcome = 'correct';
      marksAwarded = positiveMarks;
      correct += 1;
      score += positiveMarks;
    } else {
      outcome = 'incorrect';
      marksAwarded = -negativeMarks;
      incorrect += 1;
      score -= negativeMarks;
    }

    return {
      order: question.order,
      question: question.question,
      optionA: question.optionA,
      optionB: question.optionB,
      optionC: question.optionC,
      optionD: question.optionD,
      chapter: question.chapter || '',
      selected,
      correctAnswer: question.correctAnswer,
      outcome,
      marksAwarded,
    };
  });

  const attempted = correct + incorrect;
  const totalQuestions = questions.length;
  const maxMarks = totalQuestions * positiveMarks;
  const started = new Date(startedAt).getTime();
  const submitted = new Date(submittedAt).getTime();
  const timeTakenSeconds = Number.isFinite(started) && Number.isFinite(submitted)
    ? Math.max(0, Math.round((submitted - started) / 1000))
    : 0;

  return {
    totalQuestions,
    attempted,
    correct,
    incorrect,
    unanswered,
    score: round2(score),
    maxMarks: round2(maxMarks),
    percentage: maxMarks === 0 ? 0 : round2((score / maxMarks) * 100),
    accuracy: attempted === 0 ? 0 : round2((correct / attempted) * 100),
    timeTakenSeconds,
    review,
  };
}

module.exports = { scoreAttempt };
