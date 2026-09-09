import type { Fact } from "@insurance-advisor/shared";
import { STARTER_ENGINE_CONFIG, type EngineConfig } from "@insurance-advisor/config";
import { computeAllRecommendations, type ComputedRecommendations } from "./compute-recommendations";

/**
 * PRD §23 Scenario Simulator, honestly-scoped: the PRD lists 9 adjustable
 * knobs (survivor income, lifestyle %, dependent target age, mortgage
 * payoff, education reserve, emergency reserve, discount rate,
 * self-funding assets, budget) and a fully-interactive slider UI. This
 * implements 2 of those 9 — lifestyle percentage and real discount rate —
 * as 4 fixed presets rather than live sliders over all 9. Both knobs are
 * real (they change actual calculator output, not cosmetic), chosen
 * because they're the two that meaningfully affect every Money-based
 * calculator at once, not just one category. Widening to the full slider
 * set is a distinct, larger follow-up — see docs/DECISIONS.md.
 */

export type ScenarioKey = "current" | "conservative" | "balanced" | "lean";

export type ScenarioPreset = {
  key: ScenarioKey;
  label: string;
  description: string;
  /** Multiplies expenses.household.monthly / expenses.dependents.monthly — "desired lifestyle percentage" (PRD §23). 1 = unchanged. */
  lifestylePercent: number;
  /** Added to financialAssumptions.realDiscountRate (PRD §23's "discount rate" knob). Negative = more conservative (bigger PV). */
  discountRateDelta: number;
};

// Unreviewed placeholders, same status as every other invented constant in
// this codebase (see docs/ASSUMPTIONS.md) — a product/actuarial call on
// what "conservative" vs "lean" concretely means, not a formula PRD §23
// itself specifies numbers for.
export const SCENARIO_PRESETS: ScenarioPreset[] = [
  { key: "current", label: "התרחיש הנוכחי", description: "בדיוק לפי מה שענית — ללא שינוי.", lifestylePercent: 1, discountRateDelta: 0 },
  {
    key: "conservative",
    label: "שמרני",
    description: "מגן על 115% מרמת ההוצאות שציינת, וריבית היוון נמוכה יותר (מגדיל את הצורך המחושב).",
    lifestylePercent: 1.15,
    discountRateDelta: -0.0075,
  },
  {
    key: "balanced",
    label: "מאוזן",
    description: "רזרבה מתונה מעל ההוצאות שציינת (105%), עם ריבית היוון סטנדרטית.",
    lifestylePercent: 1.05,
    discountRateDelta: -0.0025,
  },
  {
    key: "lean",
    label: "חסכוני",
    description: "כיסוי מינימלי — 90% מרמת ההוצאות שציינת, וריבית היוון גבוהה יותר (מקטין את הצורך המחושב).",
    lifestylePercent: 0.9,
    discountRateDelta: 0.0075,
  },
];

const LIFESTYLE_SCALED_FACT_KEYS = new Set(["expenses.household.monthly", "expenses.dependents.monthly"]);

function scaleFactsForLifestyle(facts: Fact[], lifestylePercent: number): Fact[] {
  if (lifestylePercent === 1) return facts;
  return facts.map((f) => {
    if (!LIFESTYLE_SCALED_FACT_KEYS.has(f.key) || typeof f.value !== "number") return f;
    return { ...f, value: Math.round(f.value * lifestylePercent) };
  });
}

function configForDiscountRateDelta(delta: number): EngineConfig {
  if (delta === 0) return STARTER_ENGINE_CONFIG;
  return {
    ...STARTER_ENGINE_CONFIG,
    financialAssumptions: {
      ...STARTER_ENGINE_CONFIG.financialAssumptions,
      // Floor at a hair above 0 — a zero/negative real discount rate isn't
      // meaningful for the PV formula and isn't something any preset above
      // should ever actually reach.
      realDiscountRate: Math.max(0.001, STARTER_ENGINE_CONFIG.financialAssumptions.realDiscountRate + delta),
    },
  };
}

export function computeScenario(facts: Fact[], clientProfileId: string, now: Date, preset: ScenarioPreset): ComputedRecommendations {
  const scaledFacts = scaleFactsForLifestyle(facts, preset.lifestylePercent);
  const config = configForDiscountRateDelta(preset.discountRateDelta);
  return computeAllRecommendations(scaledFacts, clientProfileId, now, config);
}

export function computeAllScenarios(facts: Fact[], clientProfileId: string, now: Date = new Date()): Record<ScenarioKey, ComputedRecommendations> {
  const entries = SCENARIO_PRESETS.map((preset) => [preset.key, computeScenario(facts, clientProfileId, now, preset)] as const);
  return Object.fromEntries(entries) as Record<ScenarioKey, ComputedRecommendations>;
}
