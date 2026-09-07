import type { BaseEntity } from "./base.js";

/**
 * PRD §7.3 ("רפואי" category — sensitive=true) and §26.2 (health_disclosures
 * is listed explicitly as a sensitive table needing encryption/masking).
 */
export type HealthDisclosure = BaseEntity & {
  personId: string;
  smoker?: boolean;
  hasChronicCondition?: boolean;
  chronicConditionSeverity?: "mild" | "significant" | "unknown";
  hasOngoingTreatment?: boolean;
  hadRecentMedicalEvent?: boolean;
  currentOccupationRisk?: "low" | "medium" | "high" | "unknown";
  currentHobbyRisk?: "low" | "medium" | "high" | "unknown";
  /** Always true — PRD §7.3: "כל שאלה רפואית מסומנת sensitive=true". Enforced at the type level. */
  sensitive: true;
};

/**
 * Private health insurance is service/module-based, not a single amount —
 * PRD §15. This is the exact module list from the PRD.
 */
export const ALL_HEALTH_COVERAGE_MODULES = [
  "surgeries_israel",
  "surgeries_abroad",
  "transplants",
  "special_treatments_abroad",
  "medications_outside_basket",
  "ambulatory",
  "personalized_medicine",
] as const;

export type HealthCoverageModule = (typeof ALL_HEALTH_COVERAGE_MODULES)[number];

export type HealthModuleAssessment = {
  module: HealthCoverageModule;
  existing: boolean | "unknown";
  need: "high" | "medium" | "low" | "not_applicable";
  duplicateRisk: boolean;
  reasonCodes: string[];
};
