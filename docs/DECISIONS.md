# Architecture Decisions

Maintained per PRD rule 18 (§46). One entry per decision, newest first.

## 2026-09-08 — Review scheduler + Recommendation object wiring — Milestone 5 done

1. **`ReviewScheduler` computes one concrete date, not a calendar/notification
   system.** PRD §22's "lifecycle" is really two things: (a) *what event*
   should trigger a fresh look (already covered by `reviewTriggers`, e.g.
   `mortgage_repaid`, `income_change_20pct`) and (b) *by when*, at the
   latest, should it be looked at regardless. This only computes (b) — the
   earlier of "one year from now" (if `annual_review` is a trigger, which
   every calculator always includes) and "the recommendation's own horizon
   end". No persistence, no actual scheduled job that fires on that date —
   there's nowhere for it to write to yet.
2. **`RecommendationBuilder` output is now wired into all four money-based
   preview cards** (status badge, rationale sentence, next-review-date
   badge) — the `Recommendation` entity (§21) is no longer just a tested
   type, it's visibly driving the UI.
3. **`reviewTriggers` changed from `string[]` to the real domain
   `ReviewTrigger[]`** on all four calculators' result types (was a loose
   string array that happened to contain valid enum values) — caught while
   wiring `RecommendationBuilder`, which needed the real type rather than
   an `as never` cast to satisfy `Recommendation.reviewTriggers`.
4. This completes Milestone 5 (PRD §45: gap engine, priority, budget,
   lifecycle) on top of Milestones 1-4. Next per the PRD's own sequence is
   Milestone 2, the Adaptive Questionnaire (§7, §49) — the piece that lets
   a real user's answers replace the hardcoded test fixtures every
   calculator has been driven by so far.

## 2026-09-08 — Priority Engine + Budget/Affordability layer (PRD §19-20)

1. **`priorityWeights` changed from a loose `Record<string, number>` to a
   named-field type.** A typo in a Record key would have silently produced
   a zero-weight term with no compile error; the PRD explicitly warns
   against "magic" unreviewed weights, and a typo-safe shape is a small,
   free way to not compound that risk further.
2. **`categoryRiskProfile` (severity/exposure/irrecoverability/urgency per
   category) is a new config table**, following the exact same pattern as
   `healthModuleDefaultNeedWhenMissing` and `duplicateDetection.weights` —
   PRD §19.1 names these as formula inputs but gives no way to derive them
   from calculator output, so they're config placeholders, not derived.
   `severity` and `exposure` currently hold the same number per category
   (no real differentiation yet) — flagged in docs/ASSUMPTIONS.md.
3. **`gapRatio` and `coverageAdequacy` ARE derived honestly** from each
   calculator's own need/existing amounts (via
   `PriorityEngine.gapRatioAndCoverageAdequacy`) — these two inputs are not
   invented, unlike the four category-baseline factors above.
4. **`affordabilityPenalty` and `duplicateFlagged` are real signals**,
   wired from the Budget/Affordability layer and the deduplication engine
   (§18) respectively — not placeholders.
5. **The Budget/Affordability engine's premium-to-coverage ratio is
   explicitly NOT real pricing.** PRD §3.2 lists a Pricing engine as
   Phase 2, and §50/§58 explicitly forbid letting price silently redefine
   need. This ratio exists only so §20's mechanic (need vs
   budget-constrained option vs remaining gap, need never shrunk) is
   demonstrable; calibrated specifically to reproduce the PRD's own §20
   worked example number-for-number (budget 300/mo → 1,200,000 coverage)
   as a golden test. Logged in docs/REGULATORY-TODO.md as something that
   must be replaced by real Product Matching pricing before production.
6. **Scoped to lump-sum categories only for this milestone** — the budget
   layer isn't run against disability/LTC's monthly-benefit shapes, and
   isn't wired into the `apps/web` preview at all yet (there's no
   questionnaire to actually collect a household's stated budget from).
   Implemented and tested, not yet user-facing.
7. **LTC's priority scoring uses a simplified has-gap/no-gap signal**
   instead of a proportional gapRatio, because `capitalNeed` (LTC's
   result) is already net of benefits/self-funding — there's no separate
   raw need/existing pair to compare the way the other three
   money-calculators expose. Noted directly in the preview page's code
   comment, not hidden.

## 2026-09-07 — Coverage deduplication engine (PRD §18)

1. **Same-category "sameRisk" match is overridden to `false` when exactly
   one side of the pair has `beneficiaryType: "lender"`** — a personal
   life policy and a mortgage-lender life policy on the same person are
   not duplicates, they serve different purposes (same principle as §12.5,
   applied here so the dedup engine doesn't contradict the life
   calculator's own treatment of mortgage cover).
2. **Weights are calibrated so `sameInsured`, `sameRisk`, and
   `overlappingTerm` are jointly load-bearing** (no two of those three
   alone reach `scoreThreshold`), with `overlappingBenefit` only a minor
   addition on top. PRD §18 gives four factor names and an additive-sum
   formula but no numbers; a naive equal-ish weighting (tried first) let
   "same person + same category" alone cross the threshold regardless of
   whether the two policies' time periods ever overlapped — which would
   flag entirely normal sequential/expired-then-replaced coverage as a
   "duplicate". Recalibrated once this was caught in testing (see
   docs/ASSUMPTIONS.md); still an invented, unreviewed calibration.
3. **A missing `startDate` on either policy makes the pair's time ranges
   "unresolvably possibly-overlapping"** rather than assumed non-overlapping
   — same unknown-stays-unknown discipline as everywhere else (rule 13). A
   missing `endDate` is instead treated as open-ended (extends to
   infinity), which is a real, common, non-ambiguous state ("still
   active"), not an unknown one — so it does NOT trigger the same
   can't-rule-it-out fallback.
4. **`packages/test-fixtures`'s Persona A now has a second, deliberately
   overlapping life policy** (`cov-a-2`) specifically so this engine has a
   real positive case to flag in both a test and the `apps/web` preview —
   previously every fixture's coverages were either singletons or
   intentionally non-duplicative (the mortgage-vs-personal-life pairs).
   Verified this doesn't change any existing calculator test's assertions
   (none pin an exact `existingLifeInsurance` number for Persona A).
5. **No `CalculationTrace`, same reasoning as the health module assessor**
   (§15 entry above) — this is a pairwise categorical flag list, not a
   Money gap.

## 2026-09-07 — Long-Term Care calculator (PRD §16)

1. **`expectedMonthlyCareCost` falls back to a new `config.careAssumptions.
   assumedMonthlyLTCCareCost` when the household-specific figure is
   unknown — not to zero**, unlike every other unknown-money field in this
   codebase. PRD §16 itself frames "expected monthly care cost" as a
   system-level assumption to configure, not a personal fact that's simply
   missing; falling back to 0 here would badly understate LTC need for
   every household without personalized data, which defeats the point of
   having the assumption. Still flagged in `missingFacts`/`assumptions`,
   never silent. `monthlySelfFundingCapacity` keeps the normal
   fall-back-to-zero behavior — no equivalent "it's really a config
   assumption" framing for that one in the PRD.
2. **`calculateScenarios()` mirrors the critical illness calculator's
   pattern** for expected-duration scenario ranges (§16 explicitly calls
   duration "a scenario parameter with a range", same framing as §14 for
   critical illness recovery duration) — reused the same shape rather than
   inventing a different one.
3. **`packages/config` now depends on `packages/domain`** (added when
   `healthModuleDefaultNeedWhenMissing` was introduced) — `careAssumptions`
   piggybacks on that same dependency edge, no new one needed.

## 2026-09-07 — Health module assessment (PRD §15)

1. **`HealthCoverageModule` and `HealthModuleAssessment` live in
   `packages/domain`**, not `packages/calculators`, specifically so
   `packages/config` can key `healthModuleDefaultNeedWhenMissing` off the
   same type without config depending on calculators. Checked for cycles:
   domain doesn't depend on config, so config → domain stays acyclic.
2. **`HealthModuleAssessor` does not implement `NeedsCalculator<T, Money>`
   and produces no `CalculationTrace`.** PRD §15's model is categorical per
   module (existing/unknown, duplicate risk, need level), not a lump sum or
   monthly gap — there's no meaningful "amount" to trace. Every module's
   `reasonCodes` + `existing`/`duplicateRisk` fields serve the same
   explainability goal rule 8 is after, just shaped differently. This is a
   deliberate exception, not an oversight.
3. **`healthModuleDefaultNeedWhenMissing` (the need level assigned when a
   module is known-absent) is an invented config default**, not a real
   product/underwriting recommendation — PRD §15 names the modules but
   gives no scoring formula at all. Kept in config (not hard-coded in the
   assessor) per rules 10-11, but still flagged in docs/ASSUMPTIONS.md as
   unreviewed.
4. **A module never mentioned in the input is treated identically to an
   explicit `existing: "unknown"` answer** — both produce `need: "medium"`
   and `HEALTH_MODULE_UNKNOWN`. "Never asked" and "asked, don't know" are
   the same epistemic state from the calculator's point of view.

## 2026-09-07 — Disability/Income Protection calculator (PRD §13)

1. **`existingNetExpectedDisabilityIncome` is a single aggregate figure**,
   not a structured breakdown of pension disability + private income
   protection + employer coverage + waiting period + offsets (all listed
   individually in §13.2). Modeling each source separately (with its own
   waiting period and offset rules) is realistically Product-Matching-
   adjacent work; folding them into one net monthly number keeps the
   calculator itself simple and still produces a real, auditable gap.
2. **The demo fixture adapter (`fromHouseholdFixtureForDisability`) always
   produces `existingNetExpectedDisabilityIncome: undefined`** because none
   of the 5 fixtures carry a monthly disability benefit amount (only
   boolean `hasPensionDisabilityCoverage`/`hasEmployerCoverage` flags on
   `Employment`). This is deliberate — it demonstrates the "unknown stays
   unknown, confidence drops, nothing is silently zeroed" behavior for
   real, not a bug to fix.
3. To avoid double-counting against `debtMonthlyPayments` and
   `dependentsMonthlyNeeds` (which the fixtures don't track as separate
   monthly figures), the demo adapter folds every essential-flagged expense
   — including `debt_service` and `childcare` categories — into a single
   `essentialMonthlyExpenses` figure and leaves the other two fields at an
   explicit zero, not re-derived from the same expense rows.

## 2026-09-07 — Life Insurance calculator slice (PRD §12, §48) + preview UI

1. **`LifeCalculatorInput` is a typed, pre-normalized shape, not raw `Fact[]`.**
   The full pipeline (§10) is Questionnaire → Facts → Rules → Calculators;
   the Facts→typed-input mapping is Facts Engine/Questionnaire work that
   doesn't exist yet (Milestone 2). The calculator takes the normalized
   shape directly so it can be built and tested (§48) without waiting on
   that milestone. `packages/calculators/src/demo/household-fixture-adapter.ts`
   (`fromHouseholdFixture`) bridges `HouseholdFixture` → `LifeCalculatorInput`
   for both the test suite and the `apps/web` preview page — it is
   explicitly labeled DEMO/TEST ONLY in its own file header, not the real
   pipeline. Its existence is also why `packages/calculators` now depends
   on `packages/test-fixtures` for its `HouseholdFixture` type, which is an
   unusual direction for a "calculator" package to depend in — acceptable
   here only because the whole adapter is demo-scoped and isolated under
   `src/demo/`.

2. **Every optional money field on `LifeCalculatorInput` distinguishes
   "explicitly zero" from "unknown".** `undefined` always means unknown and
   goes through `resolveMoney()`, which defaults to `Money.zero()` but
   *always* also records a `missingFacts` entry and an `Assumption` —
   satisfying PRD rule 13 ("never silently convert unknown to 0") while
   still letting the calculation proceed. Fields that plausibly have no
   "unknown" state at this layer (a goal simply not being present, e.g.
   `educationNeed`, `immediateExpenses`) default to zero without that
   bookkeeping — see docs/ASSUMPTIONS.md.

3. **The calculator does not validate its own input** (no negative-money
   guard, no age-range check). PRD §33 validation is explicitly an
   Answer/Questionnaire-layer concern upstream of Facts; calculators trust
   already-validated input, consistent with the §10 pipeline order.

4. **Trace line-sum invariant is preserved even when the headline gap is
   floored at zero** (PRD §43: never a negative gap) by adding a synthetic
   `floor_at_zero` trace line when the raw signed sum goes negative, rather
   than silently discarding the difference.

5. **A minimal preview UI was added to `apps/web`** (Next.js, no Tailwind
   yet) specifically because the user asked to see something working,
   overriding §47's "don't build UI yet" for this one throwaway-adjacent
   purpose. It is explicitly labeled as a preview in its own page copy —
   it is not the real Milestone 6 dashboard/report UI (§37-39), which still
   needs the Priority Engine, Questionnaire, and API layers this preview
   skips by calling the calculator directly from a client component.

## 2026-09-07 — Milestone 1 scaffold

1. **npm workspaces**, not pnpm/turborepo. The sibling `ls-financial-advisor`
   project already uses npm; no reason to introduce a second package
   manager just for this project. Revisit if build caching/parallelism
   across packages becomes a real pain point.

2. **Fact / DataProvenance live in `packages/shared`, not `packages/domain`.**
   PRD §26.1 lists `Fact` as a domain entity, but the rules engine
   (`packages/rules`) needs to evaluate against `Fact[]` without depending
   on `packages/domain`, and `packages/domain` needs `RuleTrace` (from
   `packages/rules`) inside `RecommendationAudit`. Putting `Fact` in
   `domain` would make `rules` and `domain` depend on each other.
   Resulting acyclic graph: `shared` → `rules` → `domain` → `calculators` /
   `config` / `questionnaire` / `test-fixtures`.

3. **All monetary domain fields use `Money`, even where the PRD's own
   pseudocode used a bare `number`** (e.g. §21 `Recommendation.needAmount:
   number`, contradicted by §12.6 `LifeRecommendation.grossNeed: Money` for
   the same kind of value). Mandatory rule 6 ("all money uses Decimal")
   resolves the contradiction in favor of `Money` everywhere.

4. **`Recommendation` (§21) is the canonical type; `RecommendationAudit.output`
   (§4.2) references it rather than redefining it.** The PRD defines an
   `output` field inline without a full second shape — treated as the same
   `Recommendation`.

5. **Rule-engine and calculator packages contain interfaces and types only —
   no evaluation/calculation logic.** The PRD's own first Claude Code
   prompt (§47) asks only for interfaces at this stage; rule evaluation and
   the life/disability/CI/health/LTC math are Milestone 3 (§45), matching
   the PRD's separate "Second Prompt" (§48) and "Third Prompt" (§49).

6. **`apps/web` and `apps/api` are placeholders only** (a README each, no
   package.json, not part of the npm workspace yet). PRD §47: "Do not start
   building UI yet." The NestJS-vs-Fastify choice (§27) and Next.js
   scaffold are both deferred to Milestone 2 / Milestone 6.

7. **PostgreSQL runs via `docker-compose.yml`** (port 5433, to avoid clashing
   with any locally-installed Postgres) since no local `psql`/Postgres
   service is installed on this machine. `DATABASE_URL` lives in `.env`
   (gitignored), `.env.example` documents the shape.

8. **Prisma schema (`prisma/schema.prisma`) adds a few tables beyond §26.2's
   literal SQL list**: `households`, `mortgages`, `goals`, `identifiers`,
   `documents`. §26.1's domain entity list and other PRD sections (§6, §12.5,
   §16, §26.2's own sensitive-table note) reference these directly even
   though the §26.2 code block omits them.

9. **`identifiers` and `documents` tables are placeholders with no
   corresponding domain type or write path yet.** Both are Phase-2 concerns
   per §3.2 (document/OCR ingestion) and general PII handling that hasn't
   been designed. Created now only because §26.2 explicitly names them as
   sensitive tables to plan around.
