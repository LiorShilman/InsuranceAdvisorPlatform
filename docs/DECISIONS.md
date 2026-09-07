# Architecture Decisions

Maintained per PRD rule 18 (§46). One entry per decision, newest first.

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
