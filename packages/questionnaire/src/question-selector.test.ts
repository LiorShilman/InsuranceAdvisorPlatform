import { describe, expect, it } from "vitest";
import type { Question } from "./question.js";
import { getNextQuestion, completionScore } from "./question-selector.js";
import { STARTER_QUESTIONS } from "./starter-questionnaire.js";

describe("getNextQuestion (PRD §7.2)", () => {
  it("1. with no answers, returns the highest decisionImpact-minus-burden relevant question", () => {
    const next = getNextQuestion(STARTER_QUESTIONS, {});
    expect(next?.id).toBe("household_dependents_count");
  });

  it("2. never returns an already-answered question", () => {
    const answers = { household_dependents_count: 2 };
    const next = getNextQuestion(STARTER_QUESTIONS, answers);
    expect(next?.id).not.toBe("household_dependents_count");
  });

  it("3. a gated question is not offered before its dependency is answered", () => {
    const next = getNextQuestion(STARTER_QUESTIONS, { household_marital_status: "single" });
    expect(next?.id).not.toBe("household_youngest_dependent_age");
    expect(next?.id).not.toBe("debt_mortgage_balance");
  });

  it("4. answering 0 dependents keeps the dependent-age question gated off (not just 'answered')", () => {
    const ids = new Set<string>();
    let answers: Record<string, unknown> = { household_dependents_count: 0 };
    for (let i = 0; i < 20; i++) {
      const next = getNextQuestion(STARTER_QUESTIONS, answers);
      if (!next) break;
      ids.add(next.id);
      answers = { ...answers, [next.id]: "x" };
    }
    expect(ids.has("household_youngest_dependent_age")).toBe(false);
    expect(ids.has("goals_education_amount")).toBe(false);
  });

  it("5. answering >0 dependents unlocks the dependent-age and education-goal questions eventually", () => {
    const ids = new Set<string>();
    let answers: Record<string, unknown> = { household_dependents_count: 2 };
    for (let i = 0; i < 20; i++) {
      const next = getNextQuestion(STARTER_QUESTIONS, answers);
      if (!next) break;
      ids.add(next.id);
      answers = { ...answers, [next.id]: next.answerType === "boolean" ? true : 100 };
    }
    expect(ids.has("household_youngest_dependent_age")).toBe(true);
    expect(ids.has("goals_education_amount")).toBe(true);
  });

  it("6. once every relevant question is answered, there is nothing left to ask", () => {
    let answers: Record<string, unknown> = { household_dependents_count: 0, debt_mortgage_exists: false };
    for (let i = 0; i < 30; i++) {
      const next = getNextQuestion(STARTER_QUESTIONS, answers);
      if (!next) break;
      answers = { ...answers, [next.id]: next.answerType === "boolean" ? false : next.answerType === "single_select" ? "single" : 1 };
    }
    expect(getNextQuestion(STARTER_QUESTIONS, answers)).toBeUndefined();
  });
});

describe("completionScore (PRD §9 applied to the questionnaire)", () => {
  const q = (id: string, overrides: Partial<Question> = {}): Question => ({
    id,
    version: 1,
    category: "personal",
    text: id,
    answerType: "number",
    required: true,
    factsProduced: [id],
    decisionImpact: 0.5,
    ...overrides,
  });

  it("1. zero answered out of N required -> 0", () => {
    const questions = [q("a"), q("b")];
    expect(completionScore(questions, {})).toBe(0);
  });

  it("2. all required-relevant answered -> 1", () => {
    const questions = [q("a"), q("b")];
    expect(completionScore(questions, { a: 1, b: 1 })).toBe(1);
  });

  it("3. a gated required question doesn't count until it becomes relevant", () => {
    const questions = [q("a"), q("b", { required: false, showWhen: { questionId: "a", operator: ">", value: 0 }, requiredWhen: { questionId: "a", operator: ">", value: 0 } })];
    // "a" unanswered -> "b" not relevant yet -> denominator is 1 (just "a")
    expect(completionScore(questions, {})).toBe(0);
    // "a" = 0 -> "b" still not relevant -> only "a" counts, and it's answered -> 1
    expect(completionScore(questions, { a: 0 })).toBe(1);
    // "a" = 5 -> "b" becomes relevant AND required, unanswered -> 1 of 2
    expect(completionScore(questions, { a: 5 })).toBe(0.5);
    // both answered -> 1
    expect(completionScore(questions, { a: 5, b: 3 })).toBe(1);
  });

  it("4. optional (non-required) questions never lower the score", () => {
    const questions = [q("a"), q("b", { required: false })];
    expect(completionScore(questions, { a: 1 })).toBe(1);
  });
});
