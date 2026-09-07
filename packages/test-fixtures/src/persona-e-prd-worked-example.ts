import { Money } from "@insurance-advisor/shared";
import { baseEntity, type HouseholdFixture } from "./types.js";

/**
 * The exact worked example from PRD §57 ("Example End-to-End Case"),
 * reproduced as a fixture so a future life-insurance calculator test can
 * assert against the PRD's own illustrative numbers:
 *
 *   Annual dependency = (22,000 - 12,000) * 12 = 120,000
 *   Income replacement (16y, 0% real discount, illustrative only) = 1,920,000
 *   Mortgage: 800,000 debt fully offset by 800,000 lender-beneficiary cover
 *   Other immediate/education needs (configured example) = 180,000
 *   Gross family need = 2,100,000
 *   Offsets = 500,000 personal life + 200,000 earmarked assets = 700,000
 *   Calculated gap = 1,400,000
 *
 * Note from the PRD itself: this example assumes realDiscountRate = 0
 * "for this test only" — the starter config's real discount rate is
 * nonzero, so a calculator test against this fixture must override the
 * rate to reproduce the PRD's own numbers exactly, or expect a smaller PV.
 */
export const PERSONA_E_PRD_WORKED_EXAMPLE: HouseholdFixture = {
  name: "persona_e_prd_worked_example",
  description: "Reproduces the PRD §57 end-to-end worked example exactly (age 40/38, two children, mortgage).",

  clientProfile: {
    ...baseEntity("cp-e"),
    userId: "user-e",
    primaryPersonId: "person-e-1",
    spousePersonId: "person-e-2",
    householdId: "household-e",
  },

  primaryPerson: {
    ...baseEntity("person-e-1"),
    clientProfileId: "cp-e",
    firstName: "Primary",
    dateOfBirth: "1986-01-01", // age 40 relative to fixture "now" (2026-09-07)
    isPrimaryApplicant: true,
    isSpouse: false,
    retirementAge: 67,
  },

  spousePerson: {
    ...baseEntity("person-e-2"),
    clientProfileId: "cp-e",
    firstName: "Spouse",
    dateOfBirth: "1988-01-01", // age 38
    isPrimaryApplicant: false,
    isSpouse: true,
    retirementAge: 67,
  },

  household: {
    ...baseEntity("household-e"),
    clientProfileId: "cp-e",
    maritalStatus: "married",
    dependents: [
      { ...baseEntity("dep-e-1"), householdId: "household-e", dateOfBirth: "2018-01-01", relationship: "child" }, // age 8
      { ...baseEntity("dep-e-2"), householdId: "household-e", dateOfBirth: "2021-01-01", relationship: "child" }, // age 5, drives the 16-year horizon (21 - 5)
    ],
  },

  employments: [
    { ...baseEntity("emp-e-1"), personId: "person-e-1", status: "employed", hasPensionDisabilityCoverage: true, hasEmployerCoverage: true },
    { ...baseEntity("emp-e-2"), personId: "person-e-2", status: "employed", hasPensionDisabilityCoverage: true, hasEmployerCoverage: true },
  ],

  incomeSources: [
    // Household spend is 22,000/mo; if the primary dies, only the spouse's
    // 12,000/mo reliable income remains — matching the PRD's "survivor
    // reliable income: 12,000/month".
    { ...baseEntity("inc-e-1"), personId: "person-e-1", type: "salary", netMonthlyAmount: Money.fromNumber(18_000), reliableIfDeceased: false, reliableIfDisabled: false },
    { ...baseEntity("inc-e-2"), personId: "person-e-2", type: "salary", netMonthlyAmount: Money.fromNumber(12_000), reliableIfDeceased: true, reliableIfDisabled: true },
  ],

  expenses: [
    { ...baseEntity("exp-e-1"), householdId: "household-e", category: "housing", monthlyAmount: Money.fromNumber(6_800), essential: true },
    { ...baseEntity("exp-e-2"), householdId: "household-e", category: "food", monthlyAmount: Money.fromNumber(4_500), essential: true },
    { ...baseEntity("exp-e-3"), householdId: "household-e", category: "childcare", monthlyAmount: Money.fromNumber(3_200), essential: true },
    { ...baseEntity("exp-e-4"), householdId: "household-e", category: "debt_service", monthlyAmount: Money.fromNumber(4_500), essential: true },
    { ...baseEntity("exp-e-5"), householdId: "household-e", category: "discretionary", monthlyAmount: Money.fromNumber(3_000), essential: false },
    // sums to the PRD's household spend of 22,000/month
  ],

  assets: [
    { ...baseEntity("asset-e-1"), householdId: "household-e", type: "cash", value: Money.fromNumber(200_000), earmarkedForProtection: true },
  ],

  liabilities: [
    { ...baseEntity("liab-e-1"), householdId: "household-e", type: "mortgage", balance: Money.fromNumber(800_000) },
  ],

  mortgages: [
    {
      ...baseEntity("mortgage-e-1"),
      liabilityId: "liab-e-1",
      balance: Money.fromNumber(800_000),
      monthlyPayment: Money.fromNumber(4_500),
      hasLenderBeneficiaryCoverage: true,
      lenderBeneficiaryCoverageAmount: Money.fromNumber(800_000),
    },
  ],

  coverages: [
    {
      ...baseEntity("cov-e-1"),
      clientProfileId: "cp-e",
      category: "life",
      subtype: "term_life",
      insuredPersonId: "person-e-1",
      beneficiaryType: "person",
      amount: Money.fromNumber(500_000),
      verified: true,
      source: "document",
      exclusionsKnown: true,
    },
    {
      ...baseEntity("cov-e-2"),
      clientProfileId: "cp-e",
      category: "life",
      subtype: "mortgage_life",
      insuredPersonId: "person-e-1",
      beneficiaryType: "lender",
      amount: Money.fromNumber(800_000),
      verified: true,
      source: "document",
      exclusionsKnown: true,
    },
  ],

  goals: [
    // PRD §57's "other immediate/education needs (configured example) = 180,000"
    { ...baseEntity("goal-e-1"), householdId: "household-e", type: "education_reserve", targetAmount: Money.fromNumber(180_000) },
  ],
};
