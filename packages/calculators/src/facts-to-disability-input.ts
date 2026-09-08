import { Money, type Fact } from "@insurance-advisor/shared";
import type { DisabilityCalculatorInput } from "./disability-insurance-calculator.js";

/** Real Facts → DisabilityCalculatorInput adapter — see facts-to-life-input.ts for the pattern this follows. */
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

export function factsToDisabilityCalculatorInput(facts: Fact[]): DisabilityCalculatorInput {
  return {
    // See docs/ASSUMPTIONS.md: shares the same fact as life's household spend rather than a separately-collected "essential" figure.
    essentialMonthlyExpenses: moneyFact(facts, "expenses.household.monthly"),
    debtMonthlyPayments: moneyFact(facts, "debt.mortgage.monthlyPayment"),
    // See docs/ASSUMPTIONS.md: shares the same fact as life's survivor income rather than a separately-collected figure.
    reliableMonthlyIncomeDuringDisability: moneyFact(facts, "income.survivor.reliableMonthly"),
    existingNetExpectedDisabilityIncome: moneyFact(facts, "coverage.disability.existingNetMonthly"),
    currentAge: numberFact(facts, "person.currentAge"),
    retirementAge: numberFact(facts, "person.retirementAge"),
  };
}
