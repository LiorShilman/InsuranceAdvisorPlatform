import { Money } from "@insurance-advisor/shared";
import type { DuplicateDetectionFactors, HealthCoverageModule, InsuranceCategory } from "@insurance-advisor/domain";

/**
 * Versioned engine configuration — PRD §41. Every Analysis snapshot stores
 * the config version it ran against (rule 9), so old reports stay
 * reproducible (PRD §60 item 8) even after this file changes.
 */
export type EngineConfig = {
  version: string;
  effectiveFrom: string;

  financialAssumptions: {
    /** PRD §12.3 — real discount rate used for PV(t) income-replacement math. */
    realDiscountRate: number;
    inflationRate: number;
    salaryGrowthRate: number;
  };

  dependentAssumptions: {
    /** PRD §12.4 — default independence age; per-dependent override allowed. */
    targetAge: number;
    allowUserOverride: boolean;
  };

  thresholds: {
    materialGap: Money;
    incomeChangeReviewPct: number;
  };

  /**
   * PRD §19.1's PriorityScore formula, spelled out as named fields instead
   * of a loose Record so a typo can't silently produce a zero-weight term.
   * PRD explicitly calls these weights "not magic constants" that must
   * live in DB/config, not what their actual values should be — still
   * unreviewed placeholders, calibrated only so the six positive terms sum
   * to 100 at their max (1.0 each) — see docs/ASSUMPTIONS.md.
   */
  priorityWeights: {
    severityWeight: number;
    probabilityWeight: number;
    dependencyWeight: number;
    gapWeight: number;
    irreplaceabilityWeight: number;
    urgencyWeight: number;
    existingCoverageWeight: number;
  };

  /**
   * PRD §19.1 also needs per-category severity/exposure/irreplaceability/
   * urgency inputs to multiply those weights against, and gives no way to
   * derive them from calculator output — same "PRD names the factor, not
   * the formula" situation as healthModuleDefaultNeedWhenMissing. All
   * values 0..1, all invented placeholders not yet differentiated by real
   * actuarial input (severity and exposure currently share the same
   * number per category) — see docs/ASSUMPTIONS.md.
   */
  categoryRiskProfile: Record<InsuranceCategory, { severity: number; exposure: number; irrecoverability: number; urgency: number }>;

  /** PRD §19.2 — band names and cutoffs are explicitly "configurable". Ordered highest-first; the first band whose min a score meets/exceeds wins. */
  priorityBands: Array<{ band: string; min: number }>;

  /**
   * PRD §20's Budget/Affordability layer needs *some* premium-to-coverage
   * conversion to turn a monthly budget into a coverage amount, but real
   * pricing is explicitly Phase 2 Product Matching (§3.2, §50) — not
   * built yet. This ratio is a rough, clearly-labeled stand-in so the §20
   * mechanic (calculated need vs budget-constrained option vs remaining
   * gap) is demonstrable end-to-end; it is NOT real premium pricing and
   * must not be presented to a user as such. See docs/REGULATORY-TODO.md
   * and docs/ASSUMPTIONS.md.
   */
  affordability: {
    assumedAnnualPremiumRatePer1000Coverage: number;
    maxAffordabilityPenaltyPoints: number;
  };

  /** Flat priority-score deduction when the deduplication engine (§18) flags a coverage as a likely duplicate. */
  duplicatePenaltyPoints: number;

  /**
   * PRD §16 explicitly frames "expected monthly care cost" as a
   * system-level assumption, not something derived per household — unlike
   * the other calculators' unknown-personal-data fields (which fall back
   * to 0), a missing personal figure here falls back to this configured
   * estimate instead. Still an unreviewed placeholder — see docs/ASSUMPTIONS.md.
   */
  careAssumptions: {
    assumedMonthlyLTCCareCost: Money;
  };

  /**
   * PRD §18 gives the four duplicateScore factor names but no weights or
   * threshold. Config-driven per rules 10-11; unreviewed placeholders —
   * see docs/ASSUMPTIONS.md.
   */
  duplicateDetection: {
    weights: DuplicateDetectionFactors;
    /** Only flag a pair when their combined score reaches this (PRD §18: "רק אם duplicateScore גבוה"). */
    scoreThreshold: number;
  };

  /**
   * PRD §15 gives module names but no need-scoring formula. This is the
   * fallback "need" level used when a module is known to be absent
   * (`existing: false`) — config-driven rather than hard-coded in the
   * assessor, per rule 10/11, but still an invented placeholder pending
   * real product/underwriting input. See docs/ASSUMPTIONS.md.
   */
  healthModuleDefaultNeedWhenMissing: Record<HealthCoverageModule, "high" | "medium" | "low">;
};
