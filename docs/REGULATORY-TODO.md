# Regulatory TODO

Maintained per PRD rule 20 (§46). This project must not encode legal
conclusions into the engine without a separately approved regulatory
specification (PRD §61, final line). Nothing in Milestone 1 (domain types,
DB schema, Money, Facts) makes any regulatory decision — this file exists
so the checklist isn't lost by the time it matters (roughly Milestone 6-9,
when the UI/disclaimer/licensed-flow work starts, PRD §4).

## Official sources to review before anything user-facing ships (PRD §61)

1. Knesset — Financial Services Supervision (Pension Counseling, Marketing
   and Clearing System) Law, 2005.
   https://main.knesset.gov.il/apps/legislation/main/laws/2000504
2. Capital Market, Insurance and Savings Authority — Licensing agents and
   advisers. https://www.gov.il/he/service/agents_licensing
3. Capital Market, Insurance and Savings Authority — Search for licensed
   agents/advisers. https://www.gov.il/he/service/agents_and_consultants_search

## Before production launch, legal counsel must verify (PRD §61)

- [ ] Whether the exact flow constitutes regulated advice/marketing.
- [ ] Required license ownership/identity.
- [ ] Disclosure language (PRD §4.3 gives draft MVP/Licensed copy — not
      legally reviewed).
- [ ] Record retention requirements.
- [ ] Privacy and sensitive-data obligations (health_disclosures,
      identifiers, documents tables in prisma/schema.prisma are flagged
      but not yet encrypted/masked at the field level).
- [ ] Rules for insurer/product comparison.
- [ ] Commission/conflict disclosures.
- [ ] Permissible integrations and customer authorizations.

## Pricing placeholder must not reach a real user (added 2026-09-08)

`packages/config`'s `affordability.assumedAnnualPremiumRatePer1000Coverage`
is an invented number, not real insurer pricing — see docs/ASSUMPTIONS.md.
It exists only to make the PRD §20 budget-affordability *mechanic*
demonstrable/testable. Before any budget-affordability output is shown to
a real user: replace it with actual Product Matching/insurer pricing
(PRD §3.2 Phase 2, §50), or clearly and prominently disclose that the
figure is illustrative, not a quote — never present it as a real premium.

## Auth hardening not yet implemented (added 2026-09-11)

Real accounts exist (`apps/web/lib/auth.ts`) but the minimum-viable
slice only: no password-reset flow, no email verification, no
rate-limiting on login attempts, no account lockout, no
password-complexity/breach-list check beyond an 8-character floor. None
of this blocks local/demo use, but all of it is expected before this
touches a real user's actual insurance/financial data in production —
see docs/ASSUMPTIONS.md.

## Feature flags not yet implemented (PRD §4.1)

`needsAnalysis`, `personalizedRecommendation`, `productComparison`,
`insurerSpecificRecommendation`, `quoteGeneration`, `purchaseFlow` — the
`RegulatoryFeatureFlags` type and its enforcement belong to whichever
milestone first exposes an API/UI surface a flag would gate.
