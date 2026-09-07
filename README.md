# Insurance Advisor Platform

Implementation of `INSURANCE_ADVISOR_PRD_v1.0.md` (Insurance Needs Analysis
Platform). This is a **separate project** from `ls-financial-advisor` — see
`docs/DECISIONS.md` for why.

**Current milestone: Milestone 1 — Domain Foundation** (PRD §45). Nothing
past domain types, the DB schema, Money/CalculationTrace, Facts, rule/
calculator *interfaces*, and 5 test fixtures exists yet. No rule evaluation,
no calculator math, no questionnaire logic, no API, no UI. See
`docs/DECISIONS.md` and `docs/ASSUMPTIONS.md` for exactly what was and
wasn't built and why.

## Layout

```
apps/web        placeholder — Milestone 6 (Next.js client)
apps/api        placeholder — Milestone 2 (API server, framework TBD)
packages/shared        Money, CalculationTrace, Assumption, Fact (PRD §8, §25)
packages/rules         Rule/NeedStatus types + RuleEngine interface (PRD §11) — no evaluation logic yet
packages/domain        Core entities: Person, Household, Coverage, Recommendation, ... (PRD §26.1, §21)
packages/config        EngineConfig type + starter version (PRD §41)
packages/questionnaire Question schema type only (PRD §7.1) — no selection logic yet
packages/calculators   Generic NeedsCalculator interface (PRD §10) — no life/DI/CI/health/LTC math yet
packages/test-fixtures 5 representative households (PRD §47 pt 9)
prisma/schema.prisma   PostgreSQL schema (PRD §26.2)
docs/                  DECISIONS.md, ASSUMPTIONS.md, REGULATORY-TODO.md (PRD rules 18-20)
```

## Getting started

```bash
npm install
npm run typecheck   # tsc -b, strict mode, no `any`
npm run lint
npm test            # vitest

# Postgres (only needed once Prisma migrations are actually run):
docker compose up -d
cp .env.example .env
npm run prisma:validate
npm run prisma:generate
npm run prisma:migrate
```

## Next steps (not started)

- Milestone 2 — Adaptive Questionnaire engine (PRD §45, §49): question
  selection logic, `apps/api` scaffold.
- Milestone 3 — Rule engine evaluation + Life Insurance calculator (PRD §45,
  §48).
