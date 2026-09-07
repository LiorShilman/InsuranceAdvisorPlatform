/**
 * Explainability primitives — PRD §24 ("no number without a clickable trail"),
 * §4.2 (RecommendationAudit), §21 (Recommendation.calculationTraceId), §53
 * (explainabilityComplete).
 *
 * A CalculationTrace is the full, ordered ledger of every line that went
 * into a numeric result — enough to reconstruct the §24 breakdown example
 * (income replacement + mortgage + education reserve - existing cover = gap)
 * without re-running any code.
 */

/** One line of a calculation breakdown, e.g. "+ 1,420,000 Income replacement". */
export type CalculationTraceLine = {
  /** Stable identifier, e.g. "income_replacement", "mortgage_offset". */
  key: string;
  /** Human-readable label shown in the UI, translated from a reason code where possible. */
  label: string;
  /** Signed amount in exact shekels (see Money.toExactString for the audited value). */
  amountExact: string;
  /** Facts this line was computed from (PRD §26.1 Fact / §4.2 factsUsed). */
  sourceFactKeys: string[];
  /** Assumption keys this line depended on (PRD §4.2 assumptions / §12.3 realDiscountRate etc). */
  assumptionKeys: string[];
  /** Free-text formula description, e.g. "sum(PV(t)) for t in 0..horizonYears". */
  formula?: string;
};

export type CalculationTrace = {
  id: string;
  /** e.g. "life_gap", "disability_monthly_gap" — matches the calculator that produced it. */
  calculatorKey: string;
  ruleEngineVersion?: string;
  configVersion: string;
  createdAt: string;
  lines: CalculationTraceLine[];
  /** Final result, exact — must equal the signed sum of `lines` amounts. */
  resultExact: string;
};

/**
 * An assumption the engine relied on because the user didn't supply a fact —
 * PRD §4.2 Assumption, §9 (LOW confidence widens the recommended range),
 * §12.3 financialAssumptions.
 */
export type Assumption = {
  key: string;
  description: string;
  value: string | number | boolean;
  /** Where the default came from, e.g. "config:financialAssumptions.realDiscountRate". */
  source: string;
};

/** Points a CalculationTrace/Recommendation line back at the Fact(s) it used — PRD §4.2 factsUsed. */
export type FactReference = {
  factKey: string;
  value: unknown;
  verified: boolean;
};
