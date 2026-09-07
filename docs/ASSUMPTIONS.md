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

## Regulatory

- No disclaimer/compliance copy, license fields, or regulatory feature
  flags (PRD §4) are implemented yet — Milestone 1 is domain/DB only, and
  §4 is a cross-cutting concern that touches the UI/API layers that don't
  exist yet. See docs/REGULATORY-TODO.md.
