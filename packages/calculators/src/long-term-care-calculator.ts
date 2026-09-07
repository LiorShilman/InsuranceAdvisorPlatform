import { Money, type Assumption, type CalculationTrace, type CalculationTraceLine } from "@insurance-advisor/shared";
import type { EngineConfig } from "@insurance-advisor/config";
import type { CalculatorResult, NeedsCalculator } from "./calculator.js";

/**
 * Long-Term Care Needs Calculator — PRD §16. Same PV-over-a-horizon shape
 * as the life calculator (§12.3), applied to a monthly LTC gap instead of
 * income dependency; same duration-as-scenario-parameter treatment as the
 * critical illness calculator (§14), since the PRD explicitly calls
 * expected duration "a scenario parameter ... with a range", not a single
 * fixed number.
 */
export const LTC_DURATION_SCENARIOS_YEARS = [1, 2, 3, 5, 8] as const;

export type LongTermCareCalculatorInput = {
  expectedDurationYears: number;

  expectedMonthlyCareCost?: Money;
  /** Public/health-fund benefits + any existing private LTC coverage, netted to one monthly figure (PRD §16). */
  reliableMonthlyLTCBenefits?: Money;
  /** How much monthly drawdown capacity the household's own assets/income can sustain (PRD §16). */
  monthlySelfFundingCapacity?: Money;
};

export type LongTermCareResult = {
  monthlyGap: Money;
  capitalNeed: Money;
  expectedDurationYears: number;
  reasonCodes: string[];
  reviewTriggers: string[];
  missingFacts: string[];
  assumptions: Assumption[];
  confidence: "high" | "medium" | "low";
};

function resolveMoney(
  value: Money | undefined,
  key: string,
  description: string,
  missingFacts: string[],
  assumptions: Assumption[],
): Money {
  if (value !== undefined) {
    return value;
  }
  missingFacts.push(key);
  assumptions.push({ key, description, value: 0, source: "default:unknown_treated_as_zero_pending_data" });
  return Money.zero();
}

/**
 * PRD §16 frames expected care cost as a system-level assumption, not a
 * personal unknown that should fall back to zero — so a missing personal
 * figure here falls back to the configured estimate instead, still
 * flagged as missing/assumed, never silently substituted.
 */
function resolveMoneyWithConfigDefault(
  value: Money | undefined,
  fallback: Money,
  key: string,
  description: string,
  missingFacts: string[],
  assumptions: Assumption[],
): Money {
  if (value !== undefined) {
    return value;
  }
  missingFacts.push(key);
  assumptions.push({ key, description, value: fallback.toNumber(), source: "default:careAssumptions.assumedMonthlyLTCCareCost" });
  return fallback;
}

function newId(): string {
  return globalThis.crypto.randomUUID();
}

export class LongTermCareCalculator implements NeedsCalculator<LongTermCareCalculatorInput, LongTermCareResult> {
  readonly key = "long_term_care";

  calculate(input: LongTermCareCalculatorInput, config: EngineConfig): CalculatorResult<LongTermCareResult> {
    const missingFacts: string[] = [];
    const assumptions: Assumption[] = [];
    const lines: CalculationTraceLine[] = [];
    const zero = Money.zero();

    const expectedMonthlyCareCost = resolveMoneyWithConfigDefault(
      input.expectedMonthlyCareCost,
      config.careAssumptions.assumedMonthlyLTCCareCost,
      "expectedMonthlyCareCost",
      "Household-specific expected monthly care cost unknown — fell back to the configured general assumption.",
      missingFacts,
      assumptions,
    );
    const reliableMonthlyLTCBenefits = input.reliableMonthlyLTCBenefits ?? zero;
    const monthlySelfFundingCapacity = resolveMoney(
      input.monthlySelfFundingCapacity,
      "monthlySelfFundingCapacity",
      "Monthly self-funding capacity unknown — assumed 0 pending data (widens, not narrows, the gap).",
      missingFacts,
      assumptions,
    );

    const monthlyGap = Money.max(zero, expectedMonthlyCareCost.subtract(reliableMonthlyLTCBenefits).subtract(monthlySelfFundingCapacity));

    const annualGap = monthlyGap.multiply(12);
    const r = config.financialAssumptions.realDiscountRate;
    let capitalNeed = zero;
    for (let t = 0; t < input.expectedDurationYears; t++) {
      capitalNeed = capitalNeed.add(annualGap.divide(Math.pow(1 + r, t)));
    }

    if (!capitalNeed.isZero()) {
      lines.push({
        key: "ltc_capital_need",
        label: `הון נדרש לכיסוי סיעודי (${input.expectedDurationYears} שנות תוחלת)`,
        amountExact: capitalNeed.toExactString(),
        sourceFactKeys: ["expectedMonthlyCareCost", "reliableMonthlyLTCBenefits", "monthlySelfFundingCapacity"],
        assumptionKeys: ["financialAssumptions.realDiscountRate"],
        formula: "sum_{t=0}^{expectedDurationYears-1} 12*max(0, cost-benefits-selfFunding) / (1+realDiscountRate)^t",
      });
    }

    const criticalMissing = missingFacts.some((f) => ["expectedMonthlyCareCost", "monthlySelfFundingCapacity"].includes(f));
    const confidence: "high" | "medium" | "low" = criticalMissing ? "low" : missingFacts.length > 0 ? "medium" : "high";

    const reasonCodes: string[] = [];
    if (!monthlyGap.isZero()) reasonCodes.push("LTC_MONTHLY_GAP");
    if (!monthlySelfFundingCapacity.isZero() && monthlySelfFundingCapacity.greaterThan(expectedMonthlyCareCost)) {
      reasonCodes.push("LTC_SELF_FUNDING_CAPACITY_HIGH");
    }

    const reviewTriggers = ["annual_review", "major_health_change", "major_asset_change"];

    const trace: CalculationTrace = {
      id: newId(),
      calculatorKey: this.key,
      configVersion: config.version,
      createdAt: new Date().toISOString(),
      lines,
      resultExact: capitalNeed.toExactString(),
    };

    return {
      result: {
        monthlyGap,
        capitalNeed,
        expectedDurationYears: input.expectedDurationYears,
        reasonCodes,
        reviewTriggers,
        missingFacts,
        assumptions,
        confidence,
      },
      trace,
    };
  }

  /**
   * PRD §16 treats expected duration as "a scenario parameter with a
   * range" — mirrors CriticalIllnessCalculator.calculateScenarios.
   */
  calculateScenarios(
    input: Omit<LongTermCareCalculatorInput, "expectedDurationYears">,
    config: EngineConfig,
    durationsYears: readonly number[] = LTC_DURATION_SCENARIOS_YEARS,
  ): Array<{ expectedDurationYears: number } & CalculatorResult<LongTermCareResult>> {
    return durationsYears.map((expectedDurationYears) => ({
      expectedDurationYears,
      ...this.calculate({ ...input, expectedDurationYears }, config),
    }));
  }
}
