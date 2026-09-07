import { describe, expect, it } from "vitest";
import { Money } from "@insurance-advisor/shared";
import { STARTER_ENGINE_CONFIG } from "@insurance-advisor/config";
import {
  CriticalIllnessCalculator,
  RECOVERY_DURATION_OPTIONS_MONTHS,
  type CriticalIllnessCalculatorInput,
} from "./critical-illness-calculator.js";

const calculator = new CriticalIllnessCalculator();

describe("CriticalIllnessCalculator (PRD §14)", () => {
  it("1. everything zero/known -> zero need, zero gap", () => {
    const input: CriticalIllnessCalculatorInput = {
      recoveryDurationMonths: 6,
      monthlyEssentialExpenses: Money.zero(),
      existingCriticalIllnessCoverage: Money.zero(),
    };
    const { result } = calculator.calculate(input, STARTER_ENGINE_CONFIG);
    expect(result.need.isZero()).toBe(true);
    expect(result.gap.isZero()).toBe(true);
  });

  it("2. income gap during recovery scales with recovery duration", () => {
    const base: CriticalIllnessCalculatorInput = {
      recoveryDurationMonths: 6,
      monthlyEssentialExpenses: Money.fromNumber(10_000),
      existingCriticalIllnessCoverage: Money.zero(),
    };
    const short = calculator.calculate({ ...base, recoveryDurationMonths: 3 }, STARTER_ENGINE_CONFIG);
    const long = calculator.calculate({ ...base, recoveryDurationMonths: 12 }, STARTER_ENGINE_CONFIG);
    expect(short.result.need.toExactString()).toBe("30000.00");
    expect(long.result.need.toExactString()).toBe("120000.00");
  });

  it("3. reliable income during recovery reduces the income gap", () => {
    const input: CriticalIllnessCalculatorInput = {
      recoveryDurationMonths: 6,
      monthlyEssentialExpenses: Money.fromNumber(10_000),
      reliableMonthlyIncomeDuringRecovery: Money.fromNumber(4_000),
      existingCriticalIllnessCoverage: Money.zero(),
    };
    const { result } = calculator.calculate(input, STARTER_ENGINE_CONFIG);
    expect(result.need.toExactString()).toBe("36000.00"); // (10000-4000)*6
  });

  it("4. each lump-sum buffer adds independently to the need", () => {
    const input: CriticalIllnessCalculatorInput = {
      recoveryDurationMonths: 6,
      monthlyEssentialExpenses: Money.zero(),
      recoveryExpenseBuffer: Money.fromNumber(20_000),
      nonCoveredMedicalBuffer: Money.fromNumber(15_000),
      debtServiceBuffer: Money.fromNumber(10_000),
      householdSupportBuffer: Money.fromNumber(5_000),
      existingCriticalIllnessCoverage: Money.zero(),
    };
    const { result } = calculator.calculate(input, STARTER_ENGINE_CONFIG);
    expect(result.need.toExactString()).toBe("50000.00");
  });

  it("5. existing coverage partially offsets the need", () => {
    const input: CriticalIllnessCalculatorInput = {
      recoveryDurationMonths: 6,
      monthlyEssentialExpenses: Money.fromNumber(10_000),
      existingCriticalIllnessCoverage: Money.fromNumber(20_000),
    };
    const { result } = calculator.calculate(input, STARTER_ENGINE_CONFIG);
    expect(result.need.toExactString()).toBe("60000.00");
    expect(result.gap.toExactString()).toBe("40000.00");
  });

  it("6. existing coverage exceeding need floors the gap at zero, never negative", () => {
    const input: CriticalIllnessCalculatorInput = {
      recoveryDurationMonths: 3,
      monthlyEssentialExpenses: Money.fromNumber(5_000),
      existingCriticalIllnessCoverage: Money.fromNumber(100_000),
    };
    const { result, trace } = calculator.calculate(input, STARTER_ENGINE_CONFIG);
    expect(result.gap.isZero()).toBe(true);
    expect(result.gap.isNegative()).toBe(false);
    expect(result.reasonCodes).not.toContain("CI_LOW_LIQUID_BUFFER");
    expect(result.reasonCodes).toContain("CI_EXISTING_COVERAGE_PRESENT");
    expect(trace.lines.find((l) => l.key === "floor_at_zero")).toBeDefined();
  });

  it("7. explicit zero existing coverage is not treated as missing data", () => {
    const input: CriticalIllnessCalculatorInput = {
      recoveryDurationMonths: 6,
      monthlyEssentialExpenses: Money.fromNumber(8_000),
      existingCriticalIllnessCoverage: Money.zero(),
    };
    const { result } = calculator.calculate(input, STARTER_ENGINE_CONFIG);
    expect(result.missingFacts).not.toContain("existingCriticalIllnessCoverage");
    expect(result.confidence).toBe("high");
  });

  it("8. missing monthly expenses lowers confidence and is flagged, not silently zeroed", () => {
    const input: CriticalIllnessCalculatorInput = { recoveryDurationMonths: 6, existingCriticalIllnessCoverage: Money.zero() };
    const { result } = calculator.calculate(input, STARTER_ENGINE_CONFIG);
    expect(result.missingFacts).toContain("monthlyEssentialExpenses");
    expect(result.confidence).toBe("low");
    expect(result.assumptions.some((a) => a.key === "monthlyEssentialExpenses")).toBe(true);
  });

  it("9. calculateScenarios runs every standard recovery duration (PRD §14 scenario display)", () => {
    const scenarios = calculator.calculateScenarios(
      { monthlyEssentialExpenses: Money.fromNumber(10_000), existingCriticalIllnessCoverage: Money.zero() },
      STARTER_ENGINE_CONFIG,
    );
    expect(scenarios.map((s) => s.recoveryDurationMonths)).toEqual([...RECOVERY_DURATION_OPTIONS_MONTHS]);
    // longer recovery -> strictly larger need, since it's a straight multiple of monthly expenses
    for (let i = 1; i < scenarios.length; i++) {
      const prevResult = scenarios[i - 1]?.result;
      const currResult = scenarios[i]?.result;
      expect(prevResult).toBeDefined();
      expect(currResult).toBeDefined();
      expect(currResult?.need.greaterThan(prevResult?.need ?? Money.zero())).toBe(true);
    }
  });

  it("10. reproduces a hand-computed combined scenario exactly", () => {
    const input: CriticalIllnessCalculatorInput = {
      recoveryDurationMonths: 12,
      monthlyEssentialExpenses: Money.fromNumber(15_000),
      reliableMonthlyIncomeDuringRecovery: Money.fromNumber(5_000),
      recoveryExpenseBuffer: Money.fromNumber(30_000),
      nonCoveredMedicalBuffer: Money.fromNumber(25_000),
      existingCriticalIllnessCoverage: Money.fromNumber(80_000),
    };
    // income gap = (15000-5000)*12 = 120000; need = 120000+30000+25000 = 175000; gap = 175000-80000 = 95000
    const { result } = calculator.calculate(input, STARTER_ENGINE_CONFIG);
    expect(result.need.toExactString()).toBe("175000.00");
    expect(result.gap.toExactString()).toBe("95000.00");
  });
});
