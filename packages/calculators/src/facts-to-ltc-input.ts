import { Money, type Fact } from "@insurance-advisor/shared";
import type { LongTermCareCalculatorInput } from "./long-term-care-calculator.js";

function factValue(facts: Fact[], key: string): unknown {
  return facts.find((f) => f.key === key)?.value;
}
function moneyFact(facts: Fact[], key: string): Money | undefined {
  const value = factValue(facts, key);
  return typeof value === "number" ? Money.fromNumber(value) : undefined;
}

/**
 * Real Facts → LongTermCareCalculatorInput adapter (minus
 * expectedDurationYears, a scenario parameter, not a fact). Widened
 * 2026-09-11 (see docs/DECISIONS.md): `expectedMonthlyCareCost` used to be
 * intentionally left unset with no question collecting it, always falling
 * back to the calculator's generic config assumption (§16) — a real-world
 * figure that varies a lot by region/care level, so a fixed config guess
 * was a weak stand-in. `ltc_expected_monthly_care_cost` now collects it
 * directly; still genuinely optional (the config fallback still applies,
 * with the usual missingFacts/Assumption bookkeeping, when left blank).
 */
export function factsToLongTermCareInput(facts: Fact[]): Omit<LongTermCareCalculatorInput, "expectedDurationYears"> {
  return {
    expectedMonthlyCareCost: moneyFact(facts, "ltc.expectedMonthlyCareCost"),
    reliableMonthlyLTCBenefits: moneyFact(facts, "coverage.ltc.existingMonthlyBenefit"),
    monthlySelfFundingCapacity: moneyFact(facts, "assets.monthlySelfFundingCapacity"),
  };
}
