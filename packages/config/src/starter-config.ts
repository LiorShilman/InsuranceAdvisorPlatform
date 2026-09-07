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

  // Scaled so the six positive terms sum to 100 when every factor is at
  // its max (1.0) — see docs/ASSUMPTIONS.md.
  priorityWeights: {
    severityWeight: 20,
    probabilityWeight: 15,
    dependencyWeight: 15,
    gapWeight: 25,
    irreplaceabilityWeight: 15,
    urgencyWeight: 10,
    existingCoverageWeight: 30,
  },

  // Invented placeholders, not yet differentiated by real actuarial data
  // (severity and exposure are currently the same number per category) —
  // see docs/ASSUMPTIONS.md.
  categoryRiskProfile: {
    life: { severity: 0.9, exposure: 0.3, irrecoverability: 0.95, urgency: 0.6 },
    disability: { severity: 0.85, exposure: 0.4, irrecoverability: 0.8, urgency: 0.6 },
    critical_illness: { severity: 0.8, exposure: 0.35, irrecoverability: 0.6, urgency: 0.5 },
    health: { severity: 0.5, exposure: 0.6, irrecoverability: 0.3, urgency: 0.4 },
    ltc: { severity: 0.7, exposure: 0.25, irrecoverability: 0.85, urgency: 0.3 },
    personal_accident: { severity: 0.5, exposure: 0.3, irrecoverability: 0.4, urgency: 0.4 },
  },

  // PRD §19.2 band names/cutoffs — "configurable", ordered highest-first.
  priorityBands: [
    { band: "CRITICAL", min: 80 },
    { band: "HIGH", min: 60 },
    { band: "MEDIUM", min: 40 },
    { band: "LOW", min: 20 },
    { band: "INFORMATIONAL", min: 0 },
  ],

  // NOT real pricing — see the field's own doc comment in engine-config.ts
  // and docs/ASSUMPTIONS.md. Calibrated only so it reproduces the PRD's
  // own §20 worked example exactly (budget 300/mo -> 1,200,000 coverage).
  affordability: {
    assumedAnnualPremiumRatePer1000Coverage: 3,
    maxAffordabilityPenaltyPoints: 20,
  },

  duplicatePenaltyPoints: 15,

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
