import { describe, expect, it } from "vitest";
import { Money } from "@insurance-advisor/shared";
import { STARTER_ENGINE_CONFIG } from "@insurance-advisor/config";
import { RecommendationBuilder, type RecommendationInput } from "./recommendation-builder.js";
import { ReviewScheduler } from "./review-scheduler.js";

const builder = new RecommendationBuilder();
const scheduler = new ReviewScheduler();
const NOW = new Date("2026-09-08T00:00:00.000Z");

function baseInput(overrides: Partial<RecommendationInput> = {}): RecommendationInput {
  return {
    clientProfileId: "cp-1",
    category: "life",
    title: "ביטוח חיים",
    needAmount: Money.fromNumber(1_000_000),
    existingAmount: Money.fromNumber(200_000),
    gapAmount: Money.fromNumber(800_000),
    reasonCodes: [],
    reviewTriggers: ["annual_review"],
    missingFacts: [],
    assumptions: [],
    confidence: "high",
    calculationTraceId: "trace-1",
    priority: { score: 75, band: "HIGH" },
    ...overrides,
  };
}

describe("ReviewScheduler (PRD §22)", () => {
  it("1. with annual_review and no horizon -> exactly one year from now", () => {
    const rec = builder.build(baseInput({ horizon: undefined }), STARTER_ENGINE_CONFIG);
    expect(scheduler.nextReviewDate(rec, NOW)).toBe("2027-09-08");
  });

  it("2. with annual_review AND a long horizon -> the sooner date (one year) wins", () => {
    const rec = builder.build(baseInput({ horizon: { type: "years", value: 14 } }), STARTER_ENGINE_CONFIG);
    expect(scheduler.nextReviewDate(rec, NOW)).toBe("2027-09-08");
  });

  it("3. with a short horizon and no annual_review trigger -> the horizon date wins", () => {
    const rec = builder.build(baseInput({ reviewTriggers: [], horizon: { type: "years", value: 3 } }), STARTER_ENGINE_CONFIG);
    expect(scheduler.nextReviewDate(rec, NOW)).toBe("2029-09-08");
  });

  it("4. with neither annual_review nor a usable horizon -> defaults to one year out", () => {
    const rec = builder.build(baseInput({ reviewTriggers: [], horizon: undefined }), STARTER_ENGINE_CONFIG);
    expect(scheduler.nextReviewDate(rec, NOW)).toBe("2027-09-08");
  });

  it("5. a non-years horizon type is ignored, falling back to annual_review", () => {
    const rec = builder.build(baseInput({ horizon: { type: "age", value: 21 } }), STARTER_ENGINE_CONFIG);
    expect(scheduler.nextReviewDate(rec, NOW)).toBe("2027-09-08");
  });
});
