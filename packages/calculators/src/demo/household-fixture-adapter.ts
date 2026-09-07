import { Money } from "@insurance-advisor/shared";
import type { HouseholdFixture } from "@insurance-advisor/test-fixtures";
import type { LifeCalculatorInput } from "../life-insurance-calculator.js";

/**
 * DEMO/TEST ADAPTER ONLY — not the real pipeline.
 *
 * Maps a `HouseholdFixture` (a hand-authored domain-shaped test fixture)
 * straight onto `LifeCalculatorInput`, skipping the Facts Engine and
 * Questionnaire entirely. This exists so the calculator can be exercised
 * by tests (§48) and the `apps/web` preview page without waiting on
 * Milestone 2. The real pipeline (§10) is Questionnaire → Facts → Rules →
 * Calculators — see docs/DECISIONS.md.
 */
export function fromHouseholdFixture(
  fixture: HouseholdFixture,
  overrides: Partial<LifeCalculatorInput> = {},
  now: Date = new Date(),
): LifeCalculatorInput {
  const ageOn = (dateOfBirth: string | undefined): number | undefined => {
    if (!dateOfBirth) return undefined;
    const dob = new Date(dateOfBirth);
    let age = now.getUTCFullYear() - dob.getUTCFullYear();
    const hadBirthdayThisYear =
      now.getUTCMonth() > dob.getUTCMonth() || (now.getUTCMonth() === dob.getUTCMonth() && now.getUTCDate() >= dob.getUTCDate());
    if (!hadBirthdayThisYear) age -= 1;
    return age;
  };

  const youngestDependentAge = fixture.household.dependents
    .map((d) => ageOn(d.dateOfBirth))
    .filter((age): age is number => age !== undefined)
    .reduce((min, age) => (min === undefined || age < min ? age : min), undefined as number | undefined);

  const householdRequiredAnnualSpend = fixture.expenses.reduce((sum, e) => sum.add(e.monthlyAmount), Money.zero()).multiply(12);

  const survivorReliableAnnualIncome = fixture.incomeSources
    .filter((i) => i.reliableIfDeceased)
    .reduce((sum, i) => sum.add(i.netMonthlyAmount), Money.zero())
    .multiply(12);

  const existingLifeInsurance = fixture.coverages
    .filter((c) => c.category === "life" && c.beneficiaryType !== "lender")
    .reduce((sum, c) => sum.add(c.amount ?? Money.zero()), Money.zero());

  const earmarkedLiquidAssets = fixture.assets
    .filter((a) => a.earmarkedForProtection && a.type === "cash")
    .reduce((sum, a) => sum.add(a.value), Money.zero());

  const earmarkedOtherAssets = fixture.assets
    .filter((a) => a.earmarkedForProtection && a.type !== "cash")
    .reduce((sum, a) => sum.add(a.value), Money.zero());

  const educationNeed = fixture.goals
    .filter((g) => g.type === "education_reserve")
    .reduce((sum, g) => sum.add(g.targetAmount ?? Money.zero()), Money.zero());

  const mortgage = fixture.mortgages[0];

  return {
    dependentCount: fixture.household.dependents.length,
    youngestDependentAge,
    householdRequiredAnnualSpend,
    survivorReliableAnnualIncome,
    existingLifeInsurance,
    earmarkedLiquidAssets,
    earmarkedOtherAssets,
    educationNeed,
    mortgage: mortgage
      ? {
          balance: mortgage.balance,
          hasLenderBeneficiaryCoverage: mortgage.hasLenderBeneficiaryCoverage,
          lenderBeneficiaryCoverageAmount: mortgage.lenderBeneficiaryCoverageAmount,
        }
      : undefined,
    ...overrides,
  };
}
