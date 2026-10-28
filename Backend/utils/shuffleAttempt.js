const crypto = require('crypto');

const LETTERS = ['A', 'B', 'C', 'D'];

function secureShuffle(array) {
  const result = array.slice();
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(0, i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Build a per-attempt copy of a published snapshot with question order and
 * option order shuffled independently for every attempt. Each question's
 * `correctAnswer` letter is remapped to match its new option positions, so
 * scoring (which reads straight off the attempt's own frozen copy) needs no
 * changes.
 */
function shuffleSnapshot(publishedSnapshot) {
  const questionOrder = secureShuffle(publishedSnapshot);
  return questionOrder.map((question, index) => {
    const optionOrder = secureShuffle(LETTERS);
    const options = {};
    let correctAnswer = 'A';
    optionOrder.forEach((sourceLetter, newIndex) => {
      const newLetter = LETTERS[newIndex];
      options[`option${newLetter}`] = question[`option${sourceLetter}`];
      if (sourceLetter === question.correctAnswer) correctAnswer = newLetter;
    });
    return {
      questionId: question.questionId,
      order: index + 1,
      question: question.question,
      optionA: options.optionA,
      optionB: options.optionB,
      optionC: options.optionC,
      optionD: options.optionD,
      correctAnswer,
      chapter: question.chapter || '',
    };
  });
}

module.exports = { shuffleSnapshot };
