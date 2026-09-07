import type {
  Asset,
  ClientProfile,
  Coverage,
  Employment,
  Expense,
  Goal,
  Household,
  IncomeSource,
  Liability,
  Mortgage,
  Person,
} from "@insurance-advisor/domain";

/**
 * Bundles one representative household's full data graph — everything a
 * future calculator test will need — under a single named fixture.
 * Corresponds to PRD §47 point 9 ("test fixtures for 5 representative
 * households").
 */
export type HouseholdFixture = {
  name: string;
  description: string;
  clientProfile: ClientProfile;
  primaryPerson: Person;
  spousePerson?: Person;
  household: Household;
  employments: Employment[];
  incomeSources: IncomeSource[];
  expenses: Expense[];
  assets: Asset[];
  liabilities: Liability[];
  mortgages: Mortgage[];
  coverages: Coverage[];
  goals: Goal[];
};

const NOW = "2026-09-07T00:00:00.000Z";

export function baseEntity(id: string) {
  return { id, createdAt: NOW, updatedAt: NOW };
}
