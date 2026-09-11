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

## Auth hardening — partially done (updated 2026-09-11)

Real accounts exist (`apps/web/lib/auth.ts`). As of 2026-09-11:
account lockout, per-IP rate limiting, and password complexity
(length + letter + digit + a small common-password blocklist) are
implemented — see docs/DECISIONS.md's auth-hardening entry. **Still
missing, deliberately deferred pending a mail-sending service the
project doesn't have configured**: password-reset flow, email
verification. Also still missing: a real breach-list check (e.g. HIBP)
beyond the hand-picked blocklist. None of this blocks local/demo use,
but the email-dependent items are expected before this touches a real
user's actual insurance/financial data in production — see
docs/ASSUMPTIONS.md.

## Google Sign-In — third-party data sharing (added 2026-09-11)

Signing in with Google shares the user's Google account email/name with
this app (via Google's own consent flow) — standard OAuth, but worth a
line in whatever privacy notice eventually gets written per the
"Privacy and sensitive-data obligations" checklist item above. The
OAuth Client ID currently reused is registered under a Google Cloud
project set up for the sibling `ls-financial-advisor` app, not one
specific to this product — its consent-screen branding reflects that
until/unless the user sets up a dedicated one.

## LLM explanation layer — third-party API, PRD §29 (added 2026-09-11)

`/api/explain` sends a subset of a user's computed insurance-need data
(Recommendation figures, calculation trace, assumptions, missing-facts
list — never raw Facts, never HealthDisclosure) to Anthropic's API to
generate a plain-language explanation. This is a real transfer of
personal financial data to a third-party processor and belongs in
whatever data-processing/sub-processor disclosure the "Privacy and
sensitive-data obligations" item above eventually produces.

## Feature flags not yet implemented (PRD §4.1)

`needsAnalysis`, `personalizedRecommendation`, `productComparison`,
`insurerSpecificRecommendation`, `quoteGeneration`, `purchaseFlow` — the
`RegulatoryFeatureFlags` type and its enforcement belong to whichever
milestone first exposes an API/UI surface a flag would gate.
