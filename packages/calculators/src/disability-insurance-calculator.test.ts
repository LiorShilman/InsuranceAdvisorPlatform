import { describe, expect, it } from "vitest";
import { Money } from "@insurance-advisor/shared";
import { STARTER_ENGINE_CONFIG } from "@insurance-advisor/config";
import { DisabilityInsuranceCalculator, type DisabilityCalculatorInput } from "./disability-insurance-calculator.js";

const calculator = new DisabilityInsuranceCalculator();

describe("DisabilityInsuranceCalculator (PRD §13)", () => {
  it("1. no expenses, no debt, no dependents -> zero required income, zero gap", () => {
    const { result } = calculator.calculate(
      { essentialMonthlyExpenses: Money.zero(), existingNetExpectedDisabilityIncome: Money.zero() },
      STARTER_ENGINE_CONFIG,
    );
    expect(result.requiredMonthlyIncome.isZero()).toBe(true);
    expect(result.monthlyGap.isZero()).toBe(true);
  });

  it("2. essential expenses alone, no existing coverage -> gap equals expenses", () => {
    const input: DisabilityCalculatorInput = {
      essentialMonthlyExpenses: Money.fromNumber(12_000),
      existingNetExpectedDisabilityIncome: Money.zero(),
    };
    const { result } = calculator.calculate(input, STARTER_ENGINE_CONFIG);
    expect(result.monthlyGap.toExactString()).toBe("12000.00");
    expect(result.reasonCodes).toContain("DI_INCOME_DEPENDENCY");
    expect(result.reasonCodes).toContain("DI_EXISTING_MONTHLY_GAP");
  });

  it("3. debt payments increase the required monthly income", () => {
    const input: DisabilityCalculatorInput = {
      essentialMonthlyExpenses: Money.fromNumber(10_000),
      debtMonthlyPayments: Money.fromNumber(4_000),
      existingNetExpectedDisabilityIncome: Money.zero(),
    };
    const { result } = calculator.calculate(input, STARTER_ENGINE_CONFIG);
    expect(result.requiredMonthlyIncome.toExactString()).toBe("14000.00");
  });

  it("4. dependents' monthly needs increase the required monthly income", () => {
    const input: DisabilityCalculatorInput = {
      essentialMonthlyExpenses: Money.fromNumber(10_000),
      dependentsMonthlyNeeds: Money.fromNumber(2_500),
      existingNetExpectedDisabilityIncome: Money.zero(),
    };
    const { result } = calculator.calculate(input, STARTER_ENGINE_CONFIG);
    expect(result.requiredMonthlyIncome.toExactString()).toBe("12500.00");
  });

  it("5. reliable income during disability (e.g. spouse's salary) reduces the required income", () => {
    const input: DisabilityCalculatorInput = {
      essentialMonthlyExpenses: Money.fromNumber(20_000),
      reliableMonthlyIncomeDuringDisability: Money.fromNumber(8_000),
      existingNetExpectedDisabilityIncome: Money.zero(),
    };
    const { result } = calculator.calculate(input, STARTER_ENGINE_CONFIG);
    expect(result.requiredMonthlyIncome.toExactString()).toBe("12000.00");
  });

  it("6. existing disability income partially offsets the need", () => {
    const input: DisabilityCalculatorInput = {
      essentialMonthlyExpenses: Money.fromNumber(20_000),
      existingNetExpectedDisabilityIncome: Money.fromNumber(7_000),
    };
    const { result } = calculator.calculate(input, STARTER_ENGINE_CONFIG);
    expect(result.requiredMonthlyIncome.toExactString()).toBe("20000.00");
    expect(result.monthlyGap.toExactString()).toBe("13000.00");
  });

  it("7. existing disability income covers the full need -> gap floors at zero, never negative", () => {
    const input: DisabilityCalculatorInput = {
      essentialMonthlyExpenses: Money.fromNumber(10_000),
      existingNetExpectedDisabilityIncome: Money.fromNumber(15_000),
    };
    const { result, trace } = calculator.calculate(input, STARTER_ENGINE_CONFIG);
    expect(result.monthlyGap.isZero()).toBe(true);
    expect(result.monthlyGap.isNegative()).toBe(false);
    expect(result.reasonCodes).not.toContain("DI_EXISTING_MONTHLY_GAP");
    expect(trace.lines.find((l) => l.key === "floor_at_zero")).toBeDefined();
  });

  it("8. explicit zero existing coverage is NOT treated as missing data", () => {
    const input: DisabilityCalculatorInput = {
      essentialMonthlyExpenses: Money.fromNumber(10_000),
      existingNetExpectedDisabilityIncome: Money.zero(),
      dependentsMonthlyNeeds: Money.zero(),
      currentAge: 40,
      retirementAge: 67,
    };
    const { result } = calculator.calculate(input, STARTER_ENGINE_CONFIG);
    expect(result.missingFacts).not.toContain("existingNetExpectedDisabilityIncome");
    expect(result.missingFacts).not.toContain("dependentsMonthlyNeeds");
    expect(result.confidence).toBe("high");
  });

  it("9. missing essential expenses lowers confidence and is flagged, not silently zeroed", () => {
    const input: DisabilityCalculatorInput = { existingNetExpectedDisabilityIncome: Money.zero() };
    const { result } = calculator.calculate(input, STARTER_ENGINE_CONFIG);
    expect(result.missingFacts).toContain("essentialMonthlyExpenses");
    expect(result.confidence).toBe("low");
    expect(result.assumptions.some((a) => a.key === "essentialMonthlyExpenses")).toBe(true);
  });

  it("9b. missing dependents' monthly needs is flagged, not silently zeroed (unlike debt)", () => {
    const input: DisabilityCalculatorInput = {
      essentialMonthlyExpenses: Money.fromNumber(10_000),
      existingNetExpectedDisabilityIncome: Money.zero(),
    };
    const { result } = calculator.calculate(input, STARTER_ENGINE_CONFIG);
    expect(result.missingFacts).toContain("dependentsMonthlyNeeds");
    expect(result.assumptions.some((a) => a.key === "dependentsMonthlyNeeds")).toBe(true);
    // debtMonthlyPayments, by contrast, is a real known-zero-safe default — never flagged.
    expect(result.missingFacts).not.toContain("debtMonthlyPayments");
  });

  it("10. recommended duration is years until retirement when both ages are known", () => {
    const input: DisabilityCalculatorInput = {
      essentialMonthlyExpenses: Money.zero(),
      existingNetExpectedDisabilityIncome: Money.zero(),
      currentAge: 45,
      retirementAge: 67,
    };
    const { result } = calculator.calculate(input, STARTER_ENGINE_CONFIG);
    expect(result.recommendedDurationYears).toBe(22);
  });

  it("11. product maximum duration caps the recommended duration (PRD §13.4)", () => {
    const input: DisabilityCalculatorInput = {
      essentialMonthlyExpenses: Money.zero(),
      existingNetExpectedDisabilityIncome: Money.zero(),
      currentAge: 45,
      retirementAge: 67,
      productMaximumDurationYears: 15,
    };
    const { result } = calculator.calculate(input, STARTER_ENGINE_CONFIG);
    expect(result.recommendedDurationYears).toBe(15);
  });

  it("12. missing age data leaves duration undefined and flags both fields as missing", () => {
    const input: DisabilityCalculatorInput = {
      essentialMonthlyExpenses: Money.zero(),
      existingNetExpectedDisabilityIncome: Money.zero(),
    };
    const { result } = calculator.calculate(input, STARTER_ENGINE_CONFIG);
    expect(result.recommendedDurationYears).toBeUndefined();
    expect(result.missingFacts).toContain("currentAge");
    expect(result.missingFacts).toContain("retirementAge");
  });

  it("13. combined scenario matches a hand-computed gap exactly", () => {
    const input: DisabilityCalculatorInput = {
      essentialMonthlyExpenses: Money.fromNumber(15_000),
      debtMonthlyPayments: Money.fromNumber(5_200),
      dependentsMonthlyNeeds: Money.fromNumber(3_000),
      reliableMonthlyIncomeDuringDisability: Money.fromNumber(6_000),
      existingNetExpectedDisabilityIncome: Money.fromNumber(4_000),
      currentAge: 38,
      retirementAge: 67,
    };
    // required = 15000 + 5200 + 3000 - 6000 = 17200; gap = 17200 - 4000 = 13200
    const { result } = calculator.calculate(input, STARTER_ENGINE_CONFIG);
    expect(result.requiredMonthlyIncome.toExactString()).toBe("17200.00");
    expect(result.monthlyGap.toExactString()).toBe("13200.00");
    expect(result.recommendedDurationYears).toBe(29);
  });
});
