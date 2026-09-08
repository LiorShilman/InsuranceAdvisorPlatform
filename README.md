# Insurance Advisor Platform

Implementation of `INSURANCE_ADVISOR_PRD_v1.0.md` (Insurance Needs Analysis
Platform). This is a **separate project** from `ls-financial-advisor` — see
`docs/DECISIONS.md` for why.

**Status: Milestones 1, 3, 4, 5, 7 done; Milestone 2 (questionnaire) and
Milestone 6 (UI/persistence) well underway.** All five need calculators
(life, disability, critical illness, health-by-module, LTC) are real and
tested, along with the rule engine, coverage-deduplication engine,
priority engine, budget/affordability layer, recommendation object, and
review scheduler. A real adaptive questionnaire drives all five from one
set of answers, those answers persist to a real PostgreSQL database (not
just browser state), existing policies can be entered and are actually
checked for overlaps (not just on the 5 fixed demo personas), a 16-section
report (§39) renders from that same real data with browser print-to-PDF
export, and the UI has a real design-token system with genuine dark mode
(not a light-only skin). See `docs/DECISIONS.md` for the full, dated
history of what was built and why, and `docs/ASSUMPTIONS.md` for every
invented placeholder number that still needs real product/actuarial/legal
review.

Still missing: authentication (there is exactly one hardcoded "demo"
profile per database — see `apps/web/lib/demo-profile.ts`), the LLM
explanation layer (§29), the admin console (§51), and Product
Matching/real pricing (§50, explicitly Phase 2).

## Layout

```
apps/web               Next.js app — fixture-driven preview at `/`, a real
                        interactive questionnaire at `/questionnaire`,
                        existing-policy entry + duplicate check at
                        `/coverages`, a full 16-section report at
                        `/report`, plus a small API (`app/api/profile`,
                        `app/api/facts`, `app/api/coverages`) backed by
                        Prisma/Postgres
packages/shared         Money, CalculationTrace, Assumption, Fact (PRD §8, §25)
packages/rules          Rule/NeedStatus types + a real SimpleRuleEngine (PRD §11)
packages/domain         Core entities: Person, Household, Coverage, Recommendation, ... (PRD §26.1, §21)
packages/config         Versioned EngineConfig + starter values (PRD §41)
packages/questionnaire  Question schema, selector, validation, fact production (PRD §7, §49)
packages/calculators    All 5 need calculators, priority/budget/recommendation/review
                        engines, and the real Facts→calculator-input adapters (PRD §10-22)
packages/test-fixtures  5 representative households incl. an exact PRD §57 reproduction
prisma/schema.prisma    PostgreSQL schema (PRD §26.2) — migrated and live
docs/                   DECISIONS.md, ASSUMPTIONS.md, REGULATORY-TODO.md (PRD rules 18-20)
```

## Getting started

```bash
npm install
npm run typecheck   # tsc -b, strict mode, no `any`
npm run lint
npm test            # vitest — 130+ tests across every calculator/engine

# Postgres (needed for apps/web's API routes / the questionnaire's persistence):
docker compose up -d
cp .env.example .env   # only if you don't already have one
npm run prisma:migrate

npm run preview     # starts apps/web on the fixed port http://localhost:4310
```

Open `http://localhost:4310` for the fixture-driven preview (5 hardcoded
households) or `http://localhost:4310/questionnaire` for the real,
persisted, interactive flow.

## Next steps

- Widen the questionnaire's ~20-question starter bank (still short of the
  PRD's illustrative "~70 questions", §7.1) — only worth doing alongside
  new calculator inputs that actually consume the answers, not as
  unconsumed facts.
- The LLM explanation-only layer (§29) — needs a provider/API-key decision.
- Real authentication, replacing `lib/demo-profile.ts`'s single hardcoded
  profile.
- Revisit the Next.js-Route-Handlers-as-API decision (docs/DECISIONS.md)
  once auth/background-jobs/audit-write-path needs grow past what that
  comfortably expresses.
