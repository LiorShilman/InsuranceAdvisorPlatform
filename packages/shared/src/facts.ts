/**
 * Facts layer — PRD §8. Everything the questionnaire, document parsing, or an
 * integration produces is normalized into a Fact before any calculator sees it.
 *
 * Deliberately in `shared` rather than `domain`: the rules engine (PRD §11)
 * needs to reference facts by key without depending on the domain package,
 * and the domain package needs `Fact`/`DataProvenance` for
 * Recommendation/RecommendationAudit — putting it in `domain` would make
 * `rules` and `domain` depend on each other. See docs/DECISIONS.md.
 */
export type FactSource = "user" | "document" | "integration" | "derived";

export type Fact<T = unknown> = {
  key: string;
  value: T;
  source: FactSource;
  /** 0..1 */
  confidence: number;
  verified: boolean;
  effectiveDate?: string;
};

/**
 * Richer provenance record a Fact MAY carry once it came through document
 * upload / an official integration / an agent — PRD §54. Not required on
 * every Fact in Milestone 1 (the Facts Engine that populates this is a
 * later milestone) — see docs/ASSUMPTIONS.md.
 */
export type DataProvenanceSourceType =
  | "user"
  | "uploaded_policy"
  | "official_integration"
  | "agent"
  | "derived";

export type DataProvenanceVerificationStatus = "verified" | "user_confirmed" | "unverified";

export type DataProvenance = {
  sourceType: DataProvenanceSourceType;
  sourceId?: string;
  extractedAt?: string;
  confirmedByUser?: boolean;
  verificationStatus: DataProvenanceVerificationStatus;
};
