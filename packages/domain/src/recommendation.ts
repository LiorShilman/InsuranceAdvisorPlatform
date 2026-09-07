import { Money, type Assumption, type FactReference } from "@insurance-advisor/shared";
import type { RuleTrace } from "@insurance-advisor/rules";
import type { BaseEntity } from "./base.js";

/**
 * Recommendation — PRD §21 is the canonical shape. §4.2's
 * RecommendationAudit.output is treated as *referencing* this same type,
 * not a second definition (flagged in the approved plan's ambiguity list).
 *
 * PRD rule 6 ("all money uses Decimal") is applied even where the PRD's own
 * §21 pseudocode used a bare `number` for amount fields — Money is used
 * consistently instead, matching §12.6's LifeRecommendation. See
 * docs/DECISIONS.md.
 */
export type InsuranceCategory =
  | "life"
  | "disability"
  | "critical_illness"
  | "health"
  | "ltc"
  | "personal_accident";

export type RecommendationStatus =
  | "recommended"
  | "consider"
  | "not_needed"
  | "review_existing"
  | "manual_review";

export type ConfidenceLevel = "high" | "medium" | "low";

export type ReviewTrigger =
  | "marriage"
  | "divorce"
  | "birth"
  | "child_independent"
  | "income_change_20pct"
  | "new_mortgage"
  | "mortgage_repaid"
  | "job_change"
  | "self_employment"
  | "retirement"
  | "major_asset_change"
  | "major_health_change"
  | "policy_expiry"
  | "annual_review";

export type RecommendationHorizon = {
  type: "age" | "date" | "years" | "event";
  value: string | number;
};

export type Recommendation = BaseEntity & {
  clientProfileId: string;
  category: InsuranceCategory;
  title: string;

  status: RecommendationStatus;

  priorityScore: number;
  priorityBand: string;

  needAmount?: Money;
  existingAmount?: Money;
  gapAmount?: Money;

  recommendedMin?: Money;
  recommendedTarget?: Money;
  recommendedMax?: Money;

  monthlyBenefitTarget?: Money;

  horizon?: RecommendationHorizon;

  reviewTriggers: ReviewTrigger[];

  rationale: string[];
  reasonCodes: string[];

  missingFacts: string[];
  assumptions: Assumption[];
  warnings: string[];

  confidence: ConfidenceLevel;

  calculationTraceId: string;

  /**
   * PRD §53 — no recommendation may be returned unless this is true. Left
   * as a plain field (not enforced by a constructor/validator yet) because
   * the explanation/audit service that sets it doesn't exist until a later
   * milestone.
   */
  explainabilityComplete: boolean;
};

/** PRD §4.2 — the immutable audit record every Recommendation must produce. */
export type RecommendationAudit = {
  recommendationId: string;
  userId: string;
  questionnaireVersion: string;
  ruleEngineVersion: string;
  policyCatalogVersion?: string;
  createdAt: string;

  inputSnapshotHash: string;
  factsUsed: FactReference[];
  assumptions: Assumption[];
  formulas: string[]; // CalculationTrace ids — see packages/shared CalculationTrace
  rulesTriggered: RuleTrace[];
  exclusionsTriggered: RuleTrace[];

  output: Recommendation;
};
