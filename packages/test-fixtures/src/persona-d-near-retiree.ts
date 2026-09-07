import { Money } from "@insurance-advisor/shared";
import { baseEntity, type HouseholdFixture } from "./types.js";

/**
 * PRD §5 Persona D — near-retirement, high assets, low income need, wants
 * to understand long-term-care self-funding capacity (PRD §16). Good
 * fixture for the LTC calculator and for exercising "existing coverage
 * greater than calculated need" (PRD §42 boundary tests).
 */
export const PERSONA_D_NEAR_RETIREE: HouseholdFixture = {
  name: "persona_d_near_retiree",
  description: "Near-retirement couple, high assets, LTC self-funding capacity focus (PRD §5 Persona D).",

  clientProfile: {
    ...baseEntity("cp-d"),
    userId: "user-d",
    primaryPersonId: "person-d-1",
    spousePersonId: "person-d-2",
    householdId: "household-d",
  },

  primaryPerson: {
    ...baseEntity("person-d-1"),
    clientProfileId: "cp-d",
    firstName: "משה",
    dateOfBirth: "1962-01-15",
    isPrimaryApplicant: true,
    isSpouse: false,
    retirementAge: 67,
  },

  spousePerson: {
    ...baseEntity("person-d-2"),
    clientProfileId: "cp-d",
    firstName: "רות",
    dateOfBirth: "1963-07-22",
    isPrimaryApplicant: false,
    isSpouse: true,
    retirementAge: 67,
  },

  household: {
    ...baseEntity("household-d"),
    clientProfileId: "cp-d",
    maritalStatus: "married",
    dependents: [],
  },

  employments: [
    { ...baseEntity("emp-d-1"), personId: "person-d-1", status: "retired", hasPensionDisabilityCoverage: false, hasEmployerCoverage: false },
    { ...baseEntity("emp-d-2"), personId: "person-d-2", status: "retired", hasPensionDisabilityCoverage: false, hasEmployerCoverage: false },
  ],

  incomeSources: [
    { ...baseEntity("inc-d-1"), personId: "person-d-1", type: "pension", netMonthlyAmount: Money.fromNumber(15_000), reliableIfDeceased: true, reliableIfDisabled: true },
    { ...baseEntity("inc-d-2"), personId: "person-d-2", type: "pension", netMonthlyAmount: Money.fromNumber(9_000), reliableIfDeceased: true, reliableIfDisabled: true },
  ],

  expenses: [
    { ...baseEntity("exp-d-1"), householdId: "household-d", category: "housing", monthlyAmount: Money.fromNumber(3_000), essential: true },
    { ...baseEntity("exp-d-2"), householdId: "household-d", category: "healthcare", monthlyAmount: Money.fromNumber(2_500), essential: true },
    { ...baseEntity("exp-d-3"), householdId: "household-d", category: "discretionary", monthlyAmount: Money.fromNumber(6_000), essential: false },
  ],

  assets: [
    { ...baseEntity("asset-d-1"), householdId: "household-d", type: "real_estate", value: Money.fromNumber(3_200_000), earmarkedForProtection: false },
    { ...baseEntity("asset-d-2"), householdId: "household-d", type: "investment", value: Money.fromNumber(1_800_000), earmarkedForProtection: true },
    { ...baseEntity("asset-d-3"), householdId: "household-d", type: "cash", value: Money.fromNumber(300_000), earmarkedForProtection: true },
  ],

  liabilities: [],
  mortgages: [],

  coverages: [
    {
      ...baseEntity("cov-d-1"),
      clientProfileId: "cp-d",
      category: "ltc",
      subtype: "group_ltc_rider",
      insuredPersonId: "person-d-1",
      beneficiaryType: "person",
      monthlyBenefit: Money.fromNumber(4_000),
      verified: true,
      source: "document",
      exclusionsKnown: true,
    },
  ],

  goals: [
    { ...baseEntity("goal-d-1"), householdId: "household-d", type: "estate", description: "העברת נכסים מסודרת ליורשים" },
  ],
};
