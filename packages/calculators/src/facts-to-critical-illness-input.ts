import { Money, type Fact } from "@insurance-advisor/shared";
import type { CriticalIllnessCalculatorInput } from "./critical-illness-calculator.js";

function factValue(facts: Fact[], key: string): unknown {
  return facts.find((f) => f.key === key)?.value;
}
function moneyFact(facts: Fact[], key: string): Money | undefined {
  const value = factValue(facts, key);
  return typeof value === "number" ? Money.fromNumber(value) : undefined;
}
function numberFact(facts: Fact[], key: string): number | undefined {
  const value = factValue(facts, key);
  return typeof value === "number" ? value : undefined;
}

/**
 * `recoveryDurationMonths` when `ci.expectedRecoveryDurationMonths` wasn't
 * answered — the same 6-month figure the live flow used to hardcode at its
 * call site (`apps/web/lib/compute-recommendations.ts`) before the
 * 2026-09-12 questionnaire widening (see docs/DECISIONS.md) turned it into
 * a genuine, optional, user-overridable fact. Not tracked via
 * missingFacts/Assumption bookkeeping (unlike e.g. `expectedMonthlyCareCost`
 * below) — same as before the widening, this is a scenario parameter the
 * calculator always requires a concrete value for, not a personal unknown.
 */
export const DEFAULT_RECOVERY_DURATION_MONTHS = 6;

/** Real Facts → CriticalIllnessCalculatorInput adapter — see facts-to-life-input.ts for the pattern this follows. */
export function factsToCriticalIllnessInput(facts: Fact[]): CriticalIllnessCalculatorInput {
  return {
    recoveryDurationMonths: numberFact(facts, "ci.expectedRecoveryDurationMonths") ?? DEFAULT_RECOVERY_DURATION_MONTHS,
    // See docs/ASSUMPTIONS.md: shares the same facts as life/disability's income figures rather than separately-collected ones.
    monthlyEssentialExpenses: moneyFact(facts, "expenses.household.monthly"),
    reliableMonthlyIncomeDuringRecovery: moneyFact(facts, "income.survivor.reliableMonthly"),
    existingCriticalIllnessCoverage: moneyFact(facts, "coverage.criticalIllness.existingAmount"),
  };
}
