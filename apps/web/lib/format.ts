/**
 * Split out of components/result-card.tsx so waterfall-chart.tsx can use
 * the same formatter without importing from result-card.tsx (which itself
 * imports WaterfallChart) — that would've been a circular import.
 * result-card.tsx re-exports `formatExact` from here so none of its
 * existing external callers needed to change their import path.
 */
export const currencyFormatter = new Intl.NumberFormat("he-IL", {
  style: "currency",
  currency: "ILS",
  maximumFractionDigits: 0,
});

export function formatExact(amountExact: string): string {
  return currencyFormatter.format(Number(amountExact));
}
