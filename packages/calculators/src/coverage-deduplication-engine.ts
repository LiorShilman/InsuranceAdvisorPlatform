import type { Coverage, DuplicateDetectionFactors } from "@insurance-advisor/domain";
import type { EngineConfig } from "@insurance-advisor/config";

/**
 * Existing-coverage overlap/duplicate detection — PRD §18. Like the health
 * module assessor, this is categorical/pairwise, not a Money gap — no
 * `NeedsCalculator`/`CalculationTrace` fit here either (see
 * docs/DECISIONS.md for the same reasoning applied to §15).
 */
export type CoverageDuplicateFlag = {
  coverageIdA: string;
  coverageIdB: string;
  duplicateScore: number;
  /** Which of the four PRD §18 factors actually fired for this pair (not the config weights). */
  matchedFactors: { sameInsured: boolean; sameRisk: boolean; overlappingBenefit: boolean; overlappingTerm: boolean };
  /** PRD §18's own output copy. */
  message: string;
};

export type DeduplicationResult = {
  flags: CoverageDuplicateFlag[];
};

function datesOverlap(aStart?: string, aEnd?: string, bStart?: string, bEnd?: string): boolean {
  // Missing dates on either side means we can't rule out an overlap — PRD rule 13:
  // unknown never silently becomes "no overlap".
  if (!aStart || !bStart) {
    return true;
  }
  const aStartTime = new Date(aStart).getTime();
  const bStartTime = new Date(bStart).getTime();
  const aEndTime = aEnd ? new Date(aEnd).getTime() : Number.POSITIVE_INFINITY;
  const bEndTime = bEnd ? new Date(bEnd).getTime() : Number.POSITIVE_INFINITY;
  return aStartTime <= bEndTime && bStartTime <= aEndTime;
}

/**
 * Same category is treated as "same risk" UNLESS exactly one side is a
 * mortgage-lender-beneficiary policy — a personal life policy and a
 * mortgage life policy on the same person are not duplicates, they serve
 * different purposes (PRD §12.5's distinction, applied here too).
 */
function sameRisk(a: Coverage, b: Coverage): boolean {
  if (a.category !== b.category) {
    return false;
  }
  const exactlyOneIsLenderBeneficiary = (a.beneficiaryType === "lender") !== (b.beneficiaryType === "lender");
  return !exactlyOneIsLenderBeneficiary;
}

function overlappingBenefit(a: Coverage, b: Coverage): boolean {
  const bothLumpSum = a.amount !== undefined && b.amount !== undefined;
  const bothMonthly = a.monthlyBenefit !== undefined && b.monthlyBenefit !== undefined;
  return bothLumpSum || bothMonthly;
}

export class CoverageDeduplicationEngine {
  readonly key = "coverage_deduplication";

  detect(coverages: Coverage[], config: EngineConfig): DeduplicationResult {
    const flags: CoverageDuplicateFlag[] = [];
    const weights: DuplicateDetectionFactors = config.duplicateDetection.weights;

    for (let i = 0; i < coverages.length; i++) {
      for (let j = i + 1; j < coverages.length; j++) {
        const a = coverages[i];
        const b = coverages[j];
        if (!a || !b) {
          continue;
        }

        const matchedFactors = {
          sameInsured: a.insuredPersonId === b.insuredPersonId,
          sameRisk: sameRisk(a, b),
          overlappingBenefit: overlappingBenefit(a, b),
          overlappingTerm: datesOverlap(a.startDate, a.endDate, b.startDate, b.endDate),
        };

        const duplicateScore =
          (matchedFactors.sameInsured ? weights.sameInsuredWeight : 0) +
          (matchedFactors.sameRisk ? weights.sameRiskWeight : 0) +
          (matchedFactors.overlappingBenefit ? weights.overlappingBenefitWeight : 0) +
          (matchedFactors.overlappingTerm ? weights.overlappingTermWeight : 0);

        if (duplicateScore >= config.duplicateDetection.scoreThreshold) {
          flags.push({
            coverageIdA: a.id,
            coverageIdB: b.id,
            duplicateScore,
            matchedFactors,
            message: "התגלתה חפיפה אפשרית. נדרשת בדיקת תנאי הפוליסאות לפני שינוי.",
          });
        }
      }
    }

    return { flags };
  }
}
