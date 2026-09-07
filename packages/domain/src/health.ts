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
