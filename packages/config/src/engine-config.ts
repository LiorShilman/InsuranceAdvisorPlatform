import { Money } from "@insurance-advisor/shared";

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
};
