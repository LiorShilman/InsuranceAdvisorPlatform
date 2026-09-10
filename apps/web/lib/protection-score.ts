import type { ComputedRecommendations } from "./compute-recommendations";

/**
 * A single 0–100 headline number summarizing overall coverage across the
 * 4 gap-producing categories — per marks-and-anatomy.md's "hero figure"
 * pattern: "the single number a dashboard leads with... exactly one per
 * view." Simple, unweighted average of each category's own coverageRatio
 * (already used for the per-card gap bar and the report's coverage
 * overview) — an invented composite, not a formula the PRD specifies; see
 * docs/ASSUMPTIONS.md. Health is excluded (categorical assessment, no
 * coverageRatio), same scope as CoverageOverview.
 */
export function computeProtectionScore(computed: ComputedRecommendations): number {
  const ratios = [computed.life.coverageRatio, computed.disability.coverageRatio, computed.ci.coverageRatio, computed.ltc.coverageRatio].map((r) =>
    Math.min(1, Math.max(0, r)),
  );
  const average = ratios.reduce((sum, r) => sum + r, 0) / ratios.length;
  return Math.round(average * 100);
}

export type ProtectionScoreTier = { label: string; icon: string };

/** Thresholds are invented, same status as the averaging formula itself — see docs/ASSUMPTIONS.md. */
export function protectionScoreTier(score: number): ProtectionScoreTier {
  if (score >= 70) return { label: "כיסוי טוב", icon: "✓" };
  if (score >= 40) return { label: "כיסוי חלקי", icon: "!" };
  return { label: "כיסוי נמוך", icon: "✕" };
}
