import { Money, type Fact } from "@insurance-advisor/shared";
import type { CriticalIllnessCalculatorInput } from "./critical-illness-calculator.js";

function factValue(facts: Fact[], key: string): unknown {
  return facts.find((f) => f.key === key)?.value;
}
function moneyFact(facts: Fact[], key: string): Money | undefined {
  const value = factValue(facts, key);
  return typeof value === "number" ? Money.fromNumber(value) : undefined;
}

/** Real Facts → CriticalIllnessCalculatorInput adapter (minus recoveryDurationMonths, which is a scenario parameter, not a fact). */
export function factsToCriticalIllnessInput(facts: Fact[]): Omit<CriticalIllnessCalculatorInput, "recoveryDurationMonths"> {
  return {
    // See docs/ASSUMPTIONS.md: shares the same facts as life/disability's income figures rather than separately-collected ones.
    monthlyEssentialExpenses: moneyFact(facts, "expenses.household.monthly"),
    reliableMonthlyIncomeDuringRecovery: moneyFact(facts, "income.survivor.reliableMonthly"),
    existingCriticalIllnessCoverage: moneyFact(facts, "coverage.criticalIllness.existingAmount"),
  };
}
