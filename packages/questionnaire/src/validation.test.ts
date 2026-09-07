import { describe, expect, it } from "vitest";
import type { Question } from "./question.js";
import { validateAnswer } from "./validation.js";

function q(overrides: Partial<Question> = {}): Question {
  return {
    id: "x",
    version: 1,
    category: "personal",
    text: "x",
    answerType: "number",
    required: true,
    factsProduced: ["x"],
    decisionImpact: 0.5,
    ...overrides,
  };
}

describe("validateAnswer (PRD §33)", () => {
  it("1. a required question with no answer produces a blocking error", () => {
    const issues = validateAnswer(q(), undefined);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.severity).toBe("error");
  });

  it("2. an optional question with no answer produces no issues", () => {
    expect(validateAnswer(q({ required: false }), undefined)).toHaveLength(0);
  });

  it("3. a sanity-limit violation is a warning, not a silent rejection (PRD §33's own example)", () => {
    const question = q({ validation: [{ kind: "range", params: { min: 0, max: 500_000 }, severity: "warning", message: "סכום גבוה — נכון?" }] });
    const issues = validateAnswer(question, 2_600_000);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.severity).toBe("warning");
  });

  it("4. a value within range produces no issues", () => {
    const question = q({ validation: [{ kind: "range", params: { min: 0, max: 500_000 }, severity: "warning", message: "m" }] });
    expect(validateAnswer(question, 10_000)).toHaveLength(0);
  });

  it("5. min/max rules work independently", () => {
    const question = q({
      validation: [
        { kind: "min", params: { min: 0 }, severity: "error", message: "לא ניתן להזין ערך שלילי." },
        { kind: "max", params: { max: 120 }, severity: "warning", message: "ערך חריג." },
      ],
    });
    expect(validateAnswer(question, -5)[0]?.severity).toBe("error");
    expect(validateAnswer(question, 150)[0]?.severity).toBe("warning");
    expect(validateAnswer(question, 50)).toHaveLength(0);
  });

  it("6. an unanswered non-required question skips rule evaluation entirely", () => {
    const question = q({ required: false, validation: [{ kind: "min", params: { min: 0 }, severity: "error", message: "m" }] });
    expect(validateAnswer(question, undefined)).toHaveLength(0);
  });
});
