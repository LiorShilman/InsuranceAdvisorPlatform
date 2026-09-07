/**
 * Question schema — PRD §7.1. Milestone 2 (this file + question-selector.ts,
 * expression-evaluator.ts, validation.ts, facts.ts) implements selection,
 * validation, and fact production — see docs/DECISIONS.md for what's
 * simplified vs. the PRD's full §7.2 formula.
 *
 * Dependency-free by design: showWhen/requiredWhen conditions are
 * evaluated against Answers, which is a different concern from the rules
 * engine evaluating Facts (packages/rules) — see docs/DECISIONS.md for why
 * this isn't just reusing RuleConditionGroup.
 */
export type QuestionCategory =
  | "personal"
  | "household"
  | "income"
  | "expenses"
  | "assets"
  | "debts"
  | "employment"
  | "existing_coverage"
  | "health"
  | "goals";

export type AnswerType =
  | "text"
  | "number"
  | "money"
  | "date"
  | "boolean"
  | "single_select"
  | "multi_select";

/** Minimal condition tree for showWhen/requiredWhen, evaluated against already-collected answers. */
export type Expression =
  | { all: Expression[] }
  | { any: Expression[] }
  | { not: Expression }
  | { questionId: string; operator: "==" | "!=" | ">" | ">=" | "<" | "<=" | "in" | "exists"; value?: unknown };

export type ValidationRule = {
  kind: "min" | "max" | "range" | "pattern" | "custom";
  params?: Record<string, unknown>;
  /** PRD §33: sanity-limit violations should warn, not silently reject. */
  severity: "error" | "warning";
  message: string;
};

export type Question = {
  id: string;
  version: number;
  category: QuestionCategory;
  text: string;
  helpText?: string;

  answerType: AnswerType;

  required: boolean;

  showWhen?: Expression;
  requiredWhen?: Expression;

  validation?: ValidationRule[];
  normalizer?: string;

  factsProduced: string[];
  followUpQuestionIds?: string[];

  /** PRD §7.3 — medical questions must be flagged sensitive. */
  sensitive?: boolean;

  /**
   * PRD §7.2's questionScore formula factor — "how much would answering
   * this change the outcome", 0..1. Authored per-question, not derived;
   * an invented placeholder like every other unscored PRD factor in this
   * codebase — see docs/ASSUMPTIONS.md.
   */
  decisionImpact: number;
};
