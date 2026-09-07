import { describe, expect, it } from "vitest";
import { Money } from "@insurance-advisor/shared";
import { STARTER_ENGINE_CONFIG } from "@insurance-advisor/config";
import { RecommendationBuilder, type RecommendationInput } from "./recommendation-builder.js";

const builder = new RecommendationBuilder();

function baseInput(overrides: Partial<RecommendationInput> = {}): RecommendationInput {
  return {
    clientProfileId: "cp-1",
    category: "life",
    title: "ביטוח חיים",
    needAmount: Money.fromNumber(1_000_000),
    existingAmount: Money.fromNumber(200_000),
    gapAmount: Money.fromNumber(800_000),
    reasonCodes: ["LIFE_DEPENDENTS_PRESENT"],
    reviewTriggers: ["annual_review"],
    missingFacts: [],
    assumptions: [],
    confidence: "high",
    calculationTraceId: "trace-1",
    priority: { score: 75, band: "HIGH" },
    ...overrides,
  };
}

describe("RecommendationBuilder (PRD §21)", () => {
  it("1. zero need and zero gap -> not_needed", () => {
    const rec = builder.build(
      baseInput({ needAmount: Money.zero(), existingAmount: Money.zero(), gapAmount: Money.zero() }),
      STARTER_ENGINE_CONFIG,
    );
    expect(rec.status).toBe("not_needed");
  });

  it("2. zero gap but real need -> review_existing", () => {
    const rec = builder.build(
      baseInput({ needAmount: Money.fromNumber(500_000), existingAmount: Money.fromNumber(600_000), gapAmount: Money.zero() }),
      STARTER_ENGINE_CONFIG,
    );
    expect(rec.status).toBe("review_existing");
  });

  it("3. low confidence forces manual_review regardless of gap size, and adds a warning", () => {
    const rec = builder.build(baseInput({ confidence: "low" }), STARTER_ENGINE_CONFIG);
    expect(rec.status).toBe("manual_review");
    expect(rec.warnings.length).toBeGreaterThan(0);
  });

  it("4. a real but small gap (below materialGap threshold) -> consider", () => {
    const rec = builder.build(baseInput({ gapAmount: Money.fromNumber(10_000) }), STARTER_ENGINE_CONFIG);
    expect(rec.status).toBe("consider");
  });

  it("5. a real gap above the materialGap threshold with high confidence -> recommended", () => {
    const rec = builder.build(baseInput(), STARTER_ENGINE_CONFIG);
    expect(rec.status).toBe("recommended");
  });

  it("6. high confidence produces an exact (unwidened) recommended range", () => {
    const rec = builder.build(baseInput(), STARTER_ENGINE_CONFIG);
    expect(rec.recommendedMin?.toExactString()).toBe("800000.00");
    expect(rec.recommendedTarget?.toExactString()).toBe("800000.00");
    expect(rec.recommendedMax?.toExactString()).toBe("800000.00");
  });

  it("7. low confidence widens the recommended range by ±25%", () => {
    const rec = builder.build(baseInput({ confidence: "low" }), STARTER_ENGINE_CONFIG);
    expect(rec.recommendedMin?.toExactString()).toBe("600000.00");
    expect(rec.recommendedMax?.toExactString()).toBe("1000000.00");
  });

  it("8. review triggers, reason codes, missing facts, and assumptions pass through unchanged", () => {
    const assumption = { key: "x", description: "d", value: 1, source: "s" };
    const rec = builder.build(
      baseInput({ reviewTriggers: ["annual_review", "mortgage_repaid"], reasonCodes: ["LIFE_MORTGAGE_GAP"], missingFacts: ["existingLifeInsurance"], assumptions: [assumption] }),
      STARTER_ENGINE_CONFIG,
    );
    expect(rec.reviewTriggers).toEqual(["annual_review", "mortgage_repaid"]);
    expect(rec.reasonCodes).toEqual(["LIFE_MORTGAGE_GAP"]);
    expect(rec.missingFacts).toEqual(["existingLifeInsurance"]);
    expect(rec.assumptions).toEqual([assumption]);
  });

  it("9. priority score/band and calculation trace id are carried through, and the object always has an id/timestamps", () => {
    const rec = builder.build(baseInput({ calculationTraceId: "trace-xyz", priority: { score: 42, band: "MEDIUM" } }), STARTER_ENGINE_CONFIG);
    expect(rec.calculationTraceId).toBe("trace-xyz");
    expect(rec.priorityScore).toBe(42);
    expect(rec.priorityBand).toBe("MEDIUM");
    expect(rec.id).toBeTruthy();
    expect(rec.createdAt).toBeTruthy();
    expect(rec.explainabilityComplete).toBe(true);
  });
});
