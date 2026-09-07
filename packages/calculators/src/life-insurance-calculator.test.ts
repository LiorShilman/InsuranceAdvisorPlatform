import { describe, expect, it } from "vitest";
import { Money } from "@insurance-advisor/shared";
import { STARTER_ENGINE_CONFIG, type EngineConfig } from "@insurance-advisor/config";
import {
  PERSONA_A_FAMILY_WITH_MORTGAGE,
  PERSONA_E_PRD_WORKED_EXAMPLE,
} from "@insurance-advisor/test-fixtures";
import { LifeInsuranceCalculator, type LifeCalculatorInput } from "./life-insurance-calculator.js";
import { fromHouseholdFixture } from "./demo/household-fixture-adapter.js";

const NOW = new Date("2026-09-07T00:00:00.000Z");
const fromFixture = (fixture: Parameters<typeof fromHouseholdFixture>[0], overrides: Partial<LifeCalculatorInput> = {}) =>
  fromHouseholdFixture(fixture, overrides, NOW);

const calculator = new LifeInsuranceCalculator();

describe("LifeInsuranceCalculator (PRD §12, §48)", () => {
  it("1. single, no dependents, no debt, no override -> zero horizon, zero gap", () => {
    const { result } = calculator.calculate({ dependentCount: 0 }, STARTER_ENGINE_CONFIG);
    expect(result.horizonYears).toBe(0);
    expect(result.gap.isZero()).toBe(true);
    expect(result.reasonCodes).not.toContain("LIFE_DEPENDENTS_PRESENT");
  });

  it("2. married, no children, mortgage drives the horizon", () => {
    const input: LifeCalculatorInput = {
      dependentCount: 0,
      mortgage: { balance: Money.fromNumber(500_000), hasLenderBeneficiaryCoverage: false, yearsUntilPayoff: 20 },
    };
    const { result } = calculator.calculate(input, STARTER_ENGINE_CONFIG);
    expect(result.horizonYears).toBe(20);
    expect(result.gap.greaterThan(Money.zero())).toBe(true);
    expect(result.reasonCodes).toContain("LIFE_MORTGAGE_GAP");
  });

  it("3. married with children (Persona A fixture)", () => {
    const input = fromFixture(PERSONA_A_FAMILY_WITH_MORTGAGE);
    const { result } = calculator.calculate(input, STARTER_ENGINE_CONFIG);
    expect(result.horizonYears).toBeGreaterThan(0);
    expect(result.reasonCodes).toContain("LIFE_DEPENDENTS_PRESENT");
    expect(result.gap.isNegative()).toBe(false);
  });

  it("4. single parent — no survivor spouse income, full spend dependency", () => {
    const input: LifeCalculatorInput = {
      dependentCount: 1,
      youngestDependentAge: 6,
      householdRequiredAnnualSpend: Money.fromNumber(180_000),
      survivorReliableAnnualIncome: Money.zero(),
      existingLifeInsurance: Money.zero(),
      earmarkedLiquidAssets: Money.zero(),
    };
    const { result } = calculator.calculate(input, STARTER_ENGINE_CONFIG);
    expect(result.horizonYears).toBe(15); // 21 - 6
    expect(result.gap.greaterThan(Money.zero())).toBe(true);
    expect(result.confidence).toBe("high");
  });

  it("5. mortgage with no life insurance attached — full balance becomes debt-payoff need", () => {
    const input: LifeCalculatorInput = {
      dependentCount: 0,
      mortgage: { balance: Money.fromNumber(600_000), hasLenderBeneficiaryCoverage: false, yearsUntilPayoff: 10 },
      existingLifeInsurance: Money.zero(),
      earmarkedLiquidAssets: Money.zero(),
    };
    const { result } = calculator.calculate(input, STARTER_ENGINE_CONFIG);
    expect(result.gap.toExactString()).toBe("600000.00");
  });

  it("6. mortgage fully covered by lender-beneficiary insurance -> zero debt-payoff need (PRD §12.5)", () => {
    const input = fromFixture(PERSONA_E_PRD_WORKED_EXAMPLE, { userSelectedProtectionHorizonYears: 16 });
    const { result, trace } = calculator.calculate(input, STARTER_ENGINE_CONFIG);
    expect(trace.lines.find((l) => l.key === "mortgage_offset")).toBeUndefined();
    expect(result.reasonCodes).not.toContain("LIFE_MORTGAGE_GAP");
  });

  it("7. existing coverage greater than calculated need -> gap floors at zero, never negative", () => {
    const input: LifeCalculatorInput = {
      dependentCount: 0,
      immediateExpenses: Money.fromNumber(10_000),
      existingLifeInsurance: Money.fromNumber(5_000_000),
      earmarkedLiquidAssets: Money.zero(),
    };
    const { result, trace } = calculator.calculate(input, STARTER_ENGINE_CONFIG);
    expect(result.gap.isZero()).toBe(true);
    expect(result.gap.isNegative()).toBe(false);
    expect(result.reasonCodes).toContain("LIFE_EXISTING_COVERAGE_SUFFICIENT");
    expect(trace.lines.find((l) => l.key === "floor_at_zero")).toBeDefined();
  });

  it("8. explicit zero liquid assets is NOT treated as missing data (known-zero, not unknown)", () => {
    const input: LifeCalculatorInput = {
      dependentCount: 0,
      immediateExpenses: Money.fromNumber(50_000),
      existingLifeInsurance: Money.zero(),
      earmarkedLiquidAssets: Money.zero(),
    };
    const { result } = calculator.calculate(input, STARTER_ENGINE_CONFIG);
    expect(result.missingFacts).not.toContain("earmarkedLiquidAssets");
    expect(result.confidence).toBe("high");
  });

  it("9. high liquid assets substantially reduce the gap", () => {
    const base: LifeCalculatorInput = {
      dependentCount: 1,
      youngestDependentAge: 10,
      householdRequiredAnnualSpend: Money.fromNumber(200_000),
      survivorReliableAnnualIncome: Money.fromNumber(100_000),
      existingLifeInsurance: Money.zero(),
    };
    const withoutAssets = calculator.calculate({ ...base, earmarkedLiquidAssets: Money.zero() }, STARTER_ENGINE_CONFIG);
    const withAssets = calculator.calculate({ ...base, earmarkedLiquidAssets: Money.fromNumber(2_000_000) }, STARTER_ENGINE_CONFIG);
    expect(withAssets.result.gap.lessThan(withoutAssets.result.gap)).toBe(true);
  });

  it("10. incomplete income data (survivor income unknown) lowers confidence and is flagged, not silently zeroed", () => {
    const input: LifeCalculatorInput = {
      dependentCount: 1,
      youngestDependentAge: 8,
      householdRequiredAnnualSpend: Money.fromNumber(150_000),
      // survivorReliableAnnualIncome intentionally omitted (unknown)
      existingLifeInsurance: Money.zero(),
    };
    const { result } = calculator.calculate(input, STARTER_ENGINE_CONFIG);
    expect(result.missingFacts).toContain("survivorReliableAnnualIncome");
    expect(result.confidence).toBe("low");
    expect(result.assumptions.some((a) => a.key === "survivorReliableAnnualIncome")).toBe(true);
  });

  it("11. incomplete expense data (household spend unknown) lowers confidence and is flagged", () => {
    const input: LifeCalculatorInput = {
      dependentCount: 1,
      youngestDependentAge: 8,
      survivorReliableAnnualIncome: Money.fromNumber(100_000),
      existingLifeInsurance: Money.zero(),
    };
    const { result } = calculator.calculate(input, STARTER_ENGINE_CONFIG);
    expect(result.missingFacts).toContain("householdRequiredAnnualSpend");
    expect(result.confidence).toBe("low");
  });

  it("12. zero debt — no mortgage at all produces no debt-payoff trace line", () => {
    const input: LifeCalculatorInput = { dependentCount: 0, immediateExpenses: Money.fromNumber(1_000) };
    const { result, trace } = calculator.calculate(input, STARTER_ENGINE_CONFIG);
    expect(trace.lines.find((l) => l.key === "mortgage_offset")).toBeUndefined();
    expect(result.reasonCodes).not.toContain("LIFE_MORTGAGE_GAP");
  });

  it("13. dependent with special needs adds an explicit special-dependent-need line", () => {
    const input: LifeCalculatorInput = {
      dependentCount: 1,
      youngestDependentAge: 12,
      hasSpecialNeedsDependent: true,
      specialDependentNeed: Money.fromNumber(300_000),
      existingLifeInsurance: Money.zero(),
    };
    const { result, trace } = calculator.calculate(input, STARTER_ENGINE_CONFIG);
    const line = trace.lines.find((l) => l.key === "special_dependent_need");
    expect(line?.amountExact).toBe("300000.00");
    expect(result.grossNeed.greaterThan(Money.zero())).toBe(true);
  });

  it("14. explicit user-selected horizon overrides a smaller computed one (PRD §12.4 allowUserOverride)", () => {
    const input: LifeCalculatorInput = {
      dependentCount: 1,
      youngestDependentAge: 19, // only 2 years to target age 21
      userSelectedProtectionHorizonYears: 25,
      householdRequiredAnnualSpend: Money.fromNumber(100_000),
      survivorReliableAnnualIncome: Money.zero(),
    };
    const { result } = calculator.calculate(input, STARTER_ENGINE_CONFIG);
    expect(result.horizonYears).toBe(25);
  });

  it("15. rounding — repeated exact-decimal arithmetic does not accumulate JS float drift", () => {
    const input: LifeCalculatorInput = {
      dependentCount: 1,
      youngestDependentAge: 18,
      userSelectedProtectionHorizonYears: 3,
      householdRequiredAnnualSpend: Money.fromNumber(100.1),
      survivorReliableAnnualIncome: Money.zero(),
      existingLifeInsurance: Money.zero(),
    };
    const zeroDiscountConfig: EngineConfig = {
      ...STARTER_ENGINE_CONFIG,
      financialAssumptions: { ...STARTER_ENGINE_CONFIG.financialAssumptions, realDiscountRate: 0 },
    };
    const { trace } = calculator.calculate(input, zeroDiscountConfig);
    const line = trace.lines.find((l) => l.key === "income_replacement");
    // 100.10 * 3 = 300.30 exactly — a naive float loop (100.1/1 three times summed) drifts to 300.29999999999995.
    expect(line?.amountExact).toBe("300.30");
  });

  it("16. reproduces the PRD §57 worked example exactly (golden case)", () => {
    const input = fromFixture(PERSONA_E_PRD_WORKED_EXAMPLE, { userSelectedProtectionHorizonYears: 16 });
    const zeroDiscountConfig: EngineConfig = {
      ...STARTER_ENGINE_CONFIG,
      financialAssumptions: { ...STARTER_ENGINE_CONFIG.financialAssumptions, realDiscountRate: 0 },
    };
    const { result } = calculator.calculate(input, zeroDiscountConfig);

    expect(result.horizonYears).toBe(16);
    expect(result.grossNeed.toExactString()).toBe("2100000.00");
    expect(result.availableResources.toExactString()).toBe("700000.00");
    expect(result.gap.toExactString()).toBe("1400000.00");
  });
});
