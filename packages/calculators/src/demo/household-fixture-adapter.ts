import { Money } from "@insurance-advisor/shared";
import type { HouseholdFixture } from "@insurance-advisor/test-fixtures";
import type { LifeCalculatorInput } from "../life-insurance-calculator.js";
import type { DisabilityCalculatorInput } from "../disability-insurance-calculator.js";
import type { CriticalIllnessCalculatorInput } from "../critical-illness-calculator.js";
import { ALL_HEALTH_COVERAGE_MODULES } from "@insurance-advisor/domain";
import type { HealthAssessorInput } from "../health-module-assessor.js";

/**
 * DEMO/TEST ADAPTERS ONLY — not the real pipeline.
 *
 * Maps a `HouseholdFixture` (a hand-authored domain-shaped test fixture)
 * straight onto a calculator's input type, skipping the Facts Engine and
 * Questionnaire entirely. This exists so calculators can be exercised by
 * tests and the `apps/web` preview page without waiting on Milestone 2.
 * The real pipeline (§10) is Questionnaire → Facts → Rules → Calculators —
 * see docs/DECISIONS.md.
 */

function ageOnDate(dateOfBirth: string | undefined, now: Date): number | undefined {
  if (!dateOfBirth) return undefined;
  const dob = new Date(dateOfBirth);
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const hadBirthdayThisYear =
    now.getUTCMonth() > dob.getUTCMonth() || (now.getUTCMonth() === dob.getUTCMonth() && now.getUTCDate() >= dob.getUTCDate());
  if (!hadBirthdayThisYear) age -= 1;
  return age;
}

export function fromHouseholdFixture(
  fixture: HouseholdFixture,
  overrides: Partial<LifeCalculatorInput> = {},
  now: Date = new Date(),
): LifeCalculatorInput {
  const ageOn = (dateOfBirth: string | undefined) => ageOnDate(dateOfBirth, now);

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

/**
 * DEMO ADAPTER ONLY. None of the 5 fixtures carry a monthly disability
 * benefit amount (only `Employment.hasPensionDisabilityCoverage` /
 * `hasEmployerCoverage` booleans, no amounts) — so
 * `existingNetExpectedDisabilityIncome` always comes out `undefined` here,
 * on purpose. That's a realistic "we haven't collected this yet" case, not
 * a bug — see docs/ASSUMPTIONS.md. `essentialMonthlyExpenses` folds in
 * every essential expense category (including `debt_service` and
 * `childcare`) to avoid double-counting against `debtMonthlyPayments`/
 * `dependentsMonthlyNeeds`, which are left at an explicit zero rather than
 * re-summed.
 */
export function fromHouseholdFixtureForDisability(
  fixture: HouseholdFixture,
  overrides: Partial<DisabilityCalculatorInput> = {},
  now: Date = new Date(),
): DisabilityCalculatorInput {
  const essentialMonthlyExpenses = fixture.expenses
    .filter((e) => e.essential)
    .reduce((sum, e) => sum.add(e.monthlyAmount), Money.zero());

  const reliableMonthlyIncomeDuringDisability = fixture.incomeSources
    .filter((i) => i.reliableIfDisabled)
    .reduce((sum, i) => sum.add(i.netMonthlyAmount), Money.zero());

  return {
    essentialMonthlyExpenses,
    debtMonthlyPayments: Money.zero(),
    dependentsMonthlyNeeds: Money.zero(),
    reliableMonthlyIncomeDuringDisability,
    currentAge: ageOnDate(fixture.primaryPerson.dateOfBirth, now),
    retirementAge: fixture.primaryPerson.retirementAge,
    ...overrides,
  };
}

/**
 * DEMO ADAPTER ONLY. `existingCriticalIllnessCoverage` always comes out
 * `undefined` — none of the 5 fixtures have a `category: "critical_illness"`
 * coverage row — same "genuinely unknown, not a bug" situation as the
 * disability adapter above. `reliableMonthlyIncomeDuringRecovery` reuses
 * each fixture's `reliableIfDisabled` income flag as a stand-in for
 * "would this income continue during critical-illness recovery" — the
 * fixtures don't model a separate flag for that, and disability is the
 * closest existing proxy (see docs/DECISIONS.md).
 */
export function fromHouseholdFixtureForCriticalIllness(
  fixture: HouseholdFixture,
  overrides: Partial<CriticalIllnessCalculatorInput> = {},
): Omit<CriticalIllnessCalculatorInput, "recoveryDurationMonths"> {
  const monthlyEssentialExpenses = fixture.expenses
    .filter((e) => e.essential)
    .reduce((sum, e) => sum.add(e.monthlyAmount), Money.zero());

  const reliableMonthlyIncomeDuringRecovery = fixture.incomeSources
    .filter((i) => i.reliableIfDisabled)
    .reduce((sum, i) => sum.add(i.netMonthlyAmount), Money.zero());

  return {
    monthlyEssentialExpenses,
    reliableMonthlyIncomeDuringRecovery,
    ...overrides,
  };
}

/**
 * DEMO ADAPTER ONLY. A fixture with any `category: "health"` coverage row
 * (however vague) maps to every module being "unknown" — we know *some*
 * health policy exists but not which modules it actually covers, which is
 * the honest state, not a guess. A fixture with no health coverage row at
 * all maps to every module being explicitly `existing: false` — genuinely
 * known to be absent, not unknown.
 */
export function fromHouseholdFixtureForHealth(fixture: HouseholdFixture): HealthAssessorInput {
  const hasAnyHealthCoverage = fixture.coverages.some((c) => c.category === "health");
  if (hasAnyHealthCoverage) {
    return { modules: [] };
  }
  return { modules: ALL_HEALTH_COVERAGE_MODULES.map((module) => ({ module, existing: false as const })) };
}
