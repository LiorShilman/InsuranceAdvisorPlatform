import { Money, type CalculationTrace } from "@insurance-advisor/shared";
import type { EngineConfig } from "@insurance-advisor/config";

/**
 * Generic contract every need calculator (life §12, disability §13,
 * critical illness §14, health §15, LTC §16) will implement. Milestone 1
 * defines the interface only — no calculator math ships yet (that's
 * Milestone 3 / the PRD's own "Second Prompt", §48). Every implementation
 * must, per PRD rule 8, return a CalculationTrace alongside its result.
 */
export interface NeedsCalculator<TInput, TOutput> {
  readonly key: string;
  calculate(input: TInput, config: EngineConfig): CalculatorResult<TOutput>;
}

export type CalculatorResult<TOutput> = {
  result: TOutput;
  trace: CalculationTrace;
};

/**
 * Shared shape behind every "need vs existing coverage vs gap" calculation
 * (PRD §12.2 LifeGap, §13.3 MonthlyDisabilityGap, §14 CriticalIllnessGap,
 * §16 MonthlyLTCGap all follow this same max(0, need - resources) pattern).
 */
export type GapResult = {
  grossNeed: Money;
  availableResources: Money;
  /** max(0, grossNeed - availableResources) — never negative (PRD §43 safety test). */
  gap: Money;
};
