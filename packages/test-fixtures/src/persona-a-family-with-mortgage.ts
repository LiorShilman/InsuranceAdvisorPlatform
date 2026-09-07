import { Money } from "@insurance-advisor/shared";
import { baseEntity, type HouseholdFixture } from "./types.js";

/**
 * PRD §5 Persona A — salaried couple with children, mortgage, and modest
 * existing coverage. Deliberately under-insured relative to income so a
 * future life/disability gap calculator has a nonzero gap to find.
 */
export const PERSONA_A_FAMILY_WITH_MORTGAGE: HouseholdFixture = {
  name: "persona_a_family_with_mortgage",
  description: "Salaried couple, two children, mortgage, modest existing life cover (PRD §5 Persona A).",

  clientProfile: {
    ...baseEntity("cp-a"),
    userId: "user-a",
    primaryPersonId: "person-a-1",
    spousePersonId: "person-a-2",
    householdId: "household-a",
  },

  primaryPerson: {
    ...baseEntity("person-a-1"),
    clientProfileId: "cp-a",
    firstName: "דנה",
    dateOfBirth: "1984-03-12",
    isPrimaryApplicant: true,
    isSpouse: false,
    retirementAge: 67,
  },

  spousePerson: {
    ...baseEntity("person-a-2"),
    clientProfileId: "cp-a",
    firstName: "אורי",
    dateOfBirth: "1982-11-02",
    isPrimaryApplicant: false,
    isSpouse: true,
    retirementAge: 67,
  },

  household: {
    ...baseEntity("household-a"),
    clientProfileId: "cp-a",
    maritalStatus: "married",
    dependents: [
      { ...baseEntity("dep-a-1"), householdId: "household-a", dateOfBirth: "2016-05-01", relationship: "child" },
      { ...baseEntity("dep-a-2"), householdId: "household-a", dateOfBirth: "2019-08-20", relationship: "child" },
    ],
  },

  employments: [
    { ...baseEntity("emp-a-1"), personId: "person-a-1", status: "employed", occupation: "Product Manager", hasPensionDisabilityCoverage: true, hasEmployerCoverage: true },
    { ...baseEntity("emp-a-2"), personId: "person-a-2", status: "employed", occupation: "Electrician", hasPensionDisabilityCoverage: true, hasEmployerCoverage: false },
  ],

  incomeSources: [
    { ...baseEntity("inc-a-1"), personId: "person-a-1", type: "salary", netMonthlyAmount: Money.fromNumber(18_000), reliableIfDeceased: false, reliableIfDisabled: false },
    { ...baseEntity("inc-a-2"), personId: "person-a-2", type: "salary", netMonthlyAmount: Money.fromNumber(14_000), reliableIfDeceased: false, reliableIfDisabled: false },
  ],

  expenses: [
    { ...baseEntity("exp-a-1"), householdId: "household-a", category: "housing", monthlyAmount: Money.fromNumber(6_500), essential: true },
    { ...baseEntity("exp-a-2"), householdId: "household-a", category: "food", monthlyAmount: Money.fromNumber(4_000), essential: true },
    { ...baseEntity("exp-a-3"), householdId: "household-a", category: "childcare", monthlyAmount: Money.fromNumber(3_000), essential: true },
    { ...baseEntity("exp-a-4"), householdId: "household-a", category: "debt_service", monthlyAmount: Money.fromNumber(5_200), essential: true },
    { ...baseEntity("exp-a-5"), householdId: "household-a", category: "discretionary", monthlyAmount: Money.fromNumber(3_300), essential: false },
  ],

  assets: [
    { ...baseEntity("asset-a-1"), householdId: "household-a", type: "cash", value: Money.fromNumber(80_000), earmarkedForProtection: false },
    { ...baseEntity("asset-a-2"), householdId: "household-a", type: "pension_fund", value: Money.fromNumber(410_000), earmarkedForProtection: false },
  ],

  liabilities: [
    { ...baseEntity("liab-a-1"), householdId: "household-a", type: "mortgage", balance: Money.fromNumber(950_000) },
  ],

  mortgages: [
    {
      ...baseEntity("mortgage-a-1"),
      liabilityId: "liab-a-1",
      balance: Money.fromNumber(950_000),
      monthlyPayment: Money.fromNumber(5_200),
      targetPayoffDate: "2049-01-01",
      hasLenderBeneficiaryCoverage: true,
      lenderBeneficiaryCoverageAmount: Money.fromNumber(950_000),
    },
  ],

  coverages: [
    {
      ...baseEntity("cov-a-1"),
      clientProfileId: "cp-a",
      category: "life",
      subtype: "term_life",
      insuredPersonId: "person-a-1",
      beneficiaryType: "person",
      amount: Money.fromNumber(400_000),
      verified: false,
      source: "user",
      exclusionsKnown: false,
    },
  ],

  goals: [
    { ...baseEntity("goal-a-1"), householdId: "household-a", type: "education_reserve", targetAmount: Money.fromNumber(180_000) },
  ],
};
