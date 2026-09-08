import { describe, expect, it } from "vitest";
import type { Fact } from "@insurance-advisor/shared";
import { ALL_HEALTH_COVERAGE_MODULES } from "@insurance-advisor/domain";
import { factsToDisabilityCalculatorInput } from "./facts-to-disability-input.js";
import { factsToCriticalIllnessInput } from "./facts-to-critical-illness-input.js";
import { factsToLongTermCareInput } from "./facts-to-ltc-input.js";
import { factsToHealthInput } from "./facts-to-health-input.js";

function fact(key: string, value: unknown): Fact {
  return { key, value, source: "user", confidence: 1, verified: true };
}

describe("factsToDisabilityCalculatorInput", () => {
  it("maps every recognized fact and leaves the rest undefined", () => {
    const input = factsToDisabilityCalculatorInput([
      fact("expenses.household.monthly", 15_000),
      fact("debt.mortgage.monthlyPayment", 5_000),
      fact("income.survivor.reliableMonthly", 6_000),
      fact("coverage.disability.existingNetMonthly", 3_000),
      fact("person.currentAge", 38),
      fact("person.retirementAge", 67),
    ]);
    expect(input.essentialMonthlyExpenses?.toExactString()).toBe("15000.00");
    expect(input.debtMonthlyPayments?.toExactString()).toBe("5000.00");
    expect(input.reliableMonthlyIncomeDuringDisability?.toExactString()).toBe("6000.00");
    expect(input.existingNetExpectedDisabilityIncome?.toExactString()).toBe("3000.00");
    expect(input.currentAge).toBe(38);
    expect(input.retirementAge).toBe(67);
    // dependentCount was never answered — genuinely unknown, not assumed zero.
    expect(input.dependentsMonthlyNeeds).toBeUndefined();
  });

  it("leaves everything undefined given no facts", () => {
    const input = factsToDisabilityCalculatorInput([]);
    expect(input.essentialMonthlyExpenses).toBeUndefined();
    expect(input.currentAge).toBeUndefined();
    expect(input.dependentsMonthlyNeeds).toBeUndefined();
  });

  it("dependentCount=0 makes dependentsMonthlyNeeds a real, explicit zero (not a gap)", () => {
    const input = factsToDisabilityCalculatorInput([fact("household.dependents.count", 0)]);
    expect(input.dependentsMonthlyNeeds?.isZero()).toBe(true);
  });

  it("dependents exist and the amount was answered -> uses the real figure", () => {
    const input = factsToDisabilityCalculatorInput([fact("household.dependents.count", 2), fact("expenses.dependents.monthly", 3_500)]);
    expect(input.dependentsMonthlyNeeds?.toExactString()).toBe("3500.00");
  });

  it("dependents exist but the amount was never answered -> stays undefined (a real unknown)", () => {
    const input = factsToDisabilityCalculatorInput([fact("household.dependents.count", 2)]);
    expect(input.dependentsMonthlyNeeds).toBeUndefined();
  });
});

describe("factsToCriticalIllnessInput", () => {
  it("maps every recognized fact", () => {
    const input = factsToCriticalIllnessInput([
      fact("expenses.household.monthly", 12_000),
      fact("income.survivor.reliableMonthly", 4_000),
      fact("coverage.criticalIllness.existingAmount", 100_000),
    ]);
    expect(input.monthlyEssentialExpenses?.toExactString()).toBe("12000.00");
    expect(input.reliableMonthlyIncomeDuringRecovery?.toExactString()).toBe("4000.00");
    expect(input.existingCriticalIllnessCoverage?.toExactString()).toBe("100000.00");
  });
});

describe("factsToLongTermCareInput", () => {
  it("maps recognized facts and leaves expectedMonthlyCareCost unset (config fallback applies)", () => {
    const input = factsToLongTermCareInput([
      fact("coverage.ltc.existingMonthlyBenefit", 4_000),
      fact("assets.monthlySelfFundingCapacity", 2_000),
    ]);
    expect(input.reliableMonthlyLTCBenefits?.toExactString()).toBe("4000.00");
    expect(input.monthlySelfFundingCapacity?.toExactString()).toBe("2000.00");
    expect("expectedMonthlyCareCost" in input).toBe(false);
  });
});

describe("factsToHealthInput", () => {
  it("maps yes/no/unknown answers, and omits modules never answered", () => {
    const input = factsToHealthInput([
      fact(`health.module.${ALL_HEALTH_COVERAGE_MODULES[0]}`, "yes"),
      fact(`health.module.${ALL_HEALTH_COVERAGE_MODULES[1]}`, "no"),
      fact(`health.module.${ALL_HEALTH_COVERAGE_MODULES[2]}`, "unknown"),
    ]);
    expect(input.modules).toHaveLength(3);
    expect(input.modules.find((m) => m.module === ALL_HEALTH_COVERAGE_MODULES[0])?.existing).toBe(true);
    expect(input.modules.find((m) => m.module === ALL_HEALTH_COVERAGE_MODULES[1])?.existing).toBe(false);
    expect(input.modules.find((m) => m.module === ALL_HEALTH_COVERAGE_MODULES[2])?.existing).toBe("unknown");
  });

  it("returns an empty modules list given no facts", () => {
    expect(factsToHealthInput([]).modules).toHaveLength(0);
  });
});
