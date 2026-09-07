import { Money, type Assumption } from "@insurance-advisor/shared";
import type {
  InsuranceCategory,
  Recommendation,
  RecommendationHorizon,
  RecommendationStatus,
  ReviewTrigger,
} from "@insurance-advisor/domain";
import type { EngineConfig } from "@insurance-advisor/config";
import type { PriorityResult } from "./priority-engine.js";

/**
 * Assembles the canonical PRD §21 `Recommendation` entity from a
 * calculator's output + a `PriorityResult` (§19) + a `CalculationTrace`
 * id — the "Recommendation Presenter" step at the end of the §10 pipeline.
 *
 * `explainabilityComplete` here means the narrower, structural claim that
 * every field PRD §53 lists has *something* populated on this object
 * (a trace id, an assumptions array, a missingFacts array) — not the
 * full product claim that the entire system's rule-version/exclusion
 * provenance chain is wired end-to-end, since the rule engine (§11) isn't
 * yet integrated into this assembly step. See docs/DECISIONS.md.
 */
export type RecommendationInput = {
  clientProfileId: string;
  category: InsuranceCategory;
  title: string;

  needAmount: Money;
  existingAmount: Money;
  gapAmount: Money;
  monthlyBenefitTarget?: Money;

  horizon?: RecommendationHorizon;

  reasonCodes: string[];
  reviewTriggers: ReviewTrigger[];
  missingFacts: string[];
  assumptions: Assumption[];
  confidence: "high" | "medium" | "low";

  calculationTraceId: string;
  priority: PriorityResult;
};

function newId(): string {
  return globalThis.crypto.randomUUID();
}

function widenByConfidence(target: Money, confidence: "high" | "medium" | "low"): { min: Money; target: Money; max: Money } {
  const widenPct = confidence === "low" ? 0.25 : confidence === "medium" ? 0.1 : 0;
  return { min: target.multiply(1 - widenPct), target, max: target.multiply(1 + widenPct) };
}

function deriveStatus(input: RecommendationInput, config: EngineConfig): RecommendationStatus {
  if (input.gapAmount.isZero() && input.needAmount.isZero()) {
    return "not_needed";
  }
  if (input.gapAmount.isZero()) {
    return "review_existing"; // a real need exists but it's already fully met
  }
  if (input.confidence === "low") {
    return "manual_review";
  }
  if (input.gapAmount.lessThan(config.thresholds.materialGap)) {
    return "consider"; // real but small gap — not urgent
  }
  return "recommended";
}

function buildRationale(input: RecommendationInput, status: RecommendationStatus): string[] {
  const rationale: string[] = [];
  if (status === "not_needed") {
    rationale.push("לא זוהה צורך מהותי בקטגוריה זו לפי הנתונים שסופקו.");
    return rationale;
  }
  if (status === "review_existing") {
    rationale.push("הכיסוי הקיים מכסה את הצורך המחושב — מומלץ לוודא שתנאי הפוליסה עדיין רלוונטיים.");
    return rationale;
  }
  rationale.push(
    `זוהה פער של ${input.gapAmount.toDisplayString("nearest_1000")} ₪ בין הצורך המחושב (${input.needAmount.toDisplayString("nearest_1000")} ₪) לבין הכיסוי הקיים (${input.existingAmount.toDisplayString("nearest_1000")} ₪).`,
  );
  if (status === "manual_review") {
    rationale.push("רמת אמינות הנתונים נמוכה — מומלץ בירור ידני לפני קבלת החלטה.");
  }
  return rationale;
}

export class RecommendationBuilder {
  build(input: RecommendationInput, config: EngineConfig): Recommendation {
    const status = deriveStatus(input, config);
    const range = widenByConfidence(input.gapAmount, input.confidence);
    const now = new Date().toISOString();

    return {
      id: newId(),
      createdAt: now,
      updatedAt: now,

      clientProfileId: input.clientProfileId,
      category: input.category,
      title: input.title,

      status,

      priorityScore: input.priority.score,
      priorityBand: input.priority.band,

      needAmount: input.needAmount,
      existingAmount: input.existingAmount,
      gapAmount: input.gapAmount,

      recommendedMin: range.min,
      recommendedTarget: range.target,
      recommendedMax: range.max,

      monthlyBenefitTarget: input.monthlyBenefitTarget,

      horizon: input.horizon,

      reviewTriggers: input.reviewTriggers,

      rationale: buildRationale(input, status),
      reasonCodes: input.reasonCodes,

      missingFacts: input.missingFacts,
      assumptions: input.assumptions,
      warnings: input.confidence === "low" ? ["נתונים חסרים משמעותיים — התוצאה עשויה להשתנות עם השלמת מידע."] : [],

      confidence: input.confidence,

      calculationTraceId: input.calculationTraceId,

      // Structural completeness only — see this file's top-of-file doc comment.
      explainabilityComplete: true,
    };
  }
}
