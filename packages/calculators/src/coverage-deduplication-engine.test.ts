import { describe, expect, it } from "vitest";
import { Money } from "@insurance-advisor/shared";
import { STARTER_ENGINE_CONFIG } from "@insurance-advisor/config";
import type { Coverage } from "@insurance-advisor/domain";
import { CoverageDeduplicationEngine } from "./coverage-deduplication-engine.js";

const engine = new CoverageDeduplicationEngine();

function coverage(overrides: Partial<Coverage> & Pick<Coverage, "id" | "insuredPersonId" | "category">): Coverage {
  return {
    createdAt: "2026-09-07T00:00:00.000Z",
    updatedAt: "2026-09-07T00:00:00.000Z",
    clientProfileId: "cp-1",
    subtype: "term_life",
    verified: true,
    source: "user",
    exclusionsKnown: true,
    ...overrides,
  };
}

describe("CoverageDeduplicationEngine (PRD §18)", () => {
  it("1. two overlapping life policies on the same person are flagged", () => {
    const a = coverage({ id: "a", insuredPersonId: "p1", category: "life", amount: Money.fromNumber(500_000), startDate: "2020-01-01" });
    const b = coverage({ id: "b", insuredPersonId: "p1", category: "life", amount: Money.fromNumber(400_000), startDate: "2021-01-01" });
    const { flags } = engine.detect([a, b], STARTER_ENGINE_CONFIG);
    expect(flags).toHaveLength(1);
    expect(flags[0]?.message).toContain("חפיפה אפשרית");
  });

  it("2. a personal life policy and a mortgage-lender life policy on the same person are NOT flagged (PRD §12.5 distinction)", () => {
    const personal = coverage({ id: "a", insuredPersonId: "p1", category: "life", beneficiaryType: "person", amount: Money.fromNumber(500_000), startDate: "2020-01-01" });
    const mortgage = coverage({ id: "b", insuredPersonId: "p1", category: "life", beneficiaryType: "lender", amount: Money.fromNumber(800_000), startDate: "2020-01-01" });
    const { flags } = engine.detect([personal, mortgage], STARTER_ENGINE_CONFIG);
    expect(flags).toHaveLength(0);
  });

  it("3. two different people's life policies are never flagged, no matter how similar otherwise", () => {
    const a = coverage({ id: "a", insuredPersonId: "p1", category: "life", amount: Money.fromNumber(500_000), startDate: "2020-01-01" });
    const b = coverage({ id: "b", insuredPersonId: "p2", category: "life", amount: Money.fromNumber(500_000), startDate: "2020-01-01" });
    const { flags } = engine.detect([a, b], STARTER_ENGINE_CONFIG);
    expect(flags).toHaveLength(0);
  });

  it("4. a completely unknown start date can't be ruled out as overlapping — not silently cleared (rule 13)", () => {
    const a = coverage({ id: "a", insuredPersonId: "p1", category: "disability", monthlyBenefit: Money.fromNumber(5_000) }); // no dates at all
    const b = coverage({ id: "b", insuredPersonId: "p1", category: "disability", monthlyBenefit: Money.fromNumber(6_000), startDate: "2020-01-01", endDate: "2022-01-01" });
    const { flags } = engine.detect([a, b], STARTER_ENGINE_CONFIG);
    expect(flags).toHaveLength(1);
  });

  it("5. clearly non-overlapping, fully-dated policies are not flagged", () => {
    const a = coverage({ id: "a", insuredPersonId: "p1", category: "disability", monthlyBenefit: Money.fromNumber(5_000), startDate: "2010-01-01", endDate: "2012-01-01" });
    const b = coverage({ id: "b", insuredPersonId: "p1", category: "disability", monthlyBenefit: Money.fromNumber(6_000), startDate: "2020-01-01", endDate: "2022-01-01" });
    const { flags } = engine.detect([a, b], STARTER_ENGINE_CONFIG);
    expect(flags).toHaveLength(0);
  });

  it("6. duplicateScore is exposed and equals the sum of matched factor weights", () => {
    const a = coverage({ id: "a", insuredPersonId: "p1", category: "life", amount: Money.fromNumber(500_000), startDate: "2020-01-01" });
    const b = coverage({ id: "b", insuredPersonId: "p1", category: "life", amount: Money.fromNumber(400_000), startDate: "2020-06-01" });
    const { flags } = engine.detect([a, b], STARTER_ENGINE_CONFIG);
    const w = STARTER_ENGINE_CONFIG.duplicateDetection.weights;
    expect(flags[0]?.duplicateScore).toBe(w.sameInsuredWeight + w.sameRiskWeight + w.overlappingBenefitWeight + w.overlappingTermWeight);
  });

  it("7. no false positive across an entire realistic household (3 unrelated policies)", () => {
    const life = coverage({ id: "a", insuredPersonId: "p1", category: "life", amount: Money.fromNumber(500_000), startDate: "2020-01-01" });
    const disabilitySpouse = coverage({ id: "b", insuredPersonId: "p2", category: "disability", monthlyBenefit: Money.fromNumber(5_000), startDate: "2019-01-01" });
    const health = coverage({ id: "c", insuredPersonId: "p1", category: "health", startDate: "2022-01-01" });
    const { flags } = engine.detect([life, disabilitySpouse, health], STARTER_ENGINE_CONFIG);
    expect(flags).toHaveLength(0);
  });
});
