import type { CalculationTrace } from "@insurance-advisor/shared";

/**
 * Shared presentational card used by both the fixture-driven preview
 * (app/page.tsx) and the real interactive questionnaire flow
 * (app/questionnaire/page.tsx) — extracted so the two don't duplicate
 * ~150 lines of label maps/formatting/markup.
 */
export const REASON_CODE_LABELS: Record<string, string> = {
  LIFE_DEPENDENTS_PRESENT: "קיימים תלויים כלכליים",
  LIFE_INCOME_DEPENDENCY: "תלות בהכנסת המפרנס",
  LIFE_MORTGAGE_GAP: "פער בכיסוי המשכנתה",
  LIFE_EXISTING_COVERAGE_SUFFICIENT: "הכיסוי הקיים מספיק לצורך המחושב",
  DI_INCOME_DEPENDENCY: "תלות בהכנסה השוטפת",
  DI_EXISTING_MONTHLY_GAP: "פער חודשי מול הכיסוי הקיים",
  CI_LOW_LIQUID_BUFFER: "נדרשת רזרבה נזילה לתקופת ההתאוששות",
  CI_EXISTING_COVERAGE_PRESENT: "קיים כיסוי מחלות קשות",
  HEALTH_MODULE_UNKNOWN: "לא ידוע אם קיים כיסוי",
  HEALTH_DUPLICATE_POSSIBLE: "חשש לכפילות כיסוי",
  LTC_MONTHLY_GAP: "פער חודשי בעלות הטיפול הסיעודי",
  LTC_SELF_FUNDING_CAPACITY_HIGH: "יכולת מימון עצמי גבוהה",
};

export const CONFIDENCE_LABELS: Record<string, string> = {
  high: "גבוהה",
  medium: "בינונית",
  low: "נמוכה",
};

export const PRIORITY_BAND_LABELS: Record<string, string> = {
  CRITICAL: "קריטי",
  HIGH: "גבוה",
  MEDIUM: "בינוני",
  LOW: "נמוך",
  INFORMATIONAL: "מידע בלבד",
};

export function priorityBadgeText(band: string, score: number): string {
  return `עדיפות: ${PRIORITY_BAND_LABELS[band] ?? band} (${score})`;
}

export const STATUS_LABELS: Record<string, string> = {
  recommended: "מומלץ",
  consider: "לשקול",
  not_needed: "לא נדרש",
  review_existing: "לבדוק כיסוי קיים",
  manual_review: "נדרשת בדיקה ידנית",
};

export const currencyFormatter = new Intl.NumberFormat("he-IL", {
  style: "currency",
  currency: "ILS",
  maximumFractionDigits: 0,
});

export function formatExact(amountExact: string): string {
  return currencyFormatter.format(Number(amountExact));
}

export type Figure = { label: string; amountExact: string; emphasize?: boolean };

export function ResultCard(props: {
  title: string;
  badges: string[];
  confidence: "high" | "medium" | "low";
  priority?: { band: string; score: number };
  status?: string;
  nextReviewDate?: string;
  rationale?: string[];
  reasonCodes: string[];
  figures: Figure[];
  note?: string;
  missingFacts: string[];
  trace: CalculationTrace;
  extraContent?: React.ReactNode;
}) {
  const { title, badges, confidence, priority, status, nextReviewDate, rationale, reasonCodes, figures, note, missingFacts, trace, extraContent } = props;
  return (
    <section className="card">
      <h2>{title}</h2>

      <div className="badges">
        {priority && (
          <span className={`badge priority-${priority.band}`}>{priorityBadgeText(priority.band, priority.score)}</span>
        )}
        {status && <span className="badge">סטטוס: {STATUS_LABELS[status] ?? status}</span>}
        {nextReviewDate && <span className="badge next-review">🗓 בדיקה הבאה: {nextReviewDate}</span>}
        <span className={`badge confidence-${confidence}`}>אמינות נתונים: {CONFIDENCE_LABELS[confidence]}</span>
        {badges.map((b) => (
          <span className="badge" key={b}>
            {b}
          </span>
        ))}
        {reasonCodes.map((code) => (
          <span className="badge" key={code}>
            {REASON_CODE_LABELS[code] ?? code}
          </span>
        ))}
      </div>

      <div className="figures">
        {figures.map((f) => (
          <div className={`figure${f.emphasize ? " gap" : ""}`} key={f.label}>
            <div className="label">{f.label}</div>
            <div className="value">{formatExact(f.amountExact)}</div>
          </div>
        ))}
      </div>

      {rationale?.map((r) => (
        <p key={r} style={{ fontSize: "0.9rem" }}>
          {r}
        </p>
      ))}

      {note && <p style={{ fontSize: "0.86rem", color: "var(--muted)" }}>{note}</p>}

      {missingFacts.length > 0 && (
        <p className="missing">נתונים חסרים (הוחלף בהנחת 0 עד להשלמה): {missingFacts.join(", ")}</p>
      )}

      {extraContent}

      <details>
        <summary>איך חושב הפער? (Calculation trace)</summary>
        <table className="trace">
          <tbody>
            {trace.lines.map((line) => (
              <tr key={line.key}>
                <td>{line.label}</td>
                <td className="amount">{formatExact(line.amountExact)}</td>
              </tr>
            ))}
            <tr>
              <td>
                <strong>פער סופי</strong>
              </td>
              <td className="amount">
                <strong>{formatExact(trace.resultExact)}</strong>
              </td>
            </tr>
          </tbody>
        </table>
      </details>
    </section>
  );
}
