import type { Question, ValidationRule } from "./question.js";

export type ValidationIssue = { severity: "error" | "warning"; message: string };

/**
 * Applies a question's ValidationRule list to a raw answer. PRD §33:
 * sanity-limit violations should surface as a warning the user can
 * confirm past ("did you really mean X?"), never a silent auto-correction
 * or a silent rejection — callers decide what to do with `warning`
 * issues (typically: show them, let the user proceed anyway), but
 * `error` issues must block moving on.
 */
export function validateAnswer(question: Question, rawValue: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (question.required && (rawValue === undefined || rawValue === null || rawValue === "")) {
    issues.push({ severity: "error", message: "שדה זה חובה." });
    return issues;
  }
  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return issues;
  }

  for (const rule of question.validation ?? []) {
    if (!violatesRule(rule, rawValue)) continue;
    issues.push({ severity: rule.severity, message: rule.message });
  }

  return issues;
}

function violatesRule(rule: ValidationRule, value: unknown): boolean {
  const num = typeof value === "number" ? value : undefined;
  switch (rule.kind) {
    case "min":
      return num !== undefined && typeof rule.params?.min === "number" && num < rule.params.min;
    case "max":
      return num !== undefined && typeof rule.params?.max === "number" && num > rule.params.max;
    case "range":
      return (
        num !== undefined &&
        typeof rule.params?.min === "number" &&
        typeof rule.params?.max === "number" &&
        (num < rule.params.min || num > rule.params.max)
      );
    case "pattern":
      return typeof value === "string" && typeof rule.params?.pattern === "string" && !new RegExp(rule.params.pattern).test(value);
    case "custom":
      return false; // no custom validators registered yet — a hook for later, not a silent no-op that hides real rules.
  }
}
