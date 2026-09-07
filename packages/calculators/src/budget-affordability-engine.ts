import { Money } from "@insurance-advisor/shared";
import type { EngineConfig } from "@insurance-advisor/config";

/**
 * Budget / Affordability layer — PRD §20. Hard rule from the PRD itself:
 * affordability must NEVER shrink the calculated need — it only adds a
 * second, budget-constrained option alongside it, and the remaining gap
 * stays visible, never hidden ("אין 'מעלימים' gap").
 *
 * The premium-to-coverage conversion this needs is explicitly NOT real
 * pricing (see `EngineConfig.affordability`'s doc comment) — real pricing
 * is Phase 2 Product Matching (PRD §3.2, §50). Scoped to lump-sum
 * (coverage-amount) needs only; the monthly-benefit calculators
 * (disability, LTC) aren't run through this in Milestone 5.
 */
export type AffordabilityInput = {
  calculatedNeed: Money;
  /** What the household said they're comfortable allocating monthly (PRD §20's question) — undefined if not asked/answered yet. */
  monthlyBudget?: Money;
};

export type AffordabilityResult = {
  calculatedNeed: Money;
  /** undefined when no budget was given — there is no budget-constrained option to show. */
  budgetSupportedCoverage?: Money;
  /** max(0, calculatedNeed - budgetSupportedCoverage) — always shown, never hidden, even when it's the full need. */
  remainingUninsuredGap: Money;
  /** 0..config.affordability.maxAffordabilityPenaltyPoints, scaled by how far short the budget falls of fully covering the need. Feeds PriorityEngine. */
  affordabilityPenalty: number;
};

export class BudgetAffordabilityEngine {
  readonly key = "budget_affordability";

  evaluate(input: AffordabilityInput, config: EngineConfig): AffordabilityResult {
    if (input.monthlyBudget === undefined) {
      return {
        calculatedNeed: input.calculatedNeed,
        remainingUninsuredGap: input.calculatedNeed,
        affordabilityPenalty: 0,
      };
    }

    const { assumedAnnualPremiumRatePer1000Coverage, maxAffordabilityPenaltyPoints } = config.affordability;
    // annual premium per 1 ILS of coverage = rate/1000; monthly = that/12.
    const monthlyPremiumPerIls = assumedAnnualPremiumRatePer1000Coverage / 1000 / 12;
    const budgetSupportedCoverage = input.monthlyBudget.divide(monthlyPremiumPerIls);

    const remainingUninsuredGap = Money.max(Money.zero(), input.calculatedNeed.subtract(budgetSupportedCoverage));

    const shortfallRatio = input.calculatedNeed.isZero()
      ? 0
      : Math.max(0, Math.min(1, remainingUninsuredGap.toNumber() / input.calculatedNeed.toNumber()));
    const affordabilityPenalty = Math.round(shortfallRatio * maxAffordabilityPenaltyPoints);

    return {
      calculatedNeed: input.calculatedNeed,
      budgetSupportedCoverage,
      remainingUninsuredGap,
      affordabilityPenalty,
    };
  }
}
