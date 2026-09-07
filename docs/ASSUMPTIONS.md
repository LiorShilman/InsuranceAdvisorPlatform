# Assumptions

Maintained per PRD rule 19 (§46) and requested explicitly by §47 point 10
("list every assumption you had to make"). None of the numeric defaults
below have actuarial, legal, or regulatory review — they exist only so
Milestone 1's types/fixtures/config compile and later milestones have
something concrete to start tuning.

## Config defaults (`packages/config/src/starter-config.ts`)

- `financialAssumptions.realDiscountRate = 0.02`, `inflationRate = 0.025`,
  `salaryGrowthRate = 0.02` — placeholder macro assumptions. PRD §12.3
  explicitly requires these to be config, not hard-coded; these are just
  the seed values.
- `dependentAssumptions.targetAge = 21` — taken directly from the PRD's own
  §12.4 config example.
- `thresholds.materialGap = 50,000 ILS` — invented; the PRD says this
  threshold gates whether an uninsured gap is even worth surfacing (§9,
  §41) but never states a number.
- `thresholds.incomeChangeReviewPct = 20` — taken from the PRD's own
  `income_change_20pct` review-trigger name (§22).
- `priorityWeights.*` — all set to `1`. PRD §19.1 itself calls the weights
  "magic" ("weights are 'קסם'... נשמרים ב-DB/config") without proposing
  values; equal weighting is a neutral placeholder, not a designed scoring
  model.

## Domain modeling

- `Fact`/`DataProvenance` placed in `packages/shared` rather than
  `packages/domain` to avoid a circular package dependency — see
  docs/DECISIONS.md #2. The Facts Engine that actually populates
  `DataProvenance` on a `Fact` doesn't exist yet; the two types currently
  just coexist.
- `Answer.rawValue: unknown` / Prisma `Answer.rawValue: Json` — the PRD
  doesn't specify Answer's shape beyond naming it as an entity (§26.1);
  modeled as "whatever the Question's `answerType` implies", validated
  later by the questionnaire engine, not by the type system.
- `HealthDisclosure.sensitive` is typed as the literal `true` (PRD §7.3:
  "every medical question is marked sensitive=true") rather than a boolean,
  so it's a compile error to construct one without acknowledging that.
- Money is *not* implemented as literal integer agorot (a plain `bigint`),
  even though PRD §25 offers that as an alternative to a decimal library.
  Used `decimal.js` instead (per the PRD's own `Money = Decimal` TS
  snippet), normalized to 2 decimal places on every construction so it
  behaves like integer-agorot arithmetic without a bigint API.

## Test fixtures (`packages/test-fixtures`)

- The 5 fixtures are: Personas A-D from PRD §5, plus a 5th that reproduces
  the exact worked example in PRD §57 (used to cross-check calculator
  output in a later milestone). All names, ages, and amounts beyond what
  §5/§57 specify (e.g. Persona B's exact expense split) are invented for
  plausibility, not sourced from the PRD.
- "Now" for every fixture's `createdAt`/`updatedAt` is hard-coded to
  `2026-09-07` (today, per this session) rather than `new Date()`, so
  fixtures are deterministic across test runs.

## Life Insurance calculator (`packages/calculators/src/life-insurance-calculator.ts`)

- `ChildSupportNeed` (PRD §12.2) is not modeled as a separate line item —
  it's folded into `IncomeReplacementNeed` via `householdRequiredAnnualSpend`,
  which is assumed to already include child-related costs. Separating it
  would need child-specific consumption data the questionnaire doesn't
  collect yet.
- `SurvivorBenefitsPresentValue` defaults to zero without missing-data
  bookkeeping (unlike `existingLifeInsurance`) — treated as "no survivor
  pension benefit modeled" rather than "unknown", since nothing upstream
  produces this fact yet at all.
- Confidence is `"low"` if any of `householdRequiredAnnualSpend`,
  `survivorReliableAnnualIncome`, `existingLifeInsurance`, or
  `youngestDependentAge` (when there are dependents) is missing; `"medium"`
  for any other missing field; `"high"` otherwise. Range widening is ±25%
  (low) / ±10% (medium) / exact (high) — PRD §9 mandates *that* confidence
  affects the displayed range, not these specific percentages, which are
  invented.
- Review triggers (§22) are a fixed rule-of-thumb per input shape
  (`annual_review` + `income_change_20pct` always; `mortgage_repaid` if a
  mortgage exists; `child_independent` if there are dependents) — not
  computed from any config or scoring model.
- PV summation rounds each year's term to whole agorot via `Money` before
  summing, rather than summing at full decimal precision and rounding once.
  Both are defensible; this one keeps every intermediate value
  independently audit-exact, matching §25's "audit stores exact" intent.

## Long-Term Care calculator

- `careAssumptions.assumedMonthlyLTCCareCost = 18,000 ILS` — invented, not
  sourced from any real cost-of-care survey. Used whenever a household's
  own expected care cost is unknown (see docs/DECISIONS.md for why this
  one field defaults to a config assumption instead of zero).
- `LTC_DURATION_SCENARIOS_YEARS = [1, 2, 3, 5, 8]` — an arbitrary spread,
  not derived from actuarial LTC duration statistics.

## Coverage deduplication engine

- `duplicateDetection.weights` (sameInsured=30, sameRisk=30,
  overlappingBenefit=10, overlappingTerm=30) and `scoreThreshold=80` are
  invented and specifically calibrated (not just guessed) so that
  `sameInsured`, `sameRisk`, and `overlappingTerm` are jointly required —
  any two alone (60) fall short of the threshold. This was discovered
  during test-writing: an initial equal-ish weighting let same-person +
  same-category alone (without any actual time overlap) cross the
  threshold, which would have flagged completely normal sequential
  coverage (an old expired policy replaced by a new one) as a "duplicate".
  No real product/actuarial review of these numbers.

## Known dependency vulnerabilities (not remediated)

`npm audit` reports 7 advisories (moderate→critical) as of this milestone:
esbuild/vite/vitest chain (dev-only, requires visiting a malicious site while
`vitest`/its bundled dev server is running — not applicable to CI-style
`vitest run` usage here) and a long list of Next.js 14.2.x advisories that
are only fixed in Next 16 (a major version with its own migration cost).
Left unfixed for now because: this app runs locally only, is never
deployed or exposed to the internet, and `next@16` is a bigger jump than
this preview slice warrants. **Must be revisited before Milestone 6** (the
real UI) or before any deployment — re-run `npm audit` and either upgrade
or explicitly accept each remaining advisory at that point.

## Preview UI (`apps/web`)

- Built specifically because the user asked to see the system working, not
  because Milestone 6 started. No Tailwind, no routing beyond one page, no
  API — the page imports the calculator and fixtures directly as a client
  component. Explicitly out of scope: priority scoring/bands (Milestone 5,
  not built), so cards show category/need/gap/trace but no
  CRITICAL/HIGH/MEDIUM priority badge yet.

## Regulatory

- No disclaimer/compliance copy, license fields, or regulatory feature
  flags (PRD §4) are implemented yet — Milestone 1 is domain/DB only, and
  §4 is a cross-cutting concern that touches the UI/API layers that don't
  exist yet. See docs/REGULATORY-TODO.md.
