import { evaluateExpression } from "./expression-evaluator.js";
import type { AnswerType, Question } from "./question.js";

/**
 * PRD §7.2's `getNextQuestion` / questionScore. Simplified from the PRD's
 * literal `decisionImpact × uncertainty × relevance × answerability -
 * userBurdenPenalty` product into an equivalent, easier-to-reason-about
 * form:
 *
 * - `relevance` and `answerability` collapse into a single relevance
 *   filter (`showWhen` true/absent) — a question that isn't relevant yet
 *   isn't "askable" either, so treating them as one boolean gate rather
 *   than two multiplied continuous factors doesn't lose anything real.
 * - `uncertainty` collapses into "already answered? exclude it." —
 *   there's no partial-uncertainty state for a single-value answer.
 * - What's left, `decisionImpact - userBurdenPenalty`, is exactly what
 *   ranks the surviving candidates.
 *
 * See docs/DECISIONS.md for why this simplification was made instead of
 * literally implementing four independent 0..1 factors that would have
 * needed just as many invented per-question constants for no behavioral
 * difference.
 */
const ANSWER_TYPE_BURDEN: Record<AnswerType, number> = {
  boolean: 0.05,
  number: 0.1,
  money: 0.1,
  single_select: 0.1,
  date: 0.15,
  text: 0.15,
  multi_select: 0.2,
};

function isRelevant(question: Question, answers: Record<string, unknown>): boolean {
  return question.showWhen === undefined || evaluateExpression(question.showWhen, answers);
}

function isRequired(question: Question, answers: Record<string, unknown>): boolean {
  if (question.requiredWhen !== undefined) {
    return evaluateExpression(question.requiredWhen, answers);
  }
  return question.required;
}

export function getNextQuestion(questions: Question[], answers: Record<string, unknown>): Question | undefined {
  let best: Question | undefined;
  let bestScore = -Infinity;

  for (const question of questions) {
    if (answers[question.id] !== undefined) continue;
    if (!isRelevant(question, answers)) continue;

    const score = question.decisionImpact - ANSWER_TYPE_BURDEN[question.answerType];
    if (score > bestScore) {
      bestScore = score;
      best = question;
    }
  }

  return best;
}

/** PRD §9's dataCompleteness idea, applied to the questionnaire itself: required-and-relevant questions answered / required-and-relevant questions total. */
export function completionScore(questions: Question[], answers: Record<string, unknown>): number {
  const relevant = questions.filter((q) => isRelevant(q, answers));
  const required = relevant.filter((q) => isRequired(q, answers));
  if (required.length === 0) return 1;
  const answered = required.filter((q) => answers[q.id] !== undefined);
  return answered.length / required.length;
}
