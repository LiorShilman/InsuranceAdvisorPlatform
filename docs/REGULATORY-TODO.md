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

## Feature flags not yet implemented (PRD §4.1)

`needsAnalysis`, `personalizedRecommendation`, `productComparison`,
`insurerSpecificRecommendation`, `quoteGeneration`, `purchaseFlow` — the
`RegulatoryFeatureFlags` type and its enforcement belong to whichever
milestone first exposes an API/UI surface a flag would gate.
