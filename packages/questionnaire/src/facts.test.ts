import { describe, expect, it } from "vitest";
import type { Question } from "./question.js";
import { produceFacts } from "./facts.js";

function q(overrides: Partial<Question> = {}): Question {
  return {
    id: "x",
    version: 1,
    category: "personal",
    text: "x",
    answerType: "money",
    required: true,
    factsProduced: ["expenses.household.monthly"],
    decisionImpact: 0.5,
    ...overrides,
  };
}

describe("produceFacts (PRD §8)", () => {
  it("1. produces one Fact per factsProduced key, sourced from the user and trusted", () => {
    const facts = produceFacts(q({ factsProduced: ["a", "b"] }), 42, "2026-09-08T00:00:00.000Z");
    expect(facts).toHaveLength(2);
    for (const f of facts) {
      expect(f.value).toBe(42);
      expect(f.source).toBe("user");
      expect(f.verified).toBe(true);
      expect(f.confidence).toBe(1);
    }
    expect(facts.map((f) => f.key)).toEqual(["a", "b"]);
  });

  it("2. applies the named normalizer before producing the fact", () => {
    const facts = produceFacts(q({ normalizer: "roundMoneyToShekel" }), 1234.7);
    expect(facts[0]?.value).toBe(1235);
  });

  it("3. an unknown normalizer name is a no-op, not a crash", () => {
    const facts = produceFacts(q({ normalizer: "doesNotExist" }), 100);
    expect(facts[0]?.value).toBe(100);
  });

  it("4. trimString normalizer trims whitespace", () => {
    const facts = produceFacts(q({ normalizer: "trimString", answerType: "text" }), "  hello  ");
    expect(facts[0]?.value).toBe("hello");
  });

  it("5. effectiveDate defaults to now when not provided", () => {
    const facts = produceFacts(q(), 1);
    expect(facts[0]?.effectiveDate).toBeTruthy();
  });
});
