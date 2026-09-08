import { Money, type Fact } from "@insurance-advisor/shared";
import type { LongTermCareCalculatorInput } from "./long-term-care-calculator.js";

function factValue(facts: Fact[], key: string): unknown {
  return facts.find((f) => f.key === key)?.value;
}
function moneyFact(facts: Fact[], key: string): Money | undefined {
  const value = factValue(facts, key);
  return typeof value === "number" ? Money.fromNumber(value) : undefined;
}

/** Real Facts → LongTermCareCalculatorInput adapter (minus expectedDurationYears, a scenario parameter, not a fact). `expectedMonthlyCareCost` is intentionally left unset — no question collects it; the calculator's own config fallback (§16) applies. */
export function factsToLongTermCareInput(facts: Fact[]): Omit<LongTermCareCalculatorInput, "expectedDurationYears"> {
  return {
    reliableMonthlyLTCBenefits: moneyFact(facts, "coverage.ltc.existingMonthlyBenefit"),
    monthlySelfFundingCapacity: moneyFact(facts, "assets.monthlySelfFundingCapacity"),
  };
}
