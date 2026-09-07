import type { Fact } from "@insurance-advisor/shared";

/**
 * Rule engine types — PRD §11. Rules are data, never hard-coded in
 * controllers (PRD rule 10). This file defines the *shape* of a rule and
 * the engine's contract only; no evaluation logic ships in Milestone 1
 * (see docs/DECISIONS.md) — that's Milestone 3.
 */

export type NeedStatus =
  | "required_to_evaluate"
  | "recommended"
  | "optional"
  | "not_needed"
  | "insufficient_data"
  | "manual_review";

export type ComparisonOperator = "==" | "!=" | ">" | ">=" | "<" | "<=" | "in" | "not_in" | "exists";

/** A single leaf condition, e.g. { fact: "household.dependents.count", operator: ">", value: 0 }. */
export type RuleCondition = {
  fact: string;
  operator: ComparisonOperator;
  value?: unknown;
};

/** Boolean composition of conditions — supports the §11.1 "all"/"any" shape, nestable. */
export type RuleConditionGroup =
  | { all: Array<RuleCondition | RuleConditionGroup> }
  | { any: Array<RuleCondition | RuleConditionGroup> }
  | { not: RuleCondition | RuleConditionGroup };

export type RuleEffect = {
  needStatus: NeedStatus;
};

/** Rule-as-data, PRD §11.1. */
export type Rule = {
  id: string;
  version: number;
  category: string;
  when: RuleConditionGroup;
  effect: RuleEffect;
  reason: string;
};

/**
 * One entry of "which rules fired and why" — referenced by
 * RecommendationAudit.rulesTriggered / exclusionsTriggered (PRD §4.2).
 */
export type RuleTrace = {
  ruleId: string;
  ruleVersion: number;
  matched: boolean;
  reason: string;
  factsUsed: string[];
};

/**
 * Contract the (future) rule engine implements. Evaluation logic is
 * intentionally not implemented yet — Milestone 1 only defines the
 * interface per the PRD's own first prompt (§47).
 */
export interface RuleEngine {
  evaluate(rules: Rule[], facts: Fact[]): RuleEvaluationResult;
}

export type RuleEvaluationResult = {
  traces: RuleTrace[];
  matchedRules: Rule[];
};
