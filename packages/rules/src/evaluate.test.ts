import { describe, expect, it } from "vitest";
import type { Fact } from "@insurance-advisor/shared";
import { SimpleRuleEngine } from "./evaluate.js";
import { STARTER_LIFE_RULES } from "./starter-rules.js";

function fact(key: string, value: unknown): Fact {
  return { key, value, source: "derived", confidence: 1, verified: true };
}

describe("SimpleRuleEngine (PRD §11)", () => {
  it("matches LIFE_DEPENDENTS_001 when dependents exist", () => {
    const facts = [fact("household.dependents.count", 2), fact("debt.mortgage.balance", 0)];
    const result = new SimpleRuleEngine().evaluate(STARTER_LIFE_RULES, facts);

    const dependentsRule = result.traces.find((t) => t.ruleId === "LIFE_DEPENDENTS_001");
    expect(dependentsRule?.matched).toBe(true);

    const noDependentsRule = result.traces.find((t) => t.ruleId === "LIFE_NO_DEPENDENTS_NO_DEBT_001");
    expect(noDependentsRule?.matched).toBe(false);
  });

  it("matches the optional rule when there are no dependents and no mortgage", () => {
    const facts = [fact("household.dependents.count", 0), fact("debt.mortgage.balance", 0)];
    const result = new SimpleRuleEngine().evaluate(STARTER_LIFE_RULES, facts);

    expect(result.matchedRules.map((r) => r.id)).toEqual(["LIFE_NO_DEPENDENTS_NO_DEBT_001"]);
  });

  it("matches the mortgage rule independently of dependents", () => {
    const facts = [fact("household.dependents.count", 0), fact("debt.mortgage.balance", 800_000)];
    const result = new SimpleRuleEngine().evaluate(STARTER_LIFE_RULES, facts);

    expect(result.matchedRules.map((r) => r.id)).toEqual(["LIFE_MORTGAGE_001"]);
  });

  it("records every rule's trace, matched or not, with the fact keys it used", () => {
    const facts = [fact("household.dependents.count", 1), fact("debt.mortgage.balance", 0)];
    const result = new SimpleRuleEngine().evaluate(STARTER_LIFE_RULES, facts);

    expect(result.traces).toHaveLength(STARTER_LIFE_RULES.length);
    const dependentsTrace = result.traces.find((t) => t.ruleId === "LIFE_DEPENDENTS_001");
    expect(dependentsTrace?.factsUsed).toEqual(["household.dependents.count"]);
  });
});
