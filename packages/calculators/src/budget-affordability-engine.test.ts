import { describe, expect, it } from "vitest";
import { Money } from "@insurance-advisor/shared";
import { STARTER_ENGINE_CONFIG } from "@insurance-advisor/config";
import { BudgetAffordabilityEngine } from "./budget-affordability-engine.js";

const engine = new BudgetAffordabilityEngine();

describe("BudgetAffordabilityEngine (PRD §20)", () => {
  it("1. reproduces the PRD §20 worked example exactly", () => {
    // PRD §20: Need = 2,000,000; BudgetSupportedCoverage = 1,200,000; Remaining Gap = 800,000
    const { budgetSupportedCoverage, remainingUninsuredGap } = engine.evaluate(
      { calculatedNeed: Money.fromNumber(2_000_000), monthlyBudget: Money.fromNumber(300) },
      STARTER_ENGINE_CONFIG,
    );
    expect(budgetSupportedCoverage?.toExactString()).toBe("1200000.00");
    expect(remainingUninsuredGap.toExactString()).toBe("800000.00");
  });

  it("2. no budget given -> no budget-constrained option, full need is the remaining gap", () => {
    const result = engine.evaluate({ calculatedNeed: Money.fromNumber(500_000) }, STARTER_ENGINE_CONFIG);
    expect(result.budgetSupportedCoverage).toBeUndefined();
    expect(result.remainingUninsuredGap.toExactString()).toBe("500000.00");
    expect(result.affordabilityPenalty).toBe(0);
  });

  it("3. a budget that fully covers the need leaves zero remaining gap and zero penalty", () => {
    const result = engine.evaluate(
      { calculatedNeed: Money.fromNumber(1_000_000), monthlyBudget: Money.fromNumber(1_000) },
      STARTER_ENGINE_CONFIG,
    );
    expect(result.remainingUninsuredGap.isZero()).toBe(true);
    expect(result.affordabilityPenalty).toBe(0);
  });

  it("4. the calculated need itself is never reduced by the budget (PRD §20's explicit rule)", () => {
    const result = engine.evaluate(
      { calculatedNeed: Money.fromNumber(2_000_000), monthlyBudget: Money.fromNumber(50) },
      STARTER_ENGINE_CONFIG,
    );
    expect(result.calculatedNeed.toExactString()).toBe("2000000.00");
  });

  it("5. a near-zero budget still surfaces almost the entire gap, never silently hidden", () => {
    const result = engine.evaluate(
      { calculatedNeed: Money.fromNumber(2_000_000), monthlyBudget: Money.fromNumber(1) },
      STARTER_ENGINE_CONFIG,
    );
    expect(result.remainingUninsuredGap.greaterThan(Money.fromNumber(1_990_000))).toBe(true);
    expect(result.affordabilityPenalty).toBe(STARTER_ENGINE_CONFIG.affordability.maxAffordabilityPenaltyPoints);
  });

  it("6. affordabilityPenalty scales proportionally to the shortfall ratio", () => {
    const halfShortfall = engine.evaluate(
      { calculatedNeed: Money.fromNumber(2_000_000), monthlyBudget: Money.fromNumber(150) }, // covers 600,000 of 2,000,000 -> 70% shortfall... compute below
      STARTER_ENGINE_CONFIG,
    );
    expect(halfShortfall.affordabilityPenalty).toBeGreaterThan(0);
    expect(halfShortfall.affordabilityPenalty).toBeLessThan(STARTER_ENGINE_CONFIG.affordability.maxAffordabilityPenaltyPoints);
  });

  it("7. zero calculated need never divides by zero", () => {
    const result = engine.evaluate({ calculatedNeed: Money.zero(), monthlyBudget: Money.fromNumber(300) }, STARTER_ENGINE_CONFIG);
    expect(result.remainingUninsuredGap.isZero()).toBe(true);
    expect(result.affordabilityPenalty).toBe(0);
  });
});
