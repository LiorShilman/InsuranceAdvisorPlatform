import { Money } from "@insurance-advisor/shared";
import { baseEntity, type HouseholdFixture } from "./types.js";

/**
 * PRD §5 Persona B — self-employed, single, no dependents, worried about
 * cashflow continuity. No existing coverage at all — a clean "everything
 * is a gap" case for the disability/critical-illness calculators.
 */
export const PERSONA_B_SELF_EMPLOYED_SINGLE: HouseholdFixture = {
  name: "persona_b_self_employed_single",
  description: "Self-employed, single, no dependents, no existing coverage, irregular income (PRD §5 Persona B).",

  clientProfile: {
    ...baseEntity("cp-b"),
    userId: "user-b",
    primaryPersonId: "person-b-1",
    householdId: "household-b",
  },

  primaryPerson: {
    ...baseEntity("person-b-1"),
    clientProfileId: "cp-b",
    firstName: "טל",
    dateOfBirth: "1990-06-18",
    isPrimaryApplicant: true,
    isSpouse: false,
    retirementAge: 67,
  },

  household: {
    ...baseEntity("household-b"),
    clientProfileId: "cp-b",
    maritalStatus: "single",
    dependents: [],
  },

  employments: [
    {
      ...baseEntity("emp-b-1"),
      personId: "person-b-1",
      status: "self_employed",
      occupation: "Independent graphic designer",
      hasPensionDisabilityCoverage: false,
      hasEmployerCoverage: false,
    },
  ],

  incomeSources: [
    { ...baseEntity("inc-b-1"), personId: "person-b-1", type: "self_employment", netMonthlyAmount: Money.fromNumber(11_000), reliableIfDeceased: false, reliableIfDisabled: false },
  ],

  expenses: [
    { ...baseEntity("exp-b-1"), householdId: "household-b", category: "housing", monthlyAmount: Money.fromNumber(4_200), essential: true },
    { ...baseEntity("exp-b-2"), householdId: "household-b", category: "food", monthlyAmount: Money.fromNumber(2_200), essential: true },
    { ...baseEntity("exp-b-3"), householdId: "household-b", category: "discretionary", monthlyAmount: Money.fromNumber(1_800), essential: false },
  ],

  assets: [
    { ...baseEntity("asset-b-1"), householdId: "household-b", type: "cash", value: Money.fromNumber(25_000), earmarkedForProtection: false },
  ],

  liabilities: [],
  mortgages: [],

  coverages: [],

  goals: [
    { ...baseEntity("goal-b-1"), householdId: "household-b", type: "emergency_reserve", targetAmount: Money.fromNumber(60_000) },
  ],
};
