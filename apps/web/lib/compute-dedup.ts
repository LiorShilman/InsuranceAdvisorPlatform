import { Money } from "@insurance-advisor/shared";
import { STARTER_ENGINE_CONFIG } from "@insurance-advisor/config";
import { CoverageDeduplicationEngine, type DeduplicationResult } from "@insurance-advisor/calculators";
import type { Coverage } from "@insurance-advisor/domain";

/** The shape /api/coverages returns — see that route's serializeCoverage. */
export type ApiCoverage = {
  id: string;
  createdAt: string;
  updatedAt: string;
  clientProfileId: string;
  category: Coverage["category"];
  subtype: string;
  insuredPersonId: string;
  beneficiaryType?: Coverage["beneficiaryType"];
  amount?: number;
  monthlyBenefit?: number;
  startDate?: string;
  endDate?: string;
  waitingPeriodDays?: number;
  verified: boolean;
  source: string;
  exclusionsKnown: boolean;
  notes?: string;
};

const deduplicationEngine = new CoverageDeduplicationEngine();

/** Rehydrates the API's plain-number amounts back into real `Money` — same
 * pattern as every other Facts→domain adapter in this codebase. */
export function toDomainCoverage(c: ApiCoverage): Coverage {
  return {
    ...c,
    amount: c.amount !== undefined ? Money.fromNumber(c.amount) : undefined,
    monthlyBenefit: c.monthlyBenefit !== undefined ? Money.fromNumber(c.monthlyBenefit) : undefined,
  };
}

export function computeDeduplication(coverages: ApiCoverage[]): DeduplicationResult {
  return deduplicationEngine.detect(coverages.map(toDomainCoverage), STARTER_ENGINE_CONFIG);
}
