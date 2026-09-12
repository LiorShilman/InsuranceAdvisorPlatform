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

Real multi-user accounts exist now (email/password or Google Sign-In,
`/register` + `/login`), replacing the single hardcoded demo profile —
every signed-in user gets their own `ClientProfile`, and every data API
enforces ownership (a session can only ever read/write its own data).
Accounts also have real hardening now: lockout after repeated failed
logins, per-IP rate limiting, and a password-strength check (see
docs/DECISIONS.md and docs/ASSUMPTIONS.md — password reset/email
verification are still deliberately deferred, pending a mail service).
A scoped LLM explanation layer (§29) now exists — on-demand, per
recommendation category, strictly "explain the already-computed
number," never a source of new numbers or advice (`/api/explain`,
`lib/llm-explain.ts`). Still missing: the admin console (§51), and
Product Matching/real pricing (§50, explicitly Phase 2).

## Layout

```
apps/web               Next.js app — fixture-driven preview at `/`, a real
                        interactive questionnaire at `/questionnaire`,
                        existing-policy entry + duplicate check at
                        `/coverages`, a scenario simulator at
                        `/scenarios`, a full 16-section report at
                        `/report`, email/password accounts (`/login`,
                        `/register`), plus a small API
                        (`app/api/auth/*`, `app/api/profile`,
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
cp .env.example .env                       # for the `prisma` CLI, run from repo root
cp apps/web/.env.example apps/web/.env     # for the app itself — see docs/DECISIONS.md
npm run prisma:migrate

npm run preview     # starts apps/web on the fixed port http://localhost:4310
```

Open `http://localhost:4310` for the fixture-driven preview (5 hardcoded
households, no account needed) or `http://localhost:4310/register` to
create a real account and use the persisted, interactive flow
(`/questionnaire`, `/coverages`, `/scenarios`, `/report`).

## Deployment

Runs as a standalone PM2-managed process that terminates its own HTTPS
(see `apps/web/server.mjs` and `ecosystem.config.cjs`, and
`docs/DECISIONS.md` for why this shape rather than an IIS reverse proxy):

```bash
npm run build --workspace apps/web
pm2 start ecosystem.config.cjs --env production   # https://<host>:37000
```

`apps/web/certs/{cert,key}.pem` (gitignored) must exist — copy the
household's shared self-signed cert in before the first deploy.

## Next steps

- Widen the questionnaire further, but only alongside new calculator inputs
  that actually consume the answers, never as unconsumed facts. **Not**
  toward a "~70 questions" target — §7.1's only mention of that number is
  "אין מטרה 70 שאלות אחת אחרי השנייה" ("there is no goal of 70 questions
  one after another"), i.e. the PRD explicitly *rejects* a large fixed
  question count as a goal, right before introducing the adaptive
  `getNextQuestion` selection mechanism whose whole point is asking only
  what's actually needed. An earlier version of this bullet cited "~70
  questions" as something to grow toward — a misreading of that line,
  corrected 2026-09-12 (see docs/DECISIONS.md). The current ~31-question
  bank (24 + 7 health modules), each fact real-consumed by a calculator, is
  what the PRD is actually asking for — not a gap. See docs/DECISIONS.md
  for what closed real gaps so far (`ltc_expected_monthly_care_cost`; CI
  recovery duration + LTC expected duration, both previously hardcoded in
  the live flow) vs. what was deliberately left alone (Employment
  disability-coverage Prisma fields — dead schema, and duplicative of a
  question that already exists).
- Password-reset flow + email verification for the auth system — needs a
  mail-sending service decision (SMTP/SendGrid/Resend/etc.), deliberately
  deferred; see docs/REGULATORY-TODO.md.
- Extend the LLM explanation layer (§29) to its other allowed uses
  (free-text fact extraction/§30, report summarization) — only "explain
  deterministic result" is built so far.
- Revisit the Next.js-Route-Handlers-as-API decision (docs/DECISIONS.md)
  once background-jobs/audit-write-path needs grow past what that
  comfortably expresses.
