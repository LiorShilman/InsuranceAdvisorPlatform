import { describe, expect, it } from "vitest";
import type { Fact } from "@insurance-advisor/shared";
import { factsToLifeCalculatorInput } from "./facts-to-life-input.js";

function fact(key: string, value: unknown): Fact {
  return { key, value, source: "user", confidence: 1, verified: true };
}

describe("factsToLifeCalculatorInput (real Facts Engine adapter, PRD §10)", () => {
  it("1. maps a full fact set correctly, including monthly-to-annual conversion", () => {
    const facts: Fact[] = [
      fact("household.dependents.count", 2),
      fact("household.youngestDependentAge", 6),
      fact("expenses.household.monthly", 20_000),
      fact("income.survivor.reliableMonthly", 10_000),
      fact("coverage.life.existingAmount", 500_000),
      fact("assets.earmarkedLiquid", 150_000),
      fact("goals.education.amount", 100_000),
      fact("debt.mortgage.exists", true),
      fact("debt.mortgage.balance", 800_000),
      fact("debt.mortgage.hasLenderBeneficiaryCoverage", true),
      fact("debt.mortgage.lenderBeneficiaryCoverageAmount", 800_000),
    ];
    const input = factsToLifeCalculatorInput(facts);
    expect(input.dependentCount).toBe(2);
    expect(input.youngestDependentAge).toBe(6);
    expect(input.householdRequiredAnnualSpend?.toExactString()).toBe("240000.00");
    expect(input.survivorReliableAnnualIncome?.toExactString()).toBe("120000.00");
    expect(input.existingLifeInsurance?.toExactString()).toBe("500000.00");
    expect(input.earmarkedLiquidAssets?.toExactString()).toBe("150000.00");
    expect(input.educationNeed?.toExactString()).toBe("100000.00");
    expect(input.mortgage?.balance.toExactString()).toBe("800000.00");
    expect(input.mortgage?.hasLenderBeneficiaryCoverage).toBe(true);
    expect(input.mortgage?.lenderBeneficiaryCoverageAmount?.toExactString()).toBe("800000.00");
  });

  it("2. missing optional facts stay undefined, not zero (unknown stays unknown)", () => {
    const input = factsToLifeCalculatorInput([fact("household.dependents.count", 0)]);
    expect(input.householdRequiredAnnualSpend).toBeUndefined();
    expect(input.existingLifeInsurance).toBeUndefined();
    expect(input.earmarkedLiquidAssets).toBeUndefined();
    expect(input.mortgage).toBeUndefined();
  });

  it("3. mortgage.exists=false means no mortgage, even if a stray balance fact exists", () => {
    const input = factsToLifeCalculatorInput([
      fact("household.dependents.count", 0),
      fact("debt.mortgage.exists", false),
      fact("debt.mortgage.balance", 500_000),
    ]);
    expect(input.mortgage).toBeUndefined();
  });

  it("4. a missing dependentCount fact defensively defaults to 0 (documented fallback, not expected in practice)", () => {
    const input = factsToLifeCalculatorInput([]);
    expect(input.dependentCount).toBe(0);
  });

  it("5. userSelectedProtectionHorizonYears passes through when present", () => {
    const input = factsToLifeCalculatorInput([fact("household.dependents.count", 0), fact("person.protectionHorizonOverrideYears", 16)]);
    expect(input.userSelectedProtectionHorizonYears).toBe(16);
  });
});
