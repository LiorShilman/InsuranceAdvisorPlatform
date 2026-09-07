import { Money } from "@insurance-advisor/shared";
import type { HealthCoverageModule } from "@insurance-advisor/domain";

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

  priorityWeights: Record<string, number>;

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
   * PRD §15 gives module names but no need-scoring formula. This is the
   * fallback "need" level used when a module is known to be absent
   * (`existing: false`) — config-driven rather than hard-coded in the
   * assessor, per rule 10/11, but still an invented placeholder pending
   * real product/underwriting input. See docs/ASSUMPTIONS.md.
   */
  healthModuleDefaultNeedWhenMissing: Record<HealthCoverageModule, "high" | "medium" | "low">;
};
