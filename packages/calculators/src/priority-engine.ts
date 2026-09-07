import type { InsuranceCategory } from "@insurance-advisor/domain";
import type { EngineConfig } from "@insurance-advisor/config";

/**
 * Recommendation Priority Engine — PRD §19. The PRD gives the formula
 * shape (§19.1) and band names (§19.2) but not how to compute
 * severity/exposure/dependentImpact/irrecoverability/urgency from
 * calculator output — those come from `config.categoryRiskProfile`
 * (per-category placeholders) plus two inputs this engine *can* derive
 * honestly from what's already been calculated: gapRatio, coverageAdequacy,
 * and whether the household has dependents.
 */
export type PriorityFactors = {
  category: InsuranceCategory;
  /** gap / grossNeed, clamped to [0,1]; 0 when grossNeed is 0 (nothing to be short of). */
  gapRatio: number;
  /** existing / grossNeed, clamped to [0,1]; 1 when grossNeed is 0 (fully "adequate" because nothing is needed). */
  coverageAdequacy: number;
  hasDependents: boolean;
  /** 0..config.affordability.maxAffordabilityPenaltyPoints — from the Budget/Affordability layer (§20), 0 if not evaluated. */
  affordabilityPenalty?: number;
  /** From the deduplication engine (§18) — true if this coverage/need was flagged as a likely duplicate. */
  duplicateFlagged?: boolean;
};

export type PriorityResult = {
  score: number;
  band: string;
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export class PriorityEngine {
  score(factors: PriorityFactors, config: EngineConfig): PriorityResult {
    const risk = config.categoryRiskProfile[factors.category];
    const w = config.priorityWeights;

    const dependencyImpact = factors.hasDependents ? 1 : 0.3;
    const gapRatio = clamp01(factors.gapRatio);
    const coverageAdequacy = clamp01(factors.coverageAdequacy);

    const raw =
      w.severityWeight * risk.severity +
      w.probabilityWeight * risk.exposure +
      w.dependencyWeight * dependencyImpact +
      w.gapWeight * gapRatio +
      w.irreplaceabilityWeight * risk.irrecoverability +
      w.urgencyWeight * risk.urgency -
      w.existingCoverageWeight * coverageAdequacy -
      (factors.affordabilityPenalty ?? 0) -
      (factors.duplicateFlagged ? config.duplicatePenaltyPoints : 0);

    const score = Math.max(0, Math.min(100, Math.round(raw)));

    const band = config.priorityBands.find((b) => score >= b.min)?.band ?? config.priorityBands.at(-1)?.band ?? "INFORMATIONAL";

    return { score, band };
  }

  /** Convenience for the common case: derive gapRatio/coverageAdequacy from raw amounts. */
  static gapRatioAndCoverageAdequacy(needAmount: number, existingAmount: number): { gapRatio: number; coverageAdequacy: number } {
    if (needAmount <= 0) {
      return { gapRatio: 0, coverageAdequacy: 1 };
    }
    const gap = Math.max(0, needAmount - existingAmount);
    return { gapRatio: clamp01(gap / needAmount), coverageAdequacy: clamp01(existingAmount / needAmount) };
  }
}
