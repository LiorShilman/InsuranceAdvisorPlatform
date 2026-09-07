import { ALL_HEALTH_COVERAGE_MODULES, type HealthCoverageModule, type HealthModuleAssessment } from "@insurance-advisor/domain";
import type { EngineConfig } from "@insurance-advisor/config";

/**
 * Private Health module assessment — PRD §15. Deliberately NOT a
 * `NeedsCalculator<TInput, Money>` like the other three calculators in
 * this milestone: health need here is categorical per module ("do you
 * have this, is it a duplicate, how important is it"), not a lump sum or
 * monthly gap. Forcing it through the Money-based `CalculationTrace`
 * (PRD rule 8) would be a worse fit than what this file does instead:
 * every module's `reasonCodes` + `existing`/`duplicateRisk` fields already
 * make the reasoning fully inspectable, which is the same explainability
 * goal rule 8 is after. See docs/DECISIONS.md.
 */
export type HealthModuleInput = {
  module: HealthCoverageModule;
  existing: boolean | "unknown";
  /** Set when a different existing policy is suspected to cover the same risk — PRD §15/§18. */
  overlapsWithOtherPolicy?: boolean;
};

export type HealthAssessorInput = {
  /** Modules not present here are treated as "never asked" == unknown, same as an explicit "unknown" answer. */
  modules: HealthModuleInput[];
};

export type HealthAssessmentResult = {
  /** Always one entry per module in ALL_HEALTH_COVERAGE_MODULES, in that order. */
  moduleAssessments: HealthModuleAssessment[];
  confidence: "high" | "medium" | "low";
};

export class HealthModuleAssessor {
  readonly key = "health_module_assessment";

  assess(input: HealthAssessorInput, config: EngineConfig): HealthAssessmentResult {
    const byModule = new Map(input.modules.map((m) => [m.module, m]));

    const moduleAssessments: HealthModuleAssessment[] = ALL_HEALTH_COVERAGE_MODULES.map((module) => {
      const entry = byModule.get(module);
      const existing: boolean | "unknown" = entry?.existing ?? "unknown";
      const overlapsWithOtherPolicy = entry?.overlapsWithOtherPolicy ?? false;

      const reasonCodes: string[] = [];
      let need: HealthModuleAssessment["need"];

      if (existing === "unknown") {
        need = "medium";
        reasonCodes.push("HEALTH_MODULE_UNKNOWN");
      } else if (existing) {
        need = "not_applicable";
      } else {
        need = config.healthModuleDefaultNeedWhenMissing[module];
      }

      if (overlapsWithOtherPolicy) {
        reasonCodes.push("HEALTH_DUPLICATE_POSSIBLE");
      }

      return { module, existing, need, duplicateRisk: overlapsWithOtherPolicy, reasonCodes };
    });

    const unknownCount = moduleAssessments.filter((a) => a.existing === "unknown").length;
    const confidence: "high" | "medium" | "low" =
      unknownCount === 0 ? "high" : unknownCount === ALL_HEALTH_COVERAGE_MODULES.length ? "low" : "medium";

    return { moduleAssessments, confidence };
  }
}
