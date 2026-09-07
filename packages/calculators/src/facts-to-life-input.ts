import { Money, type Fact } from "@insurance-advisor/shared";
import type { LifeCalculatorInput } from "./life-insurance-calculator.js";

/**
 * The REAL Facts → LifeCalculatorInput adapter — PRD §10's pipeline
 * (Questionnaire → Facts → Rules → Calculators), for real Facts produced
 * by `packages/questionnaire`'s `produceFacts`, using the dotted fact-key
 * convention from PRD §8's own examples. This is what
 * `packages/calculators/src/demo/household-fixture-adapter.ts` was always
 * a stand-in for — see that file's and docs/DECISIONS.md's notes.
 *
 * Only covers the fact keys `STARTER_LIFE_QUESTIONS` produces — extending
 * this to a fuller Facts vocabulary is mechanical repetition of the same
 * pattern, not a design problem, once more questions exist.
 */
function factValue(facts: Fact[], key: string): unknown {
  return facts.find((f) => f.key === key)?.value;
}

function moneyFromMonthlyFact(facts: Fact[], key: string): Money | undefined {
  const value = factValue(facts, key);
  return typeof value === "number" ? Money.fromNumber(value).multiply(12) : undefined;
}

function moneyFact(facts: Fact[], key: string): Money | undefined {
  const value = factValue(facts, key);
  return typeof value === "number" ? Money.fromNumber(value) : undefined;
}

export function factsToLifeCalculatorInput(facts: Fact[]): LifeCalculatorInput {
  const dependentCount = factValue(facts, "household.dependents.count");
  const mortgageExists = factValue(facts, "debt.mortgage.exists") === true;
  const mortgageBalance = moneyFact(facts, "debt.mortgage.balance");

  return {
    // Defensive fallback only — the starter questionnaire always marks this required,
    // so in practice this fact exists by the time a calculation is requested.
    dependentCount: typeof dependentCount === "number" ? dependentCount : 0,
    youngestDependentAge: asNumber(factValue(facts, "household.youngestDependentAge")),

    householdRequiredAnnualSpend: moneyFromMonthlyFact(facts, "expenses.household.monthly"),
    survivorReliableAnnualIncome: moneyFromMonthlyFact(facts, "income.survivor.reliableMonthly"),

    existingLifeInsurance: moneyFact(facts, "coverage.life.existingAmount"),
    earmarkedLiquidAssets: moneyFact(facts, "assets.earmarkedLiquid"),
    educationNeed: moneyFact(facts, "goals.education.amount"),

    mortgage:
      mortgageExists && mortgageBalance
        ? {
            balance: mortgageBalance,
            hasLenderBeneficiaryCoverage: factValue(facts, "debt.mortgage.hasLenderBeneficiaryCoverage") === true,
            lenderBeneficiaryCoverageAmount: moneyFact(facts, "debt.mortgage.lenderBeneficiaryCoverageAmount"),
          }
        : undefined,

    userSelectedProtectionHorizonYears: asNumber(factValue(facts, "person.protectionHorizonOverrideYears")),
  };
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}
