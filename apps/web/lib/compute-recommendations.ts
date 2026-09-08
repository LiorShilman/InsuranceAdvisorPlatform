import { Money, type Fact } from "@insurance-advisor/shared";
import { STARTER_ENGINE_CONFIG } from "@insurance-advisor/config";
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
 * copy-pasted a third time. Fixed scenario parameters (CI: 6 months, LTC:
 * 3 years) — same simplification noted in docs/DECISIONS.md for the
 * questionnaire flow.
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
  life: { result: LifeInsuranceResult; trace: CalculationTrace; priority: PriorityResult; recommendation: Recommendation; nextReviewDate: string; affordability: AffordabilityResult };
  disability: { result: DisabilityInsuranceResult; trace: CalculationTrace; priority: PriorityResult; recommendation: Recommendation; nextReviewDate: string };
  ci: { result: CriticalIllnessResult; trace: CalculationTrace; priority: PriorityResult; recommendation: Recommendation; nextReviewDate: string };
  ltc: { result: LongTermCareResult; trace: CalculationTrace; priority: PriorityResult; recommendation: Recommendation; nextReviewDate: string };
  health: HealthAssessmentResult;
  hasDependents: boolean;
};

export function computeAllRecommendations(facts: Fact[], clientProfileId: string, now: Date = new Date()): ComputedRecommendations {
  const lifeInput = factsToLifeCalculatorInput(facts);
  const life = lifeCalculator.calculate(lifeInput, STARTER_ENGINE_CONFIG);
  const hasDependents = lifeInput.dependentCount > 0;

  const disabilityInput = factsToDisabilityCalculatorInput(facts);
  const disability = disabilityCalculator.calculate(disabilityInput, STARTER_ENGINE_CONFIG);

  const ciInput = factsToCriticalIllnessInput(facts);
  const ci = criticalIllnessCalculator.calculate({ ...ciInput, recoveryDurationMonths: 6 }, STARTER_ENGINE_CONFIG);

  const ltcInput = factsToLongTermCareInput(facts);
  const ltc = longTermCareCalculator.calculate({ ...ltcInput, expectedDurationYears: 3 }, STARTER_ENGINE_CONFIG);

  const health = healthModuleAssessor.assess(factsToHealthInput(facts), STARTER_ENGINE_CONFIG);

  // Budget/Affordability (§20) — scoped to life's lump-sum gap only, per docs/DECISIONS.md.
  // Never shrinks the calculated need itself; only adds a second, budget-constrained option.
  const monthlyBudgetValue = facts.find((f) => f.key === "budget.monthlyProtectionBudget")?.value;
  const monthlyBudget = typeof monthlyBudgetValue === "number" ? Money.fromNumber(monthlyBudgetValue) : undefined;
  const lifeAffordability = budgetAffordabilityEngine.evaluate({ calculatedNeed: life.result.gap, monthlyBudget }, STARTER_ENGINE_CONFIG);

  const lifePriority = priorityEngine.score(
    {
      category: "life",
      ...PriorityEngine.gapRatioAndCoverageAdequacy(life.result.grossNeed.toNumber(), life.result.availableResources.toNumber()),
      hasDependents,
      affordabilityPenalty: lifeAffordability.affordabilityPenalty,
    },
    STARTER_ENGINE_CONFIG,
  );
  const disabilityPriority = priorityEngine.score(
    {
      category: "disability",
      ...PriorityEngine.gapRatioAndCoverageAdequacy(disability.result.requiredMonthlyIncome.toNumber(), disability.result.existingNetExpectedDisabilityIncome.toNumber()),
      hasDependents,
    },
    STARTER_ENGINE_CONFIG,
  );
  const ciPriority = priorityEngine.score(
    { category: "critical_illness", ...PriorityEngine.gapRatioAndCoverageAdequacy(ci.result.need.toNumber(), ci.result.existingCoverage.toNumber()), hasDependents },
    STARTER_ENGINE_CONFIG,
  );
  const ltcPriority = priorityEngine.score(
    { category: "ltc", ...PriorityEngine.gapRatioAndCoverageAdequacy(ltc.result.capitalNeed.toNumber(), 0), hasDependents },
    STARTER_ENGINE_CONFIG,
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
    STARTER_ENGINE_CONFIG,
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
    STARTER_ENGINE_CONFIG,
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
    STARTER_ENGINE_CONFIG,
  );
  const ltcRecommendation = recommendationBuilder.build(
    {
      clientProfileId,
      category: "ltc",
      title: "ביטוח סיעודי",
      needAmount: ltc.result.capitalNeed,
      existingAmount: Money.zero(),
      gapAmount: ltc.result.capitalNeed,
      horizon: { type: "years", value: 3 },
      reasonCodes: ltc.result.reasonCodes,
      reviewTriggers: ltc.result.reviewTriggers,
      missingFacts: ltc.result.missingFacts,
      assumptions: ltc.result.assumptions,
      confidence: ltc.result.confidence,
      calculationTraceId: ltc.trace.id,
      priority: ltcPriority,
    },
    STARTER_ENGINE_CONFIG,
  );

  return {
    life: { result: life.result, trace: life.trace, priority: lifePriority, recommendation: lifeRecommendation, nextReviewDate: reviewScheduler.nextReviewDate(lifeRecommendation, now), affordability: lifeAffordability },
    disability: { result: disability.result, trace: disability.trace, priority: disabilityPriority, recommendation: disabilityRecommendation, nextReviewDate: reviewScheduler.nextReviewDate(disabilityRecommendation, now) },
    ci: { result: ci.result, trace: ci.trace, priority: ciPriority, recommendation: ciRecommendation, nextReviewDate: reviewScheduler.nextReviewDate(ciRecommendation, now) },
    ltc: { result: ltc.result, trace: ltc.trace, priority: ltcPriority, recommendation: ltcRecommendation, nextReviewDate: reviewScheduler.nextReviewDate(ltcRecommendation, now) },
    health,
    hasDependents,
  };
}
