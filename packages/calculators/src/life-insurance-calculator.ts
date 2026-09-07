import { Money, type Assumption, type CalculationTrace, type CalculationTraceLine } from "@insurance-advisor/shared";
import type { EngineConfig } from "@insurance-advisor/config";
import type { CalculatorResult, NeedsCalculator } from "./calculator.js";

/**
 * Life Insurance Needs Calculator — PRD §12, implemented per the PRD's own
 * "Second Prompt" (§48). Deterministic, versioned config, no insurer/product
 * logic.
 *
 * `LifeCalculatorInput` is a typed, already-normalized shape rather than
 * raw `Fact[]` — mapping arbitrary Facts onto this shape is Facts Engine /
 * Questionnaire work for a later milestone (see docs/DECISIONS.md). Every
 * optional `Money | undefined` field means "unknown, not yet collected" —
 * per PRD rule 13 ("never convert unknown to false/0 silently"), a missing
 * value is defaulted to zero only through `resolveMoney` below, which
 * always also records a missingFacts entry and an Assumption. Nothing is
 * defaulted without being flagged.
 */
export type LifeCalculatorInput = {
  dependentCount: number;
  /** Age of the youngest dependent, if any — drives PRD §12.4's horizon calc. */
  youngestDependentAge?: number;
  hasSpecialNeedsDependent?: boolean;

  /** Annual figures, already netted — PRD §12.3. */
  householdRequiredAnnualSpend?: Money;
  survivorReliableAnnualIncome?: Money;
  reliableOtherAnnualIncome?: Money;

  immediateExpenses?: Money;
  educationNeed?: Money;
  specialDependentNeed?: Money;
  otherGoals?: Money;

  /** Family-benefit existing life cover only — mortgage-beneficiary cover is handled separately (PRD §12.5). */
  existingLifeInsurance?: Money;
  survivorBenefitsPresentValue?: Money;
  earmarkedLiquidAssets?: Money;
  earmarkedOtherAssets?: Money;

  mortgage?: {
    balance: Money;
    hasLenderBeneficiaryCoverage: boolean;
    lenderBeneficiaryCoverageAmount?: Money;
    /** Years from now until the mortgage is scheduled to be paid off — feeds the horizon calc (PRD §12.4). */
    yearsUntilPayoff?: number;
  };

  /** PRD §12.4 allowUserOverride — explicit user choice always wins into the max(). */
  userSelectedProtectionHorizonYears?: number;
};

export type LifeInsuranceResult = {
  grossNeed: Money;
  availableResources: Money;
  gap: Money;
  recommendedRange: { min: Money; target: Money; max: Money };
  horizonYears: number;
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

function newId(): string {
  return globalThis.crypto.randomUUID();
}

export class LifeInsuranceCalculator implements NeedsCalculator<LifeCalculatorInput, LifeInsuranceResult> {
  readonly key = "life_insurance";

  calculate(input: LifeCalculatorInput, config: EngineConfig): CalculatorResult<LifeInsuranceResult> {
    const missingFacts: string[] = [];
    const assumptions: Assumption[] = [];
    const lines: CalculationTraceLine[] = [];
    const zero = Money.zero();

    // ---- Coverage horizon (PRD §12.4) ----
    const yearsUntilYoungestDependentTargetAge =
      input.youngestDependentAge !== undefined
        ? Math.max(0, config.dependentAssumptions.targetAge - input.youngestDependentAge)
        : 0;
    if (input.dependentCount > 0 && input.youngestDependentAge === undefined) {
      missingFacts.push("youngestDependentAge");
    }

    const yearsUntilMortgagePayoff = input.mortgage?.yearsUntilPayoff ?? 0;
    const userHorizon = input.userSelectedProtectionHorizonYears ?? 0;
    const horizonYears = Math.max(yearsUntilYoungestDependentTargetAge, yearsUntilMortgagePayoff, userHorizon);

    // ---- Income replacement (PRD §12.3) ----
    let incomeReplacementNeed = zero;
    if (horizonYears > 0) {
      const spend = resolveMoney(
        input.householdRequiredAnnualSpend,
        "householdRequiredAnnualSpend",
        "Household required annual spend unknown — assumed 0 pending data.",
        missingFacts,
        assumptions,
      );
      const survivorIncome = resolveMoney(
        input.survivorReliableAnnualIncome,
        "survivorReliableAnnualIncome",
        "Survivor reliable annual income unknown — assumed 0 pending data (widens, not narrows, the gap).",
        missingFacts,
        assumptions,
      );
      const otherIncome = input.reliableOtherAnnualIncome ?? zero;

      const annualDependency = Money.max(zero, spend.subtract(survivorIncome).subtract(otherIncome));
      const r = config.financialAssumptions.realDiscountRate;

      let pvSum = zero;
      for (let t = 0; t < horizonYears; t++) {
        pvSum = pvSum.add(annualDependency.divide(Math.pow(1 + r, t)));
      }
      incomeReplacementNeed = pvSum;

      if (!incomeReplacementNeed.isZero()) {
        lines.push({
          key: "income_replacement",
          label: "השלמת הכנסה לתלויים",
          amountExact: incomeReplacementNeed.toExactString(),
          sourceFactKeys: ["householdRequiredAnnualSpend", "survivorReliableAnnualIncome", "reliableOtherAnnualIncome"],
          assumptionKeys: ["financialAssumptions.realDiscountRate"],
          formula: `sum_{t=0}^{${horizonYears - 1}} max(0, spend-survivorIncome-otherIncome) / (1+realDiscountRate)^t`,
        });
      }
    }

    // ---- Debt payoff (PRD §12.5 — mortgage-beneficiary distinction) ----
    let debtPayoffNeed = zero;
    if (input.mortgage) {
      const lenderCoverage = input.mortgage.hasLenderBeneficiaryCoverage
        ? (input.mortgage.lenderBeneficiaryCoverageAmount ?? zero)
        : zero;
      debtPayoffNeed = Money.max(zero, input.mortgage.balance.subtract(lenderCoverage));
      if (!debtPayoffNeed.isZero()) {
        lines.push({
          key: "mortgage_offset",
          label: "יתרת משכנתה שאינה מכוסה בביטוח משכנתה קיים",
          amountExact: debtPayoffNeed.toExactString(),
          sourceFactKeys: ["mortgage.balance", "mortgage.lenderBeneficiaryCoverageAmount"],
          assumptionKeys: [],
          formula: "max(0, mortgage.balance - lenderBeneficiaryCoverageAmount)",
        });
      }
    }

    // ---- Other gross-need components ----
    const immediateExpenses = input.immediateExpenses ?? zero;
    if (!immediateExpenses.isZero()) {
      lines.push({ key: "immediate_expenses", label: "הוצאות מיידיות", amountExact: immediateExpenses.toExactString(), sourceFactKeys: ["immediateExpenses"], assumptionKeys: [] });
    }
    const educationNeed = input.educationNeed ?? zero;
    if (!educationNeed.isZero()) {
      lines.push({ key: "education_reserve", label: "רזרבת חינוך", amountExact: educationNeed.toExactString(), sourceFactKeys: ["educationNeed"], assumptionKeys: [] });
    }
    const specialDependentNeed = input.specialDependentNeed ?? zero;
    if (!specialDependentNeed.isZero()) {
      lines.push({ key: "special_dependent_need", label: "צורך תלוי עם צרכים מיוחדים", amountExact: specialDependentNeed.toExactString(), sourceFactKeys: ["specialDependentNeed"], assumptionKeys: [] });
    }
    const otherGoals = input.otherGoals ?? zero;
    if (!otherGoals.isZero()) {
      lines.push({ key: "other_goals", label: "מטרות נוספות", amountExact: otherGoals.toExactString(), sourceFactKeys: ["otherGoals"], assumptionKeys: [] });
    }

    // ---- Available resources (offsets — negative lines) ----
    const existingLifeInsurance = resolveMoney(
      input.existingLifeInsurance,
      "existingLifeInsurance",
      "Existing family-benefit life cover unknown — assumed 0 pending data (widens, not narrows, the gap).",
      missingFacts,
      assumptions,
    );
    if (!existingLifeInsurance.isZero()) {
      lines.push({ key: "existing_life_cover_offset", label: "כיסוי חיים קיים (מוטב: משפחה)", amountExact: existingLifeInsurance.negate().toExactString(), sourceFactKeys: ["existingLifeInsurance"], assumptionKeys: [] });
    }
    const survivorBenefitsPresentValue = input.survivorBenefitsPresentValue ?? zero;
    if (!survivorBenefitsPresentValue.isZero()) {
      lines.push({ key: "survivor_benefits_offset", label: "ערך נוכחי של קצבאות שאירים", amountExact: survivorBenefitsPresentValue.negate().toExactString(), sourceFactKeys: ["survivorBenefitsPresentValue"], assumptionKeys: [] });
    }
    const earmarkedLiquidAssets = resolveMoney(
      input.earmarkedLiquidAssets,
      "earmarkedLiquidAssets",
      "Earmarked liquid assets unknown — assumed 0 pending data (widens, not narrows, the gap).",
      missingFacts,
      assumptions,
    );
    if (!earmarkedLiquidAssets.isZero()) {
      lines.push({ key: "earmarked_liquid_assets_offset", label: "נכסים נזילים ייעודיים", amountExact: earmarkedLiquidAssets.negate().toExactString(), sourceFactKeys: ["earmarkedLiquidAssets"], assumptionKeys: [] });
    }
    const earmarkedOtherAssets = input.earmarkedOtherAssets ?? zero;
    if (!earmarkedOtherAssets.isZero()) {
      lines.push({ key: "earmarked_other_assets_offset", label: "נכסים נוספים ייעודיים", amountExact: earmarkedOtherAssets.negate().toExactString(), sourceFactKeys: ["earmarkedOtherAssets"], assumptionKeys: [] });
    }

    const grossNeed = Money.sum([
      immediateExpenses,
      debtPayoffNeed,
      incomeReplacementNeed,
      educationNeed,
      specialDependentNeed,
      otherGoals,
    ]);
    const availableResources = Money.sum([
      existingLifeInsurance,
      survivorBenefitsPresentValue,
      earmarkedLiquidAssets,
      earmarkedOtherAssets,
    ]);

    const rawSignedSum = grossNeed.subtract(availableResources);
    const gap = Money.max(zero, rawSignedSum);

    if (rawSignedSum.isNegative()) {
      // Keeps the trace's line-sum invariant true even though the
      // headline result is floored at zero (PRD §43 safety test: never a
      // negative gap).
      lines.push({
        key: "floor_at_zero",
        label: "התאמת רצפה — הכיסוי הקיים עולה על הצורך, אין פער שלילי",
        amountExact: rawSignedSum.negate().toExactString(),
        sourceFactKeys: [],
        assumptionKeys: [],
      });
    }

    // ---- Confidence (PRD §9) ----
    const criticalMissing = missingFacts.some((f) =>
      ["householdRequiredAnnualSpend", "survivorReliableAnnualIncome", "existingLifeInsurance", "youngestDependentAge"].includes(f),
    );
    const confidence: "high" | "medium" | "low" = criticalMissing ? "low" : missingFacts.length > 0 ? "medium" : "high";

    const widenPct = confidence === "low" ? 0.25 : confidence === "medium" ? 0.1 : 0;
    const recommendedRange = {
      min: gap.multiply(1 - widenPct),
      target: gap,
      max: gap.multiply(1 + widenPct),
    };

    // ---- Reason codes (PRD §40) ----
    const reasonCodes: string[] = [];
    if (input.dependentCount > 0) reasonCodes.push("LIFE_DEPENDENTS_PRESENT");
    if (!incomeReplacementNeed.isZero()) reasonCodes.push("LIFE_INCOME_DEPENDENCY");
    if (!debtPayoffNeed.isZero()) reasonCodes.push("LIFE_MORTGAGE_GAP");
    if (gap.isZero() && !grossNeed.isZero()) reasonCodes.push("LIFE_EXISTING_COVERAGE_SUFFICIENT");

    // ---- Review triggers (PRD §22) ----
    const reviewTriggers: string[] = ["annual_review", "income_change_20pct"];
    if (input.mortgage) reviewTriggers.push("mortgage_repaid");
    if (input.dependentCount > 0) reviewTriggers.push("child_independent");

    const trace: CalculationTrace = {
      id: newId(),
      calculatorKey: this.key,
      configVersion: config.version,
      createdAt: new Date().toISOString(),
      lines,
      resultExact: gap.toExactString(),
    };

    return {
      result: {
        grossNeed,
        availableResources,
        gap,
        recommendedRange,
        horizonYears,
        reasonCodes,
        reviewTriggers,
        missingFacts,
        assumptions,
        confidence,
      },
      trace,
    };
  }
}
