import { Money, type Assumption, type CalculationTrace, type CalculationTraceLine } from "@insurance-advisor/shared";
import type { ReviewTrigger } from "@insurance-advisor/domain";
import type { EngineConfig } from "@insurance-advisor/config";
import type { CalculatorResult, NeedsCalculator } from "./calculator.js";

/**
 * Income Protection / Disability Needs Calculator — PRD §13. Same
 * unknown-stays-unknown discipline as the life calculator (§48, PRD rule
 * 13): every optional `Money | undefined` field means "not yet collected"
 * and is defaulted to zero only via `resolveMoney`, which always also logs
 * a missingFacts entry + Assumption. Monthly-benefit need, not a lump sum
 * — no PV summation required.
 */
export type DisabilityCalculatorInput = {
  essentialMonthlyExpenses?: Money;
  /** Known-zero-safe: "no debt" is a real, common state, not usually an unknown (PRD §13.1). */
  debtMonthlyPayments?: Money;
  dependentsMonthlyNeeds?: Money;
  /** Income that would keep arriving during disability — e.g. a spouse's own salary (PRD §13.1). */
  reliableMonthlyIncomeDuringDisability?: Money;
  /** Net of pension disability + private income protection + employer coverage, after offsets/waiting period (PRD §13.2) — modeled as one aggregate figure in this milestone; see docs/ASSUMPTIONS.md. */
  existingNetExpectedDisabilityIncome?: Money;

  currentAge?: number;
  retirementAge?: number;
  /** Product-specific cap — belongs to Product Matching once it exists (PRD §13.4); an optional override here in the meantime. */
  productMaximumDurationYears?: number;
};

export type DisabilityInsuranceResult = {
  requiredMonthlyIncome: Money;
  existingNetExpectedDisabilityIncome: Money;
  monthlyGap: Money;
  recommendedDurationYears?: number;
  reasonCodes: string[];
  reviewTriggers: ReviewTrigger[];
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

export class DisabilityInsuranceCalculator
  implements NeedsCalculator<DisabilityCalculatorInput, DisabilityInsuranceResult>
{
  readonly key = "disability_income_protection";

  calculate(input: DisabilityCalculatorInput, config: EngineConfig): CalculatorResult<DisabilityInsuranceResult> {
    const missingFacts: string[] = [];
    const assumptions: Assumption[] = [];
    const lines: CalculationTraceLine[] = [];
    const zero = Money.zero();

    // ---- Required monthly income (PRD §13.1) ----
    const essential = resolveMoney(
      input.essentialMonthlyExpenses,
      "essentialMonthlyExpenses",
      "הוצאות חודשיות חיוניות אינן ידועות — הונחו כ-0 עד להשלמת הנתון (מקטין את הצורך המחושב מתחת לצורך האמיתי).",
      missingFacts,
      assumptions,
    );
    if (!essential.isZero()) {
      lines.push({ key: "essential_expenses", label: "הוצאות חודשיות חיוניות", amountExact: essential.toExactString(), sourceFactKeys: ["essentialMonthlyExpenses"], assumptionKeys: [] });
    }

    const debt = input.debtMonthlyPayments ?? zero;
    if (!debt.isZero()) {
      lines.push({ key: "debt_payments", label: "תשלומי חובות חודשיים", amountExact: debt.toExactString(), sourceFactKeys: ["debtMonthlyPayments"], assumptionKeys: [] });
    }

    // Unlike debtMonthlyPayments (where "no debt" is a common, real zero
    // state), an undefined dependentsMonthlyNeeds is genuinely unknown, not
    // safely zero — a household with dependents almost certainly has some
    // ongoing cost for them. Adapters that know the household has zero
    // dependents pass an explicit Money.zero() (a real answer, not a gap);
    // resolveMoney only fires — and only then logs a missingFacts entry —
    // when the value is truly undefined.
    const dependentsNeeds = resolveMoney(
      input.dependentsMonthlyNeeds,
      "dependentsMonthlyNeeds",
      "צרכי תלויים חודשיים אינם ידועים — הונחו כ-0 עד להשלמת הנתון (מקטין את הצורך המחושב אם למשפחה יש תלויים).",
      missingFacts,
      assumptions,
    );
    if (!dependentsNeeds.isZero()) {
      lines.push({ key: "dependents_needs", label: "צרכי תלויים חודשיים", amountExact: dependentsNeeds.toExactString(), sourceFactKeys: ["dependentsMonthlyNeeds"], assumptionKeys: [] });
    }

    const reliableIncome = input.reliableMonthlyIncomeDuringDisability ?? zero;
    if (!reliableIncome.isZero()) {
      lines.push({ key: "reliable_income_offset", label: "הכנסה חודשית שתמשיך להתקבל", amountExact: reliableIncome.negate().toExactString(), sourceFactKeys: ["reliableMonthlyIncomeDuringDisability"], assumptionKeys: [] });
    }

    const existingNetExpectedDisabilityIncome = resolveMoney(
      input.existingNetExpectedDisabilityIncome,
      "existingNetExpectedDisabilityIncome",
      "הכנסה נטו קיימת צפויה מאבדן כושר עבודה אינה ידועה — הונחה כ-0 עד להשלמת הנתון (מרחיב, ולא מצמצם, את הפער).",
      missingFacts,
      assumptions,
    );
    if (!existingNetExpectedDisabilityIncome.isZero()) {
      lines.push({ key: "existing_disability_income_offset", label: "כיסוי אבדן כושר עבודה קיים (נטו)", amountExact: existingNetExpectedDisabilityIncome.negate().toExactString(), sourceFactKeys: ["existingNetExpectedDisabilityIncome"], assumptionKeys: [] });
    }

    const requiredMonthlyIncome = Money.max(zero, essential.add(debt).add(dependentsNeeds).subtract(reliableIncome));

    const rawSignedSum = essential.add(debt).add(dependentsNeeds).subtract(reliableIncome).subtract(existingNetExpectedDisabilityIncome);
    const monthlyGap = Money.max(zero, rawSignedSum);

    if (rawSignedSum.isNegative()) {
      lines.push({
        key: "floor_at_zero",
        label: "התאמת רצפה — הכיסוי הקיים עולה על הצורך, אין פער שלילי",
        amountExact: rawSignedSum.negate().toExactString(),
        sourceFactKeys: [],
        assumptionKeys: [],
      });
    }

    // ---- Duration (PRD §13.4) ----
    let recommendedDurationYears: number | undefined;
    if (input.currentAge === undefined) missingFacts.push("currentAge");
    if (input.retirementAge === undefined) missingFacts.push("retirementAge");
    if (input.currentAge !== undefined && input.retirementAge !== undefined) {
      const yearsToRetirement = Math.max(0, input.retirementAge - input.currentAge);
      recommendedDurationYears =
        input.productMaximumDurationYears !== undefined
          ? Math.min(yearsToRetirement, input.productMaximumDurationYears)
          : yearsToRetirement;
    }

    // ---- Confidence (PRD §9) ----
    const criticalMissing = missingFacts.some((f) =>
      ["essentialMonthlyExpenses", "existingNetExpectedDisabilityIncome", "currentAge", "retirementAge"].includes(f),
    );
    const confidence: "high" | "medium" | "low" = criticalMissing ? "low" : missingFacts.length > 0 ? "medium" : "high";

    // ---- Reason codes (PRD §40) ----
    const reasonCodes: string[] = [];
    if (!requiredMonthlyIncome.isZero()) reasonCodes.push("DI_INCOME_DEPENDENCY");
    if (!monthlyGap.isZero()) reasonCodes.push("DI_EXISTING_MONTHLY_GAP");

    const reviewTriggers: ReviewTrigger[] = ["annual_review", "income_change_20pct", "job_change"];

    const trace: CalculationTrace = {
      id: newId(),
      calculatorKey: this.key,
      configVersion: config.version,
      createdAt: new Date().toISOString(),
      lines,
      resultExact: monthlyGap.toExactString(),
    };

    return {
      result: {
        requiredMonthlyIncome,
        existingNetExpectedDisabilityIncome,
        monthlyGap,
        recommendedDurationYears,
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
