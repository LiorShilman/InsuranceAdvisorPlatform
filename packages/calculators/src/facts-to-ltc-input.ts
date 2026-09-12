import { Money, type Fact } from "@insurance-advisor/shared";
import type { LongTermCareCalculatorInput } from "./long-term-care-calculator.js";

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
 * `expectedDurationYears` when `ltc.expectedDurationYears` wasn't answered —
 * the same 3-year figure the live flow used to hardcode at its call site
 * (`apps/web/lib/compute-recommendations.ts`) before the 2026-09-12
 * questionnaire widening (see docs/DECISIONS.md) turned it into a genuine,
 * optional, user-overridable fact. Not tracked via missingFacts/Assumption
 * bookkeeping (unlike `expectedMonthlyCareCost` below) — same as before the
 * widening, this is a scenario parameter the calculator always requires a
 * concrete value for, not a personal unknown.
 */
export const DEFAULT_LTC_EXPECTED_DURATION_YEARS = 3;

/**
 * Real Facts → LongTermCareCalculatorInput adapter. Widened 2026-09-11 (see
 * docs/DECISIONS.md): `expectedMonthlyCareCost` used to be intentionally
 * left unset with no question collecting it, always falling back to the
 * calculator's generic config assumption (§16) — a real-world figure that
 * varies a lot by region/care level, so a fixed config guess was a weak
 * stand-in. `ltc_expected_monthly_care_cost` now collects it directly;
 * still genuinely optional (the config fallback still applies, with the
 * usual missingFacts/Assumption bookkeeping, when left blank).
 */
export function factsToLongTermCareInput(facts: Fact[]): LongTermCareCalculatorInput {
  return {
    expectedDurationYears: numberFact(facts, "ltc.expectedDurationYears") ?? DEFAULT_LTC_EXPECTED_DURATION_YEARS,
    expectedMonthlyCareCost: moneyFact(facts, "ltc.expectedMonthlyCareCost"),
    reliableMonthlyLTCBenefits: moneyFact(facts, "coverage.ltc.existingMonthlyBenefit"),
    monthlySelfFundingCapacity: moneyFact(facts, "assets.monthlySelfFundingCapacity"),
  };
}
