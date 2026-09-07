import type { Fact } from "@insurance-advisor/shared";
import type { Rule, RuleCondition, RuleConditionGroup, RuleEngine, RuleEvaluationResult, RuleTrace } from "./rule.js";

/**
 * First real implementation of the RuleEngine interface (Milestone 3, PRD
 * §11). Rules stay data (PRD rule 10) — this file only walks the JSON
 * condition tree in §11.1 against a Fact[] snapshot.
 */
function factValue(facts: Fact[], key: string): unknown {
  return facts.find((f) => f.key === key)?.value;
}

function evaluateCondition(condition: RuleCondition, facts: Fact[]): boolean {
  const value = factValue(facts, condition.fact);
  switch (condition.operator) {
    case "exists":
      return value !== undefined && value !== null;
    case "==":
      return value === condition.value;
    case "!=":
      return value !== condition.value;
    case ">":
      return typeof value === "number" && typeof condition.value === "number" && value > condition.value;
    case ">=":
      return typeof value === "number" && typeof condition.value === "number" && value >= condition.value;
    case "<":
      return typeof value === "number" && typeof condition.value === "number" && value < condition.value;
    case "<=":
      return typeof value === "number" && typeof condition.value === "number" && value <= condition.value;
    case "in":
      return Array.isArray(condition.value) && condition.value.includes(value);
    case "not_in":
      return Array.isArray(condition.value) && !condition.value.includes(value);
  }
}

function collectFactKeys(node: RuleCondition | RuleConditionGroup): string[] {
  if ("fact" in node) {
    return [node.fact];
  }
  if ("all" in node) {
    return node.all.flatMap(collectFactKeys);
  }
  if ("any" in node) {
    return node.any.flatMap(collectFactKeys);
  }
  return collectFactKeys(node.not);
}

function evaluateNode(node: RuleCondition | RuleConditionGroup, facts: Fact[]): boolean {
  if ("fact" in node) {
    return evaluateCondition(node, facts);
  }
  if ("all" in node) {
    return node.all.every((child) => evaluateNode(child, facts));
  }
  if ("any" in node) {
    return node.any.some((child) => evaluateNode(child, facts));
  }
  return !evaluateNode(node.not, facts);
}

export class SimpleRuleEngine implements RuleEngine {
  evaluate(rules: Rule[], facts: Fact[]): RuleEvaluationResult {
    const traces: RuleTrace[] = [];
    const matchedRules: Rule[] = [];

    for (const rule of rules) {
      const matched = evaluateNode(rule.when, facts);
      const trace: RuleTrace = {
        ruleId: rule.id,
        ruleVersion: rule.version,
        matched,
        reason: rule.reason,
        factsUsed: collectFactKeys(rule.when),
      };
      traces.push(trace);
      if (matched) {
        matchedRules.push(rule);
      }
    }

    return { traces, matchedRules };
  }
}
