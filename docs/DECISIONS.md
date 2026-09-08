# Architecture Decisions

Maintained per PRD rule 18 (§46). One entry per decision, newest first.

## 2026-09-08 — Dark-mode CSS audit: 2 hardcoded colors, 1 real contrast failure

Small follow-up to the visual redesign pass, per the user's own request
to keep improving polish without a big new architectural decision. Audited
`globals.css` for every hex color living outside the `:root`/`data-theme`
token blocks (the `@media print` rules are correctly exempt — printed
output should always look like paper, regardless of screen theme):

1. **`.banner`** (the educational-mode disclaimer shown on every page) had
   a hardcoded light-mode-only border (`#f0d58a`) and text color
   (`#6b4a08`) — in dark mode this rendered a light amber border/text on
   top of the dark-mode warning background, illegible. Switched both to
   `var(--warning)`, which is already themed correctly in both modes.
2. **`.badge.next-review`** had a hardcoded light-blue border (`#b6c9f7`)
   — same issue, switched to `var(--info)`.
3. **Real accessibility bug, not just a token-discipline nitpick**: white
   text (`#fff`) on `var(--brand)` backgrounds (`.btn-primary`,
   `.persona-avatar`) — contrast ratio ~6:1 in light mode (fine), but only
   ~2.5:1 in dark mode against the brighter dark-mode brand teal, well
   below the ~3:1 WCAG AA floor for UI components/large text. Added a new
   `--brand-contrast` token (`#ffffff` light, `#06201a` dark, ~8:1) and
   pointed both rules at it instead of a literal white.
4. Verified: `tsc --noEmit`, `npm run lint`, `npm test` (140/140), a clean
   `next build`, and confirmed live against the restarted dev server that
   all three `--brand-contrast` variants (light + the two dark-mode
   blocks) actually compiled into the served CSS.

## 2026-09-08 — Fixed a real gap: disability's `dependentsMonthlyNeeds` was never asked or honestly logged as unknown

`DisabilityCalculatorInput.dependentsMonthlyNeeds` (PRD §13.1:
`RequiredMonthlyIncome = EssentialMonthlyExpenses + DebtMonthlyPayments +
DependentsMonthlyNeeds - ReliableIncomeDuringDisability`) has been in the
calculator's type and formula since Milestone 3, fully tested — but no
question in `STARTER_QUESTIONS` ever asked for it, and the calculator
read it via `input.dependentsMonthlyNeeds ?? zero` (a *silent* default,
unlike every other optional field in this calculator, which goes through
`resolveMoney` and logs a `missingFacts` + `Assumption` entry). Net
effect: a household with dependents always got `dependentsMonthlyNeeds`
treated as a confirmed zero, with no signal anywhere that it was actually
unknown — a real violation of the "unknown stays unknown" discipline
documented everywhere else in this codebase, not just an unused field.

1. **Calculator now uses `resolveMoney` for this field too** — logs
   `missingFacts`/`Assumption` when truly absent, same as
   `essentialMonthlyExpenses`/`existingNetExpectedDisabilityIncome`.
2. **New question `household_dependents_monthly_needs`**
   (`expenses.dependents.monthly`), `showWhen`/`requiredWhen` gated on
   `household_dependents_count > 0` — same pattern as
   `household_youngest_dependent_age`.
3. **The explicit-zero-vs-undefined distinction lives in the adapter**
   (`facts-to-disability-input.ts`), not the calculator: `dependentCount
   === 0` → a real, confirmed `Money.zero()` (not a gap); dependents
   exist but the amount fact is absent → stays `undefined`, a genuine
   unknown. `packages/calculators/src/demo/household-fixture-adapter.ts`
   (the fixture-driven `/` page) is unaffected — it already always
   passes an explicit `Money.zero()` here for a separately-documented
   reason (avoiding double-counting against `essentialMonthlyExpenses`).
4. Had to update one existing test (`disability-insurance-calculator.test.ts`
   #8) whose "high confidence" assertion implicitly relied on the old
   silent-zero behavior for a field the test wasn't actually about —
   added an explicit `dependentsMonthlyNeeds: Money.zero()` to keep its
   actual focus (existing-coverage zero-vs-missing) intact. Added 4 new
   tests (calculator + adapter) covering the new behavior; verified via a
   temporary scratch test (deleted after) that the question is reachable
   in the live selector once dependents exist, and never asked when they
   don't. 140/140 tests pass (up from 136), `tsc -b`, `npm run lint`, and
   a clean `next build` all pass.
5. Verified end-to-end against the running dev server: posted
   `household.dependents.count`/`expenses.dependents.monthly` facts to
   the demo profile via the live API, confirmed they persisted correctly,
   then cleared the demo profile's facts afterward (same effect as the
   questionnaire's own "start over" button) — **note for whoever reads
   this next**: if real answers had been entered in the browser against
   this demo profile before this verification ran, they were wiped by
   that cleanup; the demo profile has no history/undo (§34 real
   audit/auth doesn't exist yet).

## 2026-09-08 — Coverage-deduplication engine wired into the live flow (closes report §11)

`CoverageDeduplicationEngine` (PRD §18) has existed and been tested since
Milestone 4, but until now the `coverages` table only ever held
`packages/test-fixtures` data — a real user could never actually trigger
it, and `/report`'s §11 section said so explicitly instead of doing
anything. This closes that gap:

1. **New `/api/coverages` route** (GET/POST/DELETE), same pattern as
   `/api/facts` — Prisma's `Decimal` amounts serialize as plain numbers
   (not Decimal-strings) for the same reason `/api/facts` does that for
   `confidence`.
2. **New `apps/web/lib/compute-dedup.ts`** rehydrates the API's plain
   numbers into real `Money` and calls the engine — shared by the new
   `/coverages` page and `/report`'s §11 section, so both can never
   disagree about what counts as a duplicate.
3. **New `/coverages` page**: add/list/delete existing policies (category,
   provider/subtype, beneficiary, lump-sum or monthly amount, optional
   start/end dates), with a live duplicate-check panel underneath. Saved
   as-entered with `verified: false, source: "user"` — a user typing in
   their own policy details is self-reported/unverified data, same
   default already used for every other user-entered value in this app.
4. **`getOrCreateDemoClientProfile()` now also returns `primaryPersonId`**
   (it always created one, just never exposed it) — needed as
   `Coverage.insuredPersonId` since there's still no multi-person
   household UI; every policy is attached to the one demo person. Revisit
   once real multi-person households exist.
5. **`/report`'s §11 section now shows real flags** (or "fewer than 2
   policies entered yet, add them here →" or "no overlap found") instead
   of a permanent "not available in the live flow" note.
6. Verified end-to-end: created two overlapping life policies via the
   live API against the running dev server, confirmed
   `CoverageDeduplicationEngine` actually flags that exact pair
   (duplicateScore 100, all four factors matched) via a temporary
   scratch test using the identical data shape, then deleted both the
   scratch test and the test policies. `tsc --noEmit`, `npm run lint`,
   `npm test` (136/136), and a clean `next build` (dev server stopped +
   `.next` cleared first) all pass.

## 2026-09-08 — Visual redesign pass: real design system + dark mode

User feedback after Milestones 1-7 logic was complete: "עדיין התמקדנו
בלוגיקה עד עכשיו, ה-UI עדיין לא ממומש למערכת רצינית" (we've focused on
logic so far, the UI isn't built for a serious product), immediately
followed by "ולא לשכוח שהמערכת הסופית לא צריכה להיות בתצוגה סטנדרתית
פשוטה ב-LIGHTMODE" (the final system must not be plain light-mode-only).
This entry covers the full response.

1. **Design tokens, not hardcoded colors.** `globals.css` now defines a
   full CSS-custom-property palette (`--bg`, `--surface`, `--surface-alt`,
   `--border`, `--text`, `--muted`, `--brand`/`--brand-dark`/`--brand-bg`,
   `--info`/`--success`/`--warning`/`--danger` + their `-bg` variants,
   shadows, radii). Every component references tokens, never literal hex
   values, so a single palette swap re-themes the whole app.
2. **Real dark mode, not just a "dark CSS file".** Tokens are redefined
   twice: once under `@media (prefers-color-scheme: dark)` guarded by
   `:root:not([data-theme="light"])` (follows the OS by default), and
   again under `:root[data-theme="dark"]` (wins when the user explicitly
   picks a theme). `NavBar` adds a theme toggle (system → light → dark →
   system) persisted to `localStorage`, since it's a per-device viewing
   preference, not app data — same reasoning already used for other
   client-only UI state in this codebase.
3. **A previously-undetected bug this pass fixed as a side effect**:
   `page.tsx`, `questionnaire/page.tsx` and `report/page.tsx` all
   referenced `var(--accent)` and `var(--gap)`, CSS variables that never
   existed even in the pre-redesign `globals.css` (the old file used
   different names) — those links/error-texts were silently rendering in
   an unstyled fallback color. Replaced with the real tokens (`--brand`,
   `--danger`).
4. **New `.card-header`/`.card-icon` + a `coverageRatio` prop on
   `ResultCard`** — each result now shows a category emoji and a
   proportional "existing vs. gap" bar, computed from the *same*
   `PriorityEngine.gapRatioAndCoverageAdequacy(...)` call already used for
   scoring (exposed as `coverageRatio` on each category in
   `compute-recommendations.ts`'s `ComputedRecommendations`), so the bar
   and the priority score can never silently disagree with each other.
5. **Questionnaire wizard redesigned** (`.wizard-card`,
   `.wizard-progress-track/fill`, `.choice-grid`/`.choice-card`) —
   boolean/single-select answers used to be `<button className="badge">`,
   i.e. literally the same visual language as a non-interactive status
   pill. Real buttons now use `.btn`/`.btn-primary`/`.btn-ghost`,
   distinct from `.badge` (info-only, non-clickable).
6. **Home page's 5 fixtures wrapped in `<details className="persona-accordion">`**
   instead of a flat, always-expanded list of 5×(4 cards) — makes the
   page scannable instead of one long scroll of every persona's full
   detail at once.
7. Verified: `tsc --noEmit`, `npm run lint`, `npm test` (136/136) and a
   clean `next build` (stopped the running dev server + cleared `.next`
   first, per the port/stale-cache lesson from earlier in this project)
   all pass; confirmed live via curl against the restarted dev server
   (port 4310) that `/`, `/questionnaire`, `/report` all return 200 and
   the new `app-nav`/`persona-accordion`/`card-icon` markup is present.

## 2026-09-08 — Budget/Affordability wired into the live flow (closes report §10)

1. **Added one question** (`budget_monthly_protection`) instead of a
   dedicated adapter module — a single fact read inline in
   `compute-recommendations.ts`, since only one field is involved and a
   whole `facts-to-budget-input.ts` file would be ceremony for it.
2. **Scoped to life insurance only**, matching `BudgetAffordabilityEngine`'s
   own scoping (lump-sum categories only — see its original entry above).
   Disability/CI/LTC don't get an affordability-adjusted priority yet.
3. **`lifeAffordability.affordabilityPenalty` now actually feeds
   `PriorityEngine`** for the life category — previously implemented and
   tested in isolation but never actually consumed anywhere in the app.
4. **Report §10 shows real numbers once a budget fact exists**, and
   still explicitly states the engine exists-but-unused otherwise — the
   same explicit-not-silent pattern used throughout, now demonstrated
   with a real state transition instead of always showing the same
   placeholder text.
5. Verified end-to-end by posting the PRD's own §20 example value (a
   300 ILS/month budget) to the live demo profile via the API.

## 2026-09-08 — Report renderer (Milestone 7, PRD §39) + computation extraction

1. **`lib/compute-recommendations.ts` factors out the ~150-line
   calculator/priority/recommendation-builder wiring** that was inline in
   `/questionnaire`'s `LiveRecommendations` — now shared by that page and
   the new `/report` page instead of existing in only one place (a third
   copy would have been the same wiring duplicated three times). Concrete
   side benefit: `/questionnaire`'s client bundle dropped from 26.8kB to
   3.5kB, since the calculator classes are now instantiated once at
   module scope in a file both pages import, not re-bundled per page.
2. **`/report` reads facts straight from the API**, independent of the
   in-memory `answers` state the questionnaire keeps — meaning a report
   can be generated even after closing the browser and coming back later,
   genuinely exercising the persistence layer added earlier this session,
   not just the questionnaire's own live view of its own state.
3. **Two of the PRD's 16 sections say so explicitly instead of being
   silently omitted**: §10 (budget-constrained alternative) and §11
   (possible overlaps) both note plainly that the underlying engine exists
   and is tested (`BudgetAffordabilityEngine`, `CoverageDeduplicationEngine`)
   but isn't wired to the live questionnaire's data shape yet — same
   "unknown stays unknown, never silently" discipline applied to a report
   section instead of a calculator field.
4. **"Export" is `window.print()` with `@media print` CSS**, not a PDF
   library dependency (e.g. Puppeteer/pdf-lib) — a `<details>` element's
   content is only visible when `[open]`, which CSS alone can't force for
   print, so the print button explicitly sets `open` on every `<details>`
   right before calling `window.print()`.
5. **Fixed: `GET /api/facts` returned `confidence` as a string** (Prisma's
   `Decimal` serializes to a string over JSON), silently violating the
   shared `Fact` type's `confidence: number`. Nothing consumed
   `fact.confidence` yet so this had caused no visible bug, but it was a
   real type-vs-runtime mismatch waiting to bite the next thing that reads
   it. Fixed by converting in the route handler rather than documenting
   it as a known gap.

## 2026-09-08 — Real persistence: Postgres migration run + API layer (Milestone 6 start)

1. **Docker Desktop became reachable this session** — ran the actual
   `prisma migrate dev` against real PostgreSQL for the first time (27
   tables created, matching `prisma/schema.prisma` exactly). This was
   blocked since Milestone 1; no schema changes were needed to make it
   work, confirming the schema itself was sound all along.
2. **No auth system exists yet, so there is exactly one "demo" client
   profile per local database** (`lib/demo-profile.ts`), identified by a
   fixed email, bootstrapped on first API call. This is explicitly a
   placeholder for real multi-user auth (§34), not a design pattern to
   extend — the day real login exists, this file gets deleted, not grown.
3. **Chose Next.js Route Handlers (`app/api/*/route.ts`) over standing up
   a separate NestJS/Fastify service** — the NestJS-vs-Fastify choice was
   deferred back in Milestone 1 (see that entry). Given how much of the
   engine already lives in `packages/calculators`/`packages/questionnaire`
   and runs fine in a Next.js server context, adding a separate backend
   process now would be pure ceremony for what's still a single
   read/write-facts API. Revisit this choice when the API surface grows
   past what Route Handlers comfortably express (auth, background jobs,
   the audit-event-write-path separation §36 asks for).
4. **`Fact` has no unique constraint on `(clientProfileId, key)` in the
   schema** (only an index) — `POST /api/facts` does a manual
   find-then-update-or-create instead of a real Prisma `upsert`. Correct
   for a single-user local demo with no concurrent writers; would need
   the real unique constraint (a migration) for any multi-user use.
5. **`persistFact` is fire-and-forget from the client** — a failed save
   logs to the console and leaves the in-memory answer as the source of
   truth for the rest of that session, but does NOT retry or surface an
   error to the user. PRD §55 ("no recommendation loss on refresh") is
   satisfied for the success path only; a real product needs retry/error
   UI here, not just a console.error.
6. **`next build` failed once with a `Cannot find module './193.js'`
   error while collecting page data for `/api/facts`** — caused by a
   stale `.next` build directory left over from a concurrently-running
   dev server on the same directory, not a real code issue. Fixed by
   stopping the dev server and deleting `.next` before rebuilding.
   Documented in case it recurs — it's a build-cache hygiene issue, not
   something to "fix" in the API route itself.

## 2026-09-08 — Fixed: text input invisible when unfocused

The questionnaire's free-text/number/money `<input>` only had a `border`
set inline, no explicit `background`/`color` — reported by a user as "the
input disappears without focus". Moved to a `.form-input` CSS class in
`globals.css` with explicit `background`/`color`/`border` in all states
plus a visible `:focus` style, so there's nothing left for a browser or a
content-altering extension (this session already has direct evidence of
one running in the user's browser — see the earlier console-log exchange)
to guess wrong about.

## 2026-09-08 — Questionnaire extended to all five calculators (unified bank)

1. **One unified `STARTER_QUESTIONS` bank replaces the life-only one** —
   `household_dependents_count` is asked once and its Fact feeds life,
   disability, and CI's priority scoring alike, matching the PRD's actual
   design (§7/§10: one questionnaire, many calculators), not the
   per-category silos the previous pass's scoping note said would be
   "mechanical repetition" to add — this is that repetition, done.
2. **Two PRD concepts are still deliberately conflated onto shared facts**
   (documented in the file's own header and docs/ASSUMPTIONS.md):
   `income.survivor.reliableMonthly` answers both "survivor income" (life)
   and "income during disability" (disability/CI), and
   `expenses.household.monthly` answers both "total household spend"
   (life) and "essential expenses" (disability/CI). Splitting these into
   truly separate questions is possible later without any architecture
   change — it's two more questions, not a redesign.
3. **The 7 health-module questions are generated from
   `ALL_HEALTH_COVERAGE_MODULES`** (a `.map()`, not 7 hand-written
   near-duplicate objects) — added `packages/domain` as a dependency of
   `packages/questionnaire` for this (checked: acyclic, domain doesn't
   depend on questionnaire).
4. **`packages/calculators` gained four more real Facts adapters**
   (`facts-to-disability-input.ts`, `facts-to-critical-illness-input.ts`,
   `facts-to-ltc-input.ts`, `facts-to-health-input.ts`), all following the
   exact pattern `facts-to-life-input.ts` established.
5. **`/questionnaire` now renders all five calculator cards** (reusing
   `ResultCard` and the newly-extracted `HealthModuleCard`, moved to
   `app/components/health-module-card.tsx` for the same sharing reason
   `ResultCard` was extracted) from one flowing conversation, computed
   live — the same shape as `/`'s fixture-driven view, but from real
   answers.
6. **CI and LTC use fixed scenario parameters (6 months, 3 years)** in
   this live flow rather than letting the user pick — the scenario
   *comparison* UI (multiple durations side by side) only exists on the
   fixture-driven `/` page for now; adding a duration picker to the live
   flow is a UI task, not an engine gap.

## 2026-09-08 — Adaptive Questionnaire engine + real interactive flow — Milestone 2 (scoped to Life)

1. **§7.2's four-factor `questionScore` formula was simplified to two
   effective factors**: `relevance` (showWhen true/absent) and
   `uncertainty` (unanswered) collapse into a single "is this question
   even askable right now" filter — there's no partial-relevance or
   partial-uncertainty state for a single-value answer, so multiplying
   four 0..1 factors together would need two more invented per-question
   constants (`answerability`, a finer-grained `uncertainty`) for zero
   behavioral difference from just filtering. What's left —
   `decisionImpact - userBurdenPenalty` — is what actually ranks
   candidates. `decisionImpact` is authored per-question (invented, like
   every other unscored PRD factor); `userBurdenPenalty` is a small
   config-free lookup by `answerType` (boolean cheapest, multi_select
   priciest).
2. **This questionnaire is scoped to the Life Insurance calculator only**
   (12 questions) — not the full life/disability/CI/health/LTC coverage
   the PRD's Third Prompt (§49) asks for. Extending it to the other four
   calculators is mechanical repetition of the exact same pattern
   (question → fact key → adapter field), not a design problem; scoping
   down here kept this slice real and fully tested rather than wide and
   shallow.
3. **`factsToLifeCalculatorInput` (packages/calculators) is the REAL Facts
   Engine adapter**, using the dotted fact-key convention from PRD §8's
   own examples — this is what `fromHouseholdFixture` (the demo adapter)
   was always a stand-in for. A missing optional fact stays `undefined`
   here too (never silently 0) — the same discipline flows all the way
   from a real answer through to the calculator.
4. **The `apps/web` preview now has two pages**: `/` (5 hardcoded
   fixtures, unchanged) and `/questionnaire` (a real client-side flow —
   `"use client"`, no fixtures, no fake data). `ResultCard` and its label
   maps were extracted to `app/components/result-card.tsx` so both pages
   share it instead of duplicating ~150 lines.
5. **Import paths inside `apps/web` use extension-less specifiers**
   (`"./components/result-card"`, not `.../result-card.js`) — unlike
   every `packages/*` package (which use NodeNext resolution and need the
   explicit `.js` extension), Next.js's webpack bundler doesn't resolve a
   `.js`-suffixed import to a `.tsx` source file even though `tsc
   --noEmit` was satisfied by TS's `bundler` moduleResolution — caught by
   `next build` failing after `tsc --noEmit` had already passed clean.
6. **Validation warnings never block progress; errors do** — same PRD §33
   rule as everywhere else in this codebase, now reachable by an actual
   user typing an actual number into an actual text box for the first
   time, not just asserted in a unit test.

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
