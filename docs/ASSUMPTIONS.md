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

## Priority Engine

- `priorityWeights` (severity=20, probability=15, dependency=15, gap=25,
  irreplaceability=15, urgency=10, existingCoverage=30) — invented,
  calibrated only so the six positive terms sum to exactly 100 at their
  maximum (all factors at 1.0). No real weighting study behind these
  ratios (e.g. why gap=25 rather than severity=25).
- `categoryRiskProfile` — invented per-category 0..1 placeholders for
  severity/exposure/irrecoverability/urgency. `severity` and `exposure`
  are currently identical for every category (no real differentiation
  between "how bad if it happens" and "how likely it happens" yet).
- `priorityBands` cutoffs (80/60/40/20) — taken directly from the PRD's
  own §19.2 example numbers, not independently derived.
- `dependencyWeight`'s "no dependents" multiplier is `0.3`, not `0` —
  invented; a household with no current dependents still has *some*
  protection value (self/estate/debt), so zero felt wrong, but 0.3 itself
  is not derived from anything.

## Budget/Affordability engine

- `affordability.assumedAnnualPremiumRatePer1000Coverage = 3` — NOT a real
  insurance premium rate. Chosen specifically to reproduce the PRD's own
  §20 example exactly (a monthly budget of 300 ILS buys exactly
  1,200,000 ILS of coverage) as a golden test, not because it reflects
  actual term-life pricing in any market. Must be replaced by real
  Product Matching/insurer pricing before this layer is ever shown to a
  real user — see docs/REGULATORY-TODO.md.
- `affordability.maxAffordabilityPenaltyPoints = 20` — invented, chosen to
  be meaningfully smaller than a full category's positive-factor range
  (100) so an unaffordable need still shows as elevated priority, not
  suppressed to zero (PRD §43 safety test: "suppresses uninsured gap
  because budget is too low" must fail the build).

## Adaptive Questionnaire (all five calculators, one bank)

- `decisionImpact` per question (0.1 to 0.95) — invented, hand-ranked by
  "how much does this change a recommendation", not derived from any
  sensitivity analysis. `household_marital_status` was raised from an
  initial 0.2 to 0.95 (now the highest in the bank, asked first) after
  direct user feedback that framing questions like this belong at the
  start, not scored as an afterthought.
- `userBurdenPenalty` per `answerType` (boolean 0.05 → multi_select 0.2) —
  invented ordering (fewer taps/thought = lower burden), not measured.
- `income.survivor.reliableMonthly` and `expenses.household.monthly` each
  answer for two different PRD concepts across categories (life vs.
  disability/CI) rather than being asked twice — see docs/DECISIONS.md.
  This means disability/CI's "essential expenses" is really "total
  household spend" in this flow, which overstates rather than understates
  those two calculators' need.
- No question collects LTC's `expectedMonthlyCareCost` — every live LTC
  result goes through `config.careAssumptions.assumedMonthlyLTCCareCost`
  (already documented as an invented placeholder), same as the
  fixture-driven page.
- **Updated 2026-09-12** (see docs/DECISIONS.md): the live `/questionnaire`
  flow no longer fixes CI's recovery duration / LTC's expected duration —
  `ci_expected_recovery_months`/`ltc_expected_duration_years` now let a
  user override either, defaulting to the same 6 months / 3 years as
  before when left blank. Still no UI lets a live user compare *several*
  durations side by side the way the fixture page's expandable tables do
  — this is a single overridable number per calculator, not the full
  scenario-comparison experience.
- Each `factsTo*Input` adapter only recognizes its own exact fact keys —
  none of them are a general-purpose Facts interpreter that would
  tolerate a differently-named fact meaning the same thing.

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

## Protection score (`apps/web/lib/protection-score.ts`)

- The single 0–100 "ציון הגנה כולל" hero number is an unweighted average
  of the 4 gap-producing categories' `coverageRatio` — not a PRD-specified
  formula. No product/actuarial input decided whether life should weigh
  more than LTC, or whether a household with dependents should weigh
  disability higher, etc. — this is the simplest defensible composite,
  nothing more.
- The 3 tier thresholds (≥70 "כיסוי טוב", 40–69 "כיסוי חלקי", <40 "כיסוי
  נמוך") are equally invented round numbers, same status as every other
  threshold in this file.

## Scenario Simulator (`apps/web/lib/scenario-simulator.ts`, PRD §23)

- PRD §23 lists 9 adjustable knobs and a fully-interactive slider UI; this
  implements 2 of the 9 (lifestyle percentage, real discount rate) as 4
  fixed presets rather than live sliders over all 9 — see the file's own
  doc comment and docs/DECISIONS.md for why.
- The 4 presets' actual numbers are entirely invented, unreviewed
  placeholders, same status as every other constant in this file:
  - Conservative: 115% lifestyle, discount rate −0.75pp.
  - Balanced: 105% lifestyle, discount rate −0.25pp.
  - Lean: 90% lifestyle, discount rate +0.75pp.
  - (Current: 100% lifestyle, no discount-rate change — this one isn't
    invented, it's just the user's real unmodified answers.)
  No product/actuarial input decided what "conservative" or "lean"
  concretely means in percentage terms — these are plausible-sounding
  round numbers chosen to make the 4 scenarios visibly distinct, nothing
  more.

## Authentication (`apps/web/lib/auth.ts`)

- Session lifetime: 30 days, fixed, not configurable, not renewed on
  activity — an invented round number, not a security-reviewed policy.
- bcrypt cost factor 10 (the `bcryptjs` default-adjacent choice) — not
  benchmarked against this app's actual expected load.
- **Updated 2026-09-11** (see docs/DECISIONS.md's auth-hardening entry):
  lockout (5 failed attempts / 15 minutes), per-IP rate limiting, and a
  letter+digit+blocklist password check are now real. Still deliberately
  not implemented — needs a mail-sending service, explicitly deferred by
  the user rather than by default: no password-reset flow, no email
  verification. Also still not implemented: a real breach-list check
  (e.g. HIBP) beyond the small hand-picked common-password blocklist in
  `lib/password-policy.ts`. See docs/REGULATORY-TODO.md.
- The in-memory rate limiter (`lib/rate-limit.ts`) assumes exactly one
  running instance (`ecosystem.config.cjs`'s `instances: 1`) — it would
  under-count attempts across multiple instances/processes. Not an issue
  today; would need a shared store (Redis, or a DB-backed counter like the
  per-account lockout already is) if this app ever scales to more than one
  process.

## Google Sign-In (`apps/web/lib/google-auth.ts`, `app/api/auth/google/route.ts`)

- Reuses the OAuth Client ID already registered for the sibling
  `ls-financial-advisor` project, at the user's explicit choice — this
  app has no OAuth consent screen/branding of its own configured under
  that Google Cloud project; whatever app name/logo that consent screen
  shows during sign-in is whatever was set up for the other project.
- A Google account's email is trusted as already-verified
  (`email_verified` on the ID token) and used to link/create the local
  `User` row directly — no separate confirmation step. Standard practice
  for this flow, but worth naming as a trust assumption.
- No account-linking UI for the reverse direction (an existing Google-only
  account later wanting to also set a local password) — not built, not
  requested.

## LLM explanation layer (`apps/web/lib/llm-explain.ts`, PRD §29)

- Model: `claude-sonnet-5`, chosen over the OpenAI integration already
  configured in `ls-financial-advisor`, at the user's request to pick
  "whichever fits our system better" — this project's own tooling is
  Claude-based throughout. Not benchmarked against Haiku for this
  specific task; Sonnet was chosen for output-quality headroom on Hebrew
  prose, not because Haiku was tested and found lacking.
- Only "explain deterministic result" (§29's own phrase) is implemented.
  §29 also allows paraphrasing a question, free-text fact extraction
  (§30), and report summarization — none of those are built this pass.
- Sends a narrower payload than §29's literal tool contract — see
  `lib/llm-explain.ts`'s header comment and docs/DECISIONS.md. Never a raw
  `Fact` row or anything from `HealthDisclosure`; only the already-computed
  Recommendation/CalculationTrace/assumptions/missingFacts. Means the
  explanation can't reference a fact that didn't make it into the trace,
  a real (if narrow) accuracy tradeoff made for the sake of not sending
  sensitive rows to a third-party API.
- No caching — every button click is a fresh API call/cost. Fine at
  today's scale; worth revisiting (e.g. cache by
  clientProfileId+category+factsHash) if usage grows.
- No token/cost budget or per-user rate limit on `/api/explain` beyond the
  same per-IP limiter every auth route gets — a signed-in user could click
  the button many times in a row and generate many billed API calls.

## Questionnaire widening (2026-09-11)

- Exactly one new question (`ltc_expected_monthly_care_cost`) — see
  docs/DECISIONS.md for why the other apparent gap
  (`Employment.hasPensionDisabilityCoverage`/`hasEmployerCoverage`,
  Prisma fields that exist in the schema but feed no `Fact`/calculator)
  was deliberately *not* turned into questions this pass.

## Questionnaire widening (2026-09-12)

- Two new questions closing the gap named above: `ci_expected_recovery_months`
  and `ltc_expected_duration_years` — see docs/DECISIONS.md. Both default
  to the same 6-month/3-year figures the live flow already hardcoded
  before this change when left blank, so this is not a new invented
  number, just the existing one made overridable and documented at its
  actual source (`DEFAULT_RECOVERY_DURATION_MONTHS` in
  `facts-to-critical-illness-input.ts`, `DEFAULT_LTC_EXPECTED_DURATION_YEARS`
  in `facts-to-ltc-input.ts`) instead of a bare literal at the
  `compute-recommendations.ts` call site.
- `Employment.hasPensionDisabilityCoverage`/`hasEmployerCoverage` remain
  unwired — re-checked this pass; the existing
  `coverage_disability_existing_monthly` question ("כולל ביטוח דרך הפנסיה,
  ביטוח פרטי, וכיסוי מעסיק יחד") already collects the substance of what
  those two booleans would add (a combined net monthly disability-income
  figure), so wiring them up now would duplicate rather than improve
  accuracy. Nothing in `apps/web` creates or reads an `Employment` row at
  all — genuinely dead schema, not just an unconsumed fact.

## Regulatory

- No disclaimer/compliance copy, license fields, or regulatory feature
  flags (PRD §4) are implemented yet — Milestone 1 is domain/DB only, and
  §4 is a cross-cutting concern that touches the UI/API layers that don't
  exist yet. See docs/REGULATORY-TODO.md.
