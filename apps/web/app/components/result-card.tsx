import type { CalculationTrace } from "@insurance-advisor/shared";
import { formatExact } from "../../lib/format";
import { WaterfallChart } from "./waterfall-chart";

export { currencyFormatter, formatExact } from "../../lib/format";

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

/**
 * Status colors alone (--success/--warning/--danger/--danger-strong) are
 * NOT a safe identity channel — see docs/DECISIONS.md's palette-validation
 * entry: even the dataviz skill's own reference status ramp fails a strict
 * pairwise CVD check, and explicitly calls "icon + label, never color
 * alone" the real mitigation, not a perfect hex triplet. These prefix
 * every status badge so meaning survives even if the color is
 * indistinguishable to a given viewer.
 */
export const CONFIDENCE_ICONS: Record<string, string> = { high: "✓", medium: "!", low: "✕" };

export const PRIORITY_BAND_LABELS: Record<string, string> = {
  CRITICAL: "קריטי",
  HIGH: "גבוה",
  MEDIUM: "בינוני",
  LOW: "נמוך",
  INFORMATIONAL: "מידע בלבד",
};

export const PRIORITY_BAND_ICONS: Record<string, string> = {
  CRITICAL: "✕",
  HIGH: "!!",
  MEDIUM: "!",
  LOW: "✓",
  INFORMATIONAL: "·",
};

export function priorityBadgeText(band: string, score: number): string {
  const icon = PRIORITY_BAND_ICONS[band];
  return `${icon ? icon + " " : ""}עדיפות: ${PRIORITY_BAND_LABELS[band] ?? band} (${score})`;
}

export const STATUS_LABELS: Record<string, string> = {
  recommended: "מומלץ",
  consider: "לשקול",
  not_needed: "לא נדרש",
  review_existing: "לבדוק כיסוי קיים",
  manual_review: "נדרשת בדיקה ידנית",
};

export type Figure = { label: string; amountExact: string; emphasize?: boolean };

export const CATEGORY_ICONS: Record<string, string> = {
  life: "❤️",
  disability: "💪",
  critical_illness: "🏥",
  ltc: "🧓",
  health: "⚕️",
};

export function ResultCard(props: {
  title: string;
  icon?: string;
  /** 0..1 — fraction of the gross need already covered by existing coverage/resources. Renders a proportional bar above the figures. */
  coverageRatio?: number;
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
  const { title, icon, coverageRatio, badges, confidence, priority, status, nextReviewDate, rationale, reasonCodes, figures, note, missingFacts, trace, extraContent } = props;
  return (
    <section className="card">
      <div className="card-header">
        {icon && <span className="card-icon" aria-hidden="true">{icon}</span>}
        <h2>{title}</h2>
      </div>

      {coverageRatio !== undefined && (
        <div className="gap-bar-track" title={`מכוסה: ${Math.round(Math.min(1, Math.max(0, coverageRatio)) * 100)}%`}>
          <div className="gap-bar-existing" style={{ width: `${Math.round(Math.min(1, Math.max(0, coverageRatio)) * 100)}%` }} />
        </div>
      )}

      <div className="badges">
        {priority && (
          <span className={`badge priority-${priority.band}`}>{priorityBadgeText(priority.band, priority.score)}</span>
        )}
        {status && <span className="badge">סטטוס: {STATUS_LABELS[status] ?? status}</span>}
        {nextReviewDate && <span className="badge next-review">🗓 בדיקה הבאה: {nextReviewDate}</span>}
        <span className={`badge confidence-${confidence}`}>
          {CONFIDENCE_ICONS[confidence]} אמינות נתונים: {CONFIDENCE_LABELS[confidence]}
        </span>
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
        {trace.lines.length > 0 && <WaterfallChart lines={trace.lines} totalLabel="פער סופי" totalExact={trace.resultExact} />}
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
