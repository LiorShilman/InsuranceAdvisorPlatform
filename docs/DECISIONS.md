# Architecture Decisions

Maintained per PRD rule 18 (§46). One entry per decision, newest first.

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
