import { Money } from "@insurance-advisor/shared";
import { baseEntity, type HouseholdFixture } from "./types.js";

/**
 * PRD §5 Persona C — young couple planning their first pregnancy, worried
 * about future medical costs, existing health coverage of unknown scope.
 * Good fixture for the health-module gap analysis (PRD §15).
 */
export const PERSONA_C_YOUNG_COUPLE_PLANNING_FAMILY: HouseholdFixture = {
  name: "persona_c_young_couple_planning_family",
  description: "Young married couple, no children yet, unknown health-module coverage (PRD §5 Persona C).",

  clientProfile: {
    ...baseEntity("cp-c"),
    userId: "user-c",
    primaryPersonId: "person-c-1",
    spousePersonId: "person-c-2",
    householdId: "household-c",
  },

  primaryPerson: {
    ...baseEntity("person-c-1"),
    clientProfileId: "cp-c",
    firstName: "נועה",
    dateOfBirth: "1994-02-09",
    isPrimaryApplicant: true,
    isSpouse: false,
    retirementAge: 67,
  },

  spousePerson: {
    ...baseEntity("person-c-2"),
    clientProfileId: "cp-c",
    firstName: "יובל",
    dateOfBirth: "1993-09-30",
    isPrimaryApplicant: false,
    isSpouse: true,
    retirementAge: 67,
  },

  household: {
    ...baseEntity("household-c"),
    clientProfileId: "cp-c",
    maritalStatus: "married",
    dependents: [],
  },

  employments: [
    { ...baseEntity("emp-c-1"), personId: "person-c-1", status: "employed", occupation: "Software Engineer", hasPensionDisabilityCoverage: true, hasEmployerCoverage: true },
    { ...baseEntity("emp-c-2"), personId: "person-c-2", status: "employed", occupation: "Physiotherapist", hasPensionDisabilityCoverage: true, hasEmployerCoverage: true },
  ],

  incomeSources: [
    { ...baseEntity("inc-c-1"), personId: "person-c-1", type: "salary", netMonthlyAmount: Money.fromNumber(22_000), reliableIfDeceased: false, reliableIfDisabled: false },
    { ...baseEntity("inc-c-2"), personId: "person-c-2", type: "salary", netMonthlyAmount: Money.fromNumber(13_500), reliableIfDeceased: false, reliableIfDisabled: false },
  ],

  expenses: [
    { ...baseEntity("exp-c-1"), householdId: "household-c", category: "housing", monthlyAmount: Money.fromNumber(6_000), essential: true },
    { ...baseEntity("exp-c-2"), householdId: "household-c", category: "food", monthlyAmount: Money.fromNumber(3_200), essential: true },
    { ...baseEntity("exp-c-3"), householdId: "household-c", category: "discretionary", monthlyAmount: Money.fromNumber(5_000), essential: false },
  ],

  assets: [
    { ...baseEntity("asset-c-1"), householdId: "household-c", type: "investment", value: Money.fromNumber(150_000), earmarkedForProtection: false },
  ],

  liabilities: [],
  mortgages: [],

  coverages: [
    {
      ...baseEntity("cov-c-1"),
      clientProfileId: "cp-c",
      category: "health",
      subtype: "unknown_supplemental",
      insuredPersonId: "person-c-1",
      verified: false,
      source: "user",
      exclusionsKnown: false,
      notes: "יש ביטוח בריאות פרטי אבל לא ברור אילו מודולים כלולים",
    },
  ],

  goals: [
    { ...baseEntity("goal-c-1"), householdId: "household-c", type: "other", description: "תכנון הריון ראשון ב-12 החודשים הקרובים" },
  ],
};
