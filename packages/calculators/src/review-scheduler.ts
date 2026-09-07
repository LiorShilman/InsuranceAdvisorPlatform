import type { Recommendation } from "@insurance-advisor/domain";

/**
 * Review / Holding Period lifecycle — PRD §22. A recommendation isn't a
 * one-time answer; it needs a concrete date by which it should be looked
 * at again. This computes the EARLIEST of:
 * - one year out, if `annual_review` is among the recommendation's review
 *   triggers (every calculator in this codebase includes it), and
 * - the end of the recommendation's own horizon (e.g. §12.4's coverage
 *   horizon), if it's expressed in years and positive.
 *
 * Real calendar-based scheduling/notification (an actual job that fires on
 * this date) doesn't exist yet — no persistence or scheduler service is
 * wired up. This only computes what that date *would* be.
 */
export class ReviewScheduler {
  nextReviewDate(recommendation: Recommendation, now: Date = new Date()): string {
    const candidates: Date[] = [];

    if (recommendation.reviewTriggers.includes("annual_review")) {
      candidates.push(addYears(now, 1));
    }

    if (recommendation.horizon?.type === "years" && typeof recommendation.horizon.value === "number" && recommendation.horizon.value > 0) {
      candidates.push(addYears(now, recommendation.horizon.value));
    }

    if (candidates.length === 0) {
      candidates.push(addYears(now, 1));
    }

    const earliest = candidates.reduce((min, d) => (d < min ? d : min));
    return earliest.toISOString().slice(0, 10);
  }
}

function addYears(date: Date, years: number): Date {
  const d = new Date(date.getTime());
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d;
}
