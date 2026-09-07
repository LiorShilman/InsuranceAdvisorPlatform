import type { Expression } from "./question.js";

/**
 * Evaluates a `showWhen`/`requiredWhen` condition tree against the
 * answers collected so far — keyed by questionId, not fact key (that's
 * the rules engine's job in packages/rules against Fact[], a different
 * concern — see docs/DECISIONS.md).
 */
export function evaluateExpression(expression: Expression, answers: Record<string, unknown>): boolean {
  if ("questionId" in expression) {
    const value = answers[expression.questionId];
    switch (expression.operator) {
      case "exists":
        return value !== undefined && value !== null;
      case "==":
        return value === expression.value;
      case "!=":
        return value !== expression.value;
      case ">":
        return typeof value === "number" && typeof expression.value === "number" && value > expression.value;
      case ">=":
        return typeof value === "number" && typeof expression.value === "number" && value >= expression.value;
      case "<":
        return typeof value === "number" && typeof expression.value === "number" && value < expression.value;
      case "<=":
        return typeof value === "number" && typeof expression.value === "number" && value <= expression.value;
      case "in":
        return Array.isArray(expression.value) && expression.value.includes(value);
    }
  }
  if ("all" in expression) {
    return expression.all.every((e) => evaluateExpression(e, answers));
  }
  if ("any" in expression) {
    return expression.any.some((e) => evaluateExpression(e, answers));
  }
  return !evaluateExpression(expression.not, answers);
}
