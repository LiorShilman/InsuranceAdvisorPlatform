import type { Question } from "@insurance-advisor/questionnaire";
import { STARTER_QUESTIONS } from "@insurance-advisor/questionnaire";

/**
 * Hebrew labels for `single_select` answer values — shared between the
 * questionnaire (renders these as choice-card buttons) and the report
 * (needs the same mapping to show what was actually answered, not the
 * raw stored value). Previously defined only in questionnaire/page.tsx;
 * the report showed raw English values like "divorced" verbatim because
 * of that — see docs/DECISIONS.md.
 */
export const SINGLE_SELECT_OPTIONS: Record<string, Array<{ value: string; label: string }>> = {
  household_marital_status: [
    { value: "single", label: "רווק/ה" },
    { value: "married", label: "נשוי/אה" },
    { value: "divorced", label: "גרוש/ה" },
    { value: "widowed", label: "אלמן/ה" },
    { value: "partnered", label: "ידוע/ה בציבור" },
  ],
};

export const HEALTH_MODULE_TRISTATE_OPTIONS = [
  { value: "yes", label: "יש לי" },
  { value: "no", label: "אין לי" },
  { value: "unknown", label: "לא יודע/ת" },
];

export function optionsForQuestion(question: Question): Array<{ value: string; label: string }> {
  if (question.id.startsWith("health_module_")) return HEALTH_MODULE_TRISTATE_OPTIONS;
  return SINGLE_SELECT_OPTIONS[question.id] ?? [];
}

const FACT_KEY_TO_QUESTION = new Map<string, Question>(
  STARTER_QUESTIONS.flatMap((q) => q.factsProduced.map((factKey) => [factKey, q] as const)),
);

/** Translates a raw stored Fact value back to its Hebrew label when the producing question was a single_select — otherwise returns undefined so the caller can fall back to its own formatting. */
export function singleSelectLabelForFact(factKey: string, value: unknown): string | undefined {
  const question = FACT_KEY_TO_QUESTION.get(factKey);
  if (!question || question.answerType !== "single_select") return undefined;
  const option = optionsForQuestion(question).find((o) => o.value === value);
  return option?.label;
}

/** Fact key -> the Hebrew question text that produces it. Shared by /report and /scenarios (both show missing-facts lists by fact key). */
export const FACT_LABELS = new Map<string, string>(STARTER_QUESTIONS.flatMap((q) => q.factsProduced.map((key): [string, string] => [key, q.text])));

/** The 4 categories `ComputedRecommendations` actually produces (health is assessed separately, categorically — no single gap number). Shared by /report and /scenarios. */
export const RECOMMENDATION_CATEGORY_LABELS: Record<string, string> = {
  life: "ביטוח חיים",
  disability: "ביטוח אבדן כושר עבודה",
  critical_illness: "ביטוח מחלות קשות",
  ltc: "ביטוח סיעודי",
};
