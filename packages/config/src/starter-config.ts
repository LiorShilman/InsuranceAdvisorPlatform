import { Money } from "@insurance-advisor/shared";
import type { EngineConfig } from "./engine-config.js";

/**
 * A single seed config version so the domain/calculators packages have
 * something concrete to reference in tests. Every numeric default here is
 * a placeholder — see docs/ASSUMPTIONS.md. None of these values have
 * actuarial or regulatory review; they exist only so Milestone 1's types
 * and fixtures compile and the arithmetic in later milestones has
 * something to plug into.
 */
export const STARTER_ENGINE_CONFIG: EngineConfig = {
  version: "2026.09.0-draft",
  effectiveFrom: "2026-09-07",

  financialAssumptions: {
    realDiscountRate: 0.02,
    inflationRate: 0.025,
    salaryGrowthRate: 0.02,
  },

  dependentAssumptions: {
    targetAge: 21,
    allowUserOverride: true,
  },

  thresholds: {
    materialGap: Money.fromNumber(50_000),
    incomeChangeReviewPct: 20,
  },

  priorityWeights: {
    severityWeight: 1,
    probabilityWeight: 1,
    dependencyWeight: 1,
    gapWeight: 1,
    irreplaceabilityWeight: 1,
    urgencyWeight: 1,
    existingCoverageWeight: 1,
    affordabilityPenalty: 1,
    duplicatePenalty: 1,
  },

  careAssumptions: {
    // Invented placeholder, not a real cost-of-care survey figure — see docs/ASSUMPTIONS.md.
    assumedMonthlyLTCCareCost: Money.fromNumber(18_000),
  },

  // Invented placeholders, calibrated so sameInsuredWeight + sameRiskWeight
  // + overlappingTermWeight are jointly load-bearing (any two of those
  // three alone can never reach scoreThreshold) and overlappingBenefitWeight
  // is only a minor tie-breaker on top — see docs/ASSUMPTIONS.md for why:
  // genuine duplication needs the same person, the same risk, AND actual
  // time overlap; two different people, two different risks, or two
  // non-overlapping (sequential) policies on the same risk are not
  // duplicates just because they're similar in other ways.
  duplicateDetection: {
    weights: {
      sameInsuredWeight: 30,
      sameRiskWeight: 30,
      overlappingBenefitWeight: 10,
      overlappingTermWeight: 30,
    },
    scoreThreshold: 80,
  },

  // Invented placeholders, not a product/actuarial recommendation — see docs/ASSUMPTIONS.md.
  healthModuleDefaultNeedWhenMissing: {
    surgeries_israel: "high",
    surgeries_abroad: "medium",
    transplants: "high",
    special_treatments_abroad: "medium",
    medications_outside_basket: "high",
    ambulatory: "low",
    personalized_medicine: "low",
  },
};
