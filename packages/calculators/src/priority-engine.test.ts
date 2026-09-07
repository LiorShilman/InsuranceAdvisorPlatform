import { describe, expect, it } from "vitest";
import { STARTER_ENGINE_CONFIG, type EngineConfig } from "@insurance-advisor/config";
import { PriorityEngine } from "./priority-engine.js";

const engine = new PriorityEngine();

describe("PriorityEngine (PRD §19)", () => {
  it("1. a fully-covered need with no dependents scores low (INFORMATIONAL/LOW)", () => {
    const { score, band } = engine.score(
      { category: "life", gapRatio: 0, coverageAdequacy: 1, hasDependents: false },
      STARTER_ENGINE_CONFIG,
    );
    expect(score).toBeLessThan(40);
    expect(["INFORMATIONAL", "LOW"]).toContain(band);
  });

  it("2. a total gap with dependents on a high-severity category scores CRITICAL", () => {
    const { score, band } = engine.score(
      { category: "life", gapRatio: 1, coverageAdequacy: 0, hasDependents: true },
      STARTER_ENGINE_CONFIG,
    );
    expect(score).toBeGreaterThanOrEqual(80);
    expect(band).toBe("CRITICAL");
  });

  it("3. a half-covered, half-dependent-weighted case lands in MEDIUM", () => {
    const { band } = engine.score(
      { category: "life", gapRatio: 0.5, coverageAdequacy: 0.5, hasDependents: true },
      STARTER_ENGINE_CONFIG,
    );
    expect(band).toBe("MEDIUM");
  });

  it("4. affordability penalty lowers the score by exactly its value", () => {
    const base = { category: "life" as const, gapRatio: 1, coverageAdequacy: 0, hasDependents: true };
    const withoutPenalty = engine.score(base, STARTER_ENGINE_CONFIG);
    const withPenalty = engine.score({ ...base, affordabilityPenalty: 20 }, STARTER_ENGINE_CONFIG);
    expect(withoutPenalty.score - withPenalty.score).toBe(20);
  });

  it("5. a flagged duplicate lowers the score by exactly duplicatePenaltyPoints", () => {
    const base = { category: "life" as const, gapRatio: 1, coverageAdequacy: 0, hasDependents: true };
    const withoutFlag = engine.score(base, STARTER_ENGINE_CONFIG);
    const withFlag = engine.score({ ...base, duplicateFlagged: true }, STARTER_ENGINE_CONFIG);
    expect(withoutFlag.score - withFlag.score).toBe(STARTER_ENGINE_CONFIG.duplicatePenaltyPoints);
  });

  it("6. score never exceeds 100 even with an inflated custom config", () => {
    const inflatedConfig: EngineConfig = {
      ...STARTER_ENGINE_CONFIG,
      priorityWeights: {
        severityWeight: 100,
        probabilityWeight: 100,
        dependencyWeight: 100,
        gapWeight: 100,
        irreplaceabilityWeight: 100,
        urgencyWeight: 100,
        existingCoverageWeight: 0,
      },
    };
    const { score } = engine.score({ category: "life", gapRatio: 1, coverageAdequacy: 0, hasDependents: true }, inflatedConfig);
    expect(score).toBe(100);
  });

  it("7. score never goes below 0 even with a huge affordability penalty", () => {
    const { score } = engine.score(
      { category: "life", gapRatio: 0, coverageAdequacy: 1, hasDependents: false, affordabilityPenalty: 999 },
      STARTER_ENGINE_CONFIG,
    );
    expect(score).toBe(0);
  });

  it("8. gapRatioAndCoverageAdequacy: zero need means zero gap ratio and full adequacy", () => {
    expect(PriorityEngine.gapRatioAndCoverageAdequacy(0, 0)).toEqual({ gapRatio: 0, coverageAdequacy: 1 });
  });

  it("9. gapRatioAndCoverageAdequacy: computes proportional values and clamps at 1", () => {
    expect(PriorityEngine.gapRatioAndCoverageAdequacy(100, 25)).toEqual({ gapRatio: 0.75, coverageAdequacy: 0.25 });
    expect(PriorityEngine.gapRatioAndCoverageAdequacy(100, 500)).toEqual({ gapRatio: 0, coverageAdequacy: 1 });
  });

  it("10. lower-risk categories (health) score lower than life for an identical gap/dependents profile", () => {
    const lifeScore = engine.score({ category: "life", gapRatio: 1, coverageAdequacy: 0, hasDependents: true }, STARTER_ENGINE_CONFIG);
    const healthScore = engine.score({ category: "health", gapRatio: 1, coverageAdequacy: 0, hasDependents: true }, STARTER_ENGINE_CONFIG);
    expect(healthScore.score).toBeLessThan(lifeScore.score);
  });
});
