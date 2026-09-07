import { describe, expect, it } from "vitest";
import { Money } from "@insurance-advisor/shared";
import { STARTER_ENGINE_CONFIG, type EngineConfig } from "@insurance-advisor/config";
import {
  LongTermCareCalculator,
  LTC_DURATION_SCENARIOS_YEARS,
  type LongTermCareCalculatorInput,
} from "./long-term-care-calculator.js";

const calculator = new LongTermCareCalculator();
const zeroDiscountConfig: EngineConfig = {
  ...STARTER_ENGINE_CONFIG,
  financialAssumptions: { ...STARTER_ENGINE_CONFIG.financialAssumptions, realDiscountRate: 0 },
};

describe("LongTermCareCalculator (PRD §16)", () => {
  it("1. cost fully covered by benefits + self-funding -> zero monthly gap, zero capital need", () => {
    const input: LongTermCareCalculatorInput = {
      expectedDurationYears: 3,
      expectedMonthlyCareCost: Money.fromNumber(20_000),
      reliableMonthlyLTCBenefits: Money.fromNumber(12_000),
      monthlySelfFundingCapacity: Money.fromNumber(8_000),
    };
    const { result } = calculator.calculate(input, STARTER_ENGINE_CONFIG);
    expect(result.monthlyGap.isZero()).toBe(true);
    expect(result.capitalNeed.isZero()).toBe(true);
  });

  it("2. reproduces exact undiscounted arithmetic (real discount rate 0)", () => {
    const input: LongTermCareCalculatorInput = {
      expectedDurationYears: 3,
      expectedMonthlyCareCost: Money.fromNumber(20_000),
      reliableMonthlyLTCBenefits: Money.fromNumber(6_000),
      monthlySelfFundingCapacity: Money.fromNumber(4_000),
    };
    // monthlyGap = 20000-6000-4000 = 10000; annualGap = 120000; capital (0% discount, 3 years) = 360000
    const { result } = calculator.calculate(input, zeroDiscountConfig);
    expect(result.monthlyGap.toExactString()).toBe("10000.00");
    expect(result.capitalNeed.toExactString()).toBe("360000.00");
  });

  it("3. capital need scales with expected duration", () => {
    const base: LongTermCareCalculatorInput = {
      expectedDurationYears: 1,
      expectedMonthlyCareCost: Money.fromNumber(15_000),
      reliableMonthlyLTCBenefits: Money.zero(),
      monthlySelfFundingCapacity: Money.zero(),
    };
    const short = calculator.calculate({ ...base, expectedDurationYears: 1 }, zeroDiscountConfig);
    const long = calculator.calculate({ ...base, expectedDurationYears: 5 }, zeroDiscountConfig);
    expect(long.result.capitalNeed.greaterThan(short.result.capitalNeed)).toBe(true);
    expect(long.result.capitalNeed.toExactString()).toBe("900000.00"); // 15000*12*5
  });

  it("4. reliable LTC benefits reduce the monthly gap", () => {
    const withoutBenefits = calculator.calculate(
      { expectedDurationYears: 2, expectedMonthlyCareCost: Money.fromNumber(18_000), reliableMonthlyLTCBenefits: Money.zero(), monthlySelfFundingCapacity: Money.zero() },
      STARTER_ENGINE_CONFIG,
    );
    const withBenefits = calculator.calculate(
      { expectedDurationYears: 2, expectedMonthlyCareCost: Money.fromNumber(18_000), reliableMonthlyLTCBenefits: Money.fromNumber(10_000), monthlySelfFundingCapacity: Money.zero() },
      STARTER_ENGINE_CONFIG,
    );
    expect(withBenefits.result.monthlyGap.lessThan(withoutBenefits.result.monthlyGap)).toBe(true);
  });

  it("5. self-funding capacity exceeding cost floors the gap at zero and flags LTC_SELF_FUNDING_CAPACITY_HIGH", () => {
    const input: LongTermCareCalculatorInput = {
      expectedDurationYears: 3,
      expectedMonthlyCareCost: Money.fromNumber(10_000),
      reliableMonthlyLTCBenefits: Money.zero(),
      monthlySelfFundingCapacity: Money.fromNumber(50_000),
    };
    const { result } = calculator.calculate(input, STARTER_ENGINE_CONFIG);
    expect(result.monthlyGap.isZero()).toBe(true);
    expect(result.monthlyGap.isNegative()).toBe(false);
    expect(result.reasonCodes).toContain("LTC_SELF_FUNDING_CAPACITY_HIGH");
    expect(result.reasonCodes).not.toContain("LTC_MONTHLY_GAP");
  });

  it("6. missing care cost data lowers confidence and is flagged, not silently zeroed", () => {
    const input: LongTermCareCalculatorInput = {
      expectedDurationYears: 3,
      reliableMonthlyLTCBenefits: Money.zero(),
      monthlySelfFundingCapacity: Money.zero(),
    };
    const { result } = calculator.calculate(input, STARTER_ENGINE_CONFIG);
    expect(result.missingFacts).toContain("expectedMonthlyCareCost");
    expect(result.confidence).toBe("low");
    expect(result.assumptions.some((a) => a.key === "expectedMonthlyCareCost")).toBe(true);
  });

  it("7. explicit zero self-funding capacity is not treated as missing data", () => {
    const input: LongTermCareCalculatorInput = {
      expectedDurationYears: 3,
      expectedMonthlyCareCost: Money.fromNumber(10_000),
      reliableMonthlyLTCBenefits: Money.zero(),
      monthlySelfFundingCapacity: Money.zero(),
    };
    const { result } = calculator.calculate(input, STARTER_ENGINE_CONFIG);
    expect(result.missingFacts).not.toContain("monthlySelfFundingCapacity");
    expect(result.confidence).toBe("high");
  });

  it("8. calculateScenarios runs every standard duration and produces a monotonically increasing capital need", () => {
    const scenarios = calculator.calculateScenarios(
      { expectedMonthlyCareCost: Money.fromNumber(12_000), reliableMonthlyLTCBenefits: Money.zero(), monthlySelfFundingCapacity: Money.zero() },
      zeroDiscountConfig,
    );
    expect(scenarios.map((s) => s.expectedDurationYears)).toEqual([...LTC_DURATION_SCENARIOS_YEARS]);
    for (let i = 1; i < scenarios.length; i++) {
      const prev = scenarios[i - 1]?.result;
      const curr = scenarios[i]?.result;
      expect(prev).toBeDefined();
      expect(curr).toBeDefined();
      expect(curr?.capitalNeed.greaterThan(prev?.capitalNeed ?? Money.zero())).toBe(true);
    }
  });
});
