import { Money, type Assumption, type CalculationTrace, type CalculationTraceLine } from "@insurance-advisor/shared";
import type { EngineConfig } from "@insurance-advisor/config";
import type { CalculatorResult, NeedsCalculator } from "./calculator.js";

/**
 * Critical Illness Needs Calculator — PRD §14. A lump-sum buffer, not a
 * monthly benefit (that's §13's calculator) — same unknown-stays-unknown
 * discipline as the other two calculators in this milestone.
 */
export const RECOVERY_DURATION_OPTIONS_MONTHS = [3, 6, 12, 18, 24] as const;
export type RecoveryDurationMonths = (typeof RECOVERY_DURATION_OPTIONS_MONTHS)[number];

export type CriticalIllnessCalculatorInput = {
  recoveryDurationMonths: number;

  monthlyEssentialExpenses?: Money;
  /** e.g. sick pay, a spouse's continuing salary — reduces IncomeGapDuringRecovery (PRD §14). */
  reliableMonthlyIncomeDuringRecovery?: Money;

  /** Lump-sum buffers, PRD §14's Proposed Needs Model. All known-zero-safe: "no extra buffer" is a real answer, not usually an unknown. */
  recoveryExpenseBuffer?: Money;
  nonCoveredMedicalBuffer?: Money;
  debtServiceBuffer?: Money;
  householdSupportBuffer?: Money;

  existingCriticalIllnessCoverage?: Money;
};

export type CriticalIllnessResult = {
  need: Money;
  existingCoverage: Money;
  gap: Money;
  recoveryDurationMonths: number;
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

export class CriticalIllnessCalculator implements NeedsCalculator<CriticalIllnessCalculatorInput, CriticalIllnessResult> {
  readonly key = "critical_illness";

  calculate(input: CriticalIllnessCalculatorInput, config: EngineConfig): CalculatorResult<CriticalIllnessResult> {
    const missingFacts: string[] = [];
    const assumptions: Assumption[] = [];
    const lines: CalculationTraceLine[] = [];
    const zero = Money.zero();

    // ---- Income gap during recovery ----
    const monthlyExpenses = resolveMoney(
      input.monthlyEssentialExpenses,
      "monthlyEssentialExpenses",
      "Monthly essential expenses unknown — assumed 0 pending data (understates the need).",
      missingFacts,
      assumptions,
    );
    const reliableIncome = input.reliableMonthlyIncomeDuringRecovery ?? zero;
    const monthlyGapDuringRecovery = Money.max(zero, monthlyExpenses.subtract(reliableIncome));
    const incomeGapDuringRecovery = monthlyGapDuringRecovery.multiply(input.recoveryDurationMonths);
    if (!incomeGapDuringRecovery.isZero()) {
      lines.push({
        key: "income_gap_during_recovery",
        label: `פער הכנסה בתקופת ההתאוששות (${input.recoveryDurationMonths} חודשים)`,
        amountExact: incomeGapDuringRecovery.toExactString(),
        sourceFactKeys: ["monthlyEssentialExpenses", "reliableMonthlyIncomeDuringRecovery"],
        assumptionKeys: [],
        formula: "max(0, monthlyEssentialExpenses - reliableMonthlyIncomeDuringRecovery) * recoveryDurationMonths",
      });
    }

    const recoveryExpenseBuffer = input.recoveryExpenseBuffer ?? zero;
    if (!recoveryExpenseBuffer.isZero()) {
      lines.push({ key: "recovery_expense_buffer", label: "רזרבת הוצאות התאוששות", amountExact: recoveryExpenseBuffer.toExactString(), sourceFactKeys: ["recoveryExpenseBuffer"], assumptionKeys: [] });
    }
    const nonCoveredMedicalBuffer = input.nonCoveredMedicalBuffer ?? zero;
    if (!nonCoveredMedicalBuffer.isZero()) {
      lines.push({ key: "non_covered_medical_buffer", label: "השתתפות עצמית/הוצאות רפואיות שאינן מכוסות", amountExact: nonCoveredMedicalBuffer.toExactString(), sourceFactKeys: ["nonCoveredMedicalBuffer"], assumptionKeys: [] });
    }
    const debtServiceBuffer = input.debtServiceBuffer ?? zero;
    if (!debtServiceBuffer.isZero()) {
      lines.push({ key: "debt_service_buffer", label: "רזרבת שירות חוב", amountExact: debtServiceBuffer.toExactString(), sourceFactKeys: ["debtServiceBuffer"], assumptionKeys: [] });
    }
    const householdSupportBuffer = input.householdSupportBuffer ?? zero;
    if (!householdSupportBuffer.isZero()) {
      lines.push({ key: "household_support_buffer", label: "רזרבת תמיכה במשק הבית", amountExact: householdSupportBuffer.toExactString(), sourceFactKeys: ["householdSupportBuffer"], assumptionKeys: [] });
    }

    const existingCoverage = resolveMoney(
      input.existingCriticalIllnessCoverage,
      "existingCriticalIllnessCoverage",
      "Existing critical illness coverage unknown — assumed 0 pending data (widens, not narrows, the gap).",
      missingFacts,
      assumptions,
    );
    if (!existingCoverage.isZero()) {
      lines.push({ key: "existing_coverage_offset", label: "כיסוי מחלות קשות קיים", amountExact: existingCoverage.negate().toExactString(), sourceFactKeys: ["existingCriticalIllnessCoverage"], assumptionKeys: [] });
    }

    const need = Money.sum([incomeGapDuringRecovery, recoveryExpenseBuffer, nonCoveredMedicalBuffer, debtServiceBuffer, householdSupportBuffer]);
    const rawSignedSum = need.subtract(existingCoverage);
    const gap = Money.max(zero, rawSignedSum);

    if (rawSignedSum.isNegative()) {
      lines.push({
        key: "floor_at_zero",
        label: "התאמת רצפה — הכיסוי הקיים עולה על הצורך, אין פער שלילי",
        amountExact: rawSignedSum.negate().toExactString(),
        sourceFactKeys: [],
        assumptionKeys: [],
      });
    }

    const criticalMissing = missingFacts.some((f) => ["monthlyEssentialExpenses", "existingCriticalIllnessCoverage"].includes(f));
    const confidence: "high" | "medium" | "low" = criticalMissing ? "low" : missingFacts.length > 0 ? "medium" : "high";

    const reasonCodes: string[] = [];
    if (!gap.isZero()) reasonCodes.push("CI_LOW_LIQUID_BUFFER");
    if (!existingCoverage.isZero()) reasonCodes.push("CI_EXISTING_COVERAGE_PRESENT");

    const reviewTriggers = ["annual_review", "major_health_change"];

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
        need,
        existingCoverage,
        gap,
        recoveryDurationMonths: input.recoveryDurationMonths,
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
   * PRD §14's closing line: "המערכת תציג Scenario של מספר משך התאוששות" —
   * runs the same input across several recovery-duration assumptions so
   * the UI can show them side by side, rather than committing to one.
   */
  calculateScenarios(
    input: Omit<CriticalIllnessCalculatorInput, "recoveryDurationMonths">,
    config: EngineConfig,
    durations: readonly number[] = RECOVERY_DURATION_OPTIONS_MONTHS,
  ): Array<{ recoveryDurationMonths: number } & CalculatorResult<CriticalIllnessResult>> {
    return durations.map((recoveryDurationMonths) => ({
      recoveryDurationMonths,
      ...this.calculate({ ...input, recoveryDurationMonths }, config),
    }));
  }
}
