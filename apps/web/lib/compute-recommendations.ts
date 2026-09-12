import { Money, type Fact } from "@insurance-advisor/shared";
import { STARTER_ENGINE_CONFIG, type EngineConfig } from "@insurance-advisor/config";
import type { Recommendation } from "@insurance-advisor/domain";
import {
  LifeInsuranceCalculator,
  DisabilityInsuranceCalculator,
  CriticalIllnessCalculator,
  LongTermCareCalculator,
  HealthModuleAssessor,
  PriorityEngine,
  RecommendationBuilder,
  ReviewScheduler,
  BudgetAffordabilityEngine,
  factsToLifeCalculatorInput,
  factsToDisabilityCalculatorInput,
  factsToCriticalIllnessInput,
  factsToLongTermCareInput,
  factsToHealthInput,
  type LifeInsuranceResult,
  type DisabilityInsuranceResult,
  type CriticalIllnessResult,
  type LongTermCareResult,
  type HealthAssessmentResult,
  type PriorityResult,
  type AffordabilityResult,
} from "@insurance-advisor/calculators";
import type { CalculationTrace } from "@insurance-advisor/shared";

/**
 * Shared computation shared by `/questionnaire`'s live results and
 * `/report` — factored out so the ~150-line calculator/priority/
 * recommendation wiring exists in exactly one place instead of being
 * copy-pasted a third time. CI's recovery duration and LTC's expected
 * duration are read from `ciInput`/`ltcInput` (optional user-supplied
 * facts, defaulting to 6 months / 3 years — see facts-to-critical-illness-
 * input.ts / facts-to-ltc-input.ts) rather than fixed here, as of the
 * 2026-09-12 questionnaire widening (docs/DECISIONS.md).
 */

const lifeCalculator = new LifeInsuranceCalculator();
const disabilityCalculator = new DisabilityInsuranceCalculator();
const criticalIllnessCalculator = new CriticalIllnessCalculator();
const longTermCareCalculator = new LongTermCareCalculator();
const healthModuleAssessor = new HealthModuleAssessor();
const priorityEngine = new PriorityEngine();
const recommendationBuilder = new RecommendationBuilder();
const reviewScheduler = new ReviewScheduler();
const budgetAffordabilityEngine = new BudgetAffordabilityEngine();

export type ComputedRecommendations = {
  life: { result: LifeInsuranceResult; trace: CalculationTrace; priority: PriorityResult; recommendation: Recommendation; nextReviewDate: string; affordability: AffordabilityResult; coverageRatio: number };
  disability: { result: DisabilityInsuranceResult; trace: CalculationTrace; priority: PriorityResult; recommendation: Recommendation; nextReviewDate: string; coverageRatio: number };
  ci: { result: CriticalIllnessResult; trace: CalculationTrace; priority: PriorityResult; recommendation: Recommendation; nextReviewDate: string; coverageRatio: number };
  ltc: { result: LongTermCareResult; trace: CalculationTrace; priority: PriorityResult; recommendation: Recommendation; nextReviewDate: string; coverageRatio: number };
  health: HealthAssessmentResult;
  hasDependents: boolean;
};

/**
 * `engineConfig` defaults to the real starter config but can be overridden
 * — used by the Scenario Simulator (§23, lib/scenario-simulator.ts) to
 * recompute the exact same pipeline under a different discount rate
 * without duplicating any of this wiring.
 */
export function computeAllRecommendations(
  facts: Fact[],
  clientProfileId: string,
  now: Date = new Date(),
  engineConfig: EngineConfig = STARTER_ENGINE_CONFIG,
): ComputedRecommendations {
  const lifeInput = factsToLifeCalculatorInput(facts);
  const life = lifeCalculator.calculate(lifeInput, engineConfig);
  const hasDependents = lifeInput.dependentCount > 0;

  const disabilityInput = factsToDisabilityCalculatorInput(facts);
  const disability = disabilityCalculator.calculate(disabilityInput, engineConfig);

  const ciInput = factsToCriticalIllnessInput(facts);
  const ci = criticalIllnessCalculator.calculate(ciInput, engineConfig);

  const ltcInput = factsToLongTermCareInput(facts);
  const ltc = longTermCareCalculator.calculate(ltcInput, engineConfig);

  const health = healthModuleAssessor.assess(factsToHealthInput(facts), engineConfig);

  // Budget/Affordability (§20) — scoped to life's lump-sum gap only, per docs/DECISIONS.md.
  // Never shrinks the calculated need itself; only adds a second, budget-constrained option.
  const monthlyBudgetValue = facts.find((f) => f.key === "budget.monthlyProtectionBudget")?.value;
  const monthlyBudget = typeof monthlyBudgetValue === "number" ? Money.fromNumber(monthlyBudgetValue) : undefined;
  const lifeAffordability = budgetAffordabilityEngine.evaluate({ calculatedNeed: life.result.gap, monthlyBudget }, engineConfig);

  const lifeGapFactors = PriorityEngine.gapRatioAndCoverageAdequacy(life.result.grossNeed.toNumber(), life.result.availableResources.toNumber());
  const lifePriority = priorityEngine.score(
    { category: "life", ...lifeGapFactors, hasDependents, affordabilityPenalty: lifeAffordability.affordabilityPenalty },
    engineConfig,
  );
  const disabilityGapFactors = PriorityEngine.gapRatioAndCoverageAdequacy(
    disability.result.requiredMonthlyIncome.toNumber(),
    disability.result.existingNetExpectedDisabilityIncome.toNumber(),
  );
  const disabilityPriority = priorityEngine.score(
    { category: "disability", ...disabilityGapFactors, hasDependents },
    engineConfig,
  );
  const ciGapFactors = PriorityEngine.gapRatioAndCoverageAdequacy(ci.result.need.toNumber(), ci.result.existingCoverage.toNumber());
  const ciPriority = priorityEngine.score(
    { category: "critical_illness", ...ciGapFactors, hasDependents },
    engineConfig,
  );
  const ltcGapFactors = PriorityEngine.gapRatioAndCoverageAdequacy(ltc.result.capitalNeed.toNumber(), 0);
  const ltcPriority = priorityEngine.score(
    { category: "ltc", ...ltcGapFactors, hasDependents },
    engineConfig,
  );

  const lifeRecommendation = recommendationBuilder.build(
    {
      clientProfileId,
      category: "life",
      title: "ביטוח חיים",
      needAmount: life.result.grossNeed,
      existingAmount: life.result.availableResources,
      gapAmount: life.result.gap,
      horizon: { type: "years", value: life.result.horizonYears },
      reasonCodes: life.result.reasonCodes,
      reviewTriggers: life.result.reviewTriggers,
      missingFacts: life.result.missingFacts,
      assumptions: life.result.assumptions,
      confidence: life.result.confidence,
      calculationTraceId: life.trace.id,
      priority: lifePriority,
    },
    engineConfig,
  );
  const disabilityRecommendation = recommendationBuilder.build(
    {
      clientProfileId,
      category: "disability",
      title: "ביטוח אבדן כושר עבודה",
      needAmount: disability.result.requiredMonthlyIncome,
      existingAmount: disability.result.existingNetExpectedDisabilityIncome,
      gapAmount: disability.result.monthlyGap,
      monthlyBenefitTarget: disability.result.monthlyGap,
      horizon: disability.result.recommendedDurationYears !== undefined ? { type: "years", value: disability.result.recommendedDurationYears } : undefined,
      reasonCodes: disability.result.reasonCodes,
      reviewTriggers: disability.result.reviewTriggers,
      missingFacts: disability.result.missingFacts,
      assumptions: disability.result.assumptions,
      confidence: disability.result.confidence,
      calculationTraceId: disability.trace.id,
      priority: disabilityPriority,
    },
    engineConfig,
  );
  const ciRecommendation = recommendationBuilder.build(
    {
      clientProfileId,
      category: "critical_illness",
      title: "ביטוח מחלות קשות",
      needAmount: ci.result.need,
      existingAmount: ci.result.existingCoverage,
      gapAmount: ci.result.gap,
      reasonCodes: ci.result.reasonCodes,
      reviewTriggers: ci.result.reviewTriggers,
      missingFacts: ci.result.missingFacts,
      assumptions: ci.result.assumptions,
      confidence: ci.result.confidence,
      calculationTraceId: ci.trace.id,
      priority: ciPriority,
    },
    engineConfig,
  );
  const ltcRecommendation = recommendationBuilder.build(
    {
      clientProfileId,
      category: "ltc",
      title: "ביטוח סיעודי",
      needAmount: ltc.result.capitalNeed,
      existingAmount: Money.zero(),
      gapAmount: ltc.result.capitalNeed,
      horizon: { type: "years", value: ltcInput.expectedDurationYears },
      reasonCodes: ltc.result.reasonCodes,
      reviewTriggers: ltc.result.reviewTriggers,
      missingFacts: ltc.result.missingFacts,
      assumptions: ltc.result.assumptions,
      confidence: ltc.result.confidence,
      calculationTraceId: ltc.trace.id,
      priority: ltcPriority,
    },
    engineConfig,
  );

  return {
    life: {
      result: life.result,
      trace: life.trace,
      priority: lifePriority,
      recommendation: lifeRecommendation,
      nextReviewDate: reviewScheduler.nextReviewDate(lifeRecommendation, now),
      affordability: lifeAffordability,
      coverageRatio: lifeGapFactors.coverageAdequacy,
    },
    disability: {
      result: disability.result,
      trace: disability.trace,
      priority: disabilityPriority,
      recommendation: disabilityRecommendation,
      nextReviewDate: reviewScheduler.nextReviewDate(disabilityRecommendation, now),
      coverageRatio: disabilityGapFactors.coverageAdequacy,
    },
    ci: {
      result: ci.result,
      trace: ci.trace,
      priority: ciPriority,
      recommendation: ciRecommendation,
      nextReviewDate: reviewScheduler.nextReviewDate(ciRecommendation, now),
      coverageRatio: ciGapFactors.coverageAdequacy,
    },
    ltc: {
      result: ltc.result,
      trace: ltc.trace,
      priority: ltcPriority,
      recommendation: ltcRecommendation,
      nextReviewDate: reviewScheduler.nextReviewDate(ltcRecommendation, now),
      coverageRatio: ltcGapFactors.coverageAdequacy,
    },
    health,
    hasDependents,
  };
}
