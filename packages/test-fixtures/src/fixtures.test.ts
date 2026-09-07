import { describe, expect, it } from "vitest";
import { Money } from "@insurance-advisor/shared";
import { ALL_HOUSEHOLD_FIXTURES } from "./index.js";

describe("household test fixtures (PRD §47 point 9 — 5 representative households)", () => {
  it("provides exactly 5 fixtures with unique names", () => {
    expect(ALL_HOUSEHOLD_FIXTURES).toHaveLength(5);
    const names = ALL_HOUSEHOLD_FIXTURES.map((f) => f.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("every fixture has the fields a needs calculator will require", () => {
    for (const fixture of ALL_HOUSEHOLD_FIXTURES) {
      expect(fixture.primaryPerson.clientProfileId).toBe(fixture.clientProfile.id);
      expect(fixture.household.clientProfileId).toBe(fixture.clientProfile.id);
      // every household has at least an income source or is explicitly retired
      const anyIncome = fixture.incomeSources.length > 0;
      expect(anyIncome).toBe(true);
    }
  });

  it("the PRD §57 worked-example fixture reproduces the PRD's own household spend and horizon inputs", () => {
    const worked = ALL_HOUSEHOLD_FIXTURES.find((f) => f.name === "persona_e_prd_worked_example");
    expect(worked).toBeDefined();
    if (!worked) return;

    const totalMonthlySpend = worked.expenses.reduce((sum, e) => sum.add(e.monthlyAmount), Money.zero());
    expect(totalMonthlySpend.toExactString()).toBe("22000.00");

    const survivorReliableIncome = worked.incomeSources
      .filter((i) => i.reliableIfDeceased)
      .reduce((sum, i) => sum.add(i.netMonthlyAmount), Money.zero());
    expect(survivorReliableIncome.toExactString()).toBe("12000.00");

    expect(worked.household.dependents).toHaveLength(2);
    const mortgage = worked.mortgages[0];
    expect(mortgage).toBeDefined();
    expect(mortgage?.hasLenderBeneficiaryCoverage).toBe(true);
    expect(mortgage?.balance.toExactString()).toBe(mortgage?.lenderBeneficiaryCoverageAmount?.toExactString());
  });
});
