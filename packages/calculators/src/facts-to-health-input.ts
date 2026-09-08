import { ALL_HEALTH_COVERAGE_MODULES } from "@insurance-advisor/domain";
import type { Fact } from "@insurance-advisor/shared";
import type { HealthAssessorInput, HealthModuleInput } from "./health-module-assessor.js";

/**
 * Real Facts → HealthAssessorInput adapter. A module never answered
 * simply isn't included in `modules` — `HealthModuleAssessor` already
 * treats an absent module as "unknown" (§15), so there's no need to
 * synthesize an explicit "unknown" entry here.
 */
export function factsToHealthInput(facts: Fact[]): HealthAssessorInput {
  const modules: HealthModuleInput[] = [];
  for (const module of ALL_HEALTH_COVERAGE_MODULES) {
    const value = facts.find((f) => f.key === `health.module.${module}`)?.value;
    if (value === "yes") modules.push({ module, existing: true });
    else if (value === "no") modules.push({ module, existing: false });
    else if (value === "unknown") modules.push({ module, existing: "unknown" });
  }
  return { modules };
}
