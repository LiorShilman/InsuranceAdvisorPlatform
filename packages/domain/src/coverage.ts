import { Money } from "@insurance-advisor/shared";
import type { BaseEntity } from "./base.js";

/** Existing insurance policy the client already holds — PRD §18. */
export type Coverage = BaseEntity & {
  clientProfileId: string;
  category: "life" | "disability" | "critical_illness" | "health" | "ltc" | "personal_accident";
  subtype: string;

  insuredPersonId: string;
  beneficiaryType?: "person" | "lender" | "estate" | "other";

  amount?: Money;
  monthlyBenefit?: Money;

  startDate?: string;
  endDate?: string;
  waitingPeriodDays?: number;

  verified: boolean;
  source: string;

  exclusionsKnown: boolean;
  notes?: string;
};

/**
 * PRD §18 Duplicate Detection — the *inputs* the (future) dedup scoring
 * function will weigh. Scoring logic itself is not implemented in
 * Milestone 1.
 */
export type DuplicateDetectionFactors = {
  sameInsuredWeight: number;
  sameRiskWeight: number;
  overlappingBenefitWeight: number;
  overlappingTermWeight: number;
};
