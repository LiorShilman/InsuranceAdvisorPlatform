import { STARTER_ENGINE_CONFIG } from "@insurance-advisor/config";
import { ALL_HOUSEHOLD_FIXTURES } from "@insurance-advisor/test-fixtures";
import { LifeInsuranceCalculator, fromHouseholdFixture } from "@insurance-advisor/calculators";

const REASON_CODE_LABELS: Record<string, string> = {
  LIFE_DEPENDENTS_PRESENT: "קיימים תלויים כלכליים",
  LIFE_INCOME_DEPENDENCY: "תלות בהכנסת המפרנס",
  LIFE_MORTGAGE_GAP: "פער בכיסוי המשכנתה",
  LIFE_EXISTING_COVERAGE_SUFFICIENT: "הכיסוי הקיים מספיק לצורך המחושב",
};

const CONFIDENCE_LABELS: Record<string, string> = {
  high: "גבוהה",
  medium: "בינונית",
  low: "נמוכה",
};

const currencyFormatter = new Intl.NumberFormat("he-IL", {
  style: "currency",
  currency: "ILS",
  maximumFractionDigits: 0,
});

function formatExact(amountExact: string): string {
  return currencyFormatter.format(Number(amountExact));
}

const calculator = new LifeInsuranceCalculator();
// Fixed "now" so the preview is deterministic across runs/reviewers, matching the fixtures' own reference date.
const NOW = new Date("2026-09-07T00:00:00.000Z");

export default function PreviewPage() {
  return (
    <main>
      <h1>תצוגה מקדימה — מנוע צורך ביטוח חיים</h1>
      <p className="subtitle">
        Milestone 3 (PRD §12, §48) · מריץ את מחשבון ביטוח החיים על 5 פרופילי בדיקה ישירות מהקוד — ללא שאלון, ללא API, ללא אחסון.
      </p>

      <div className="banner">
        {
          "זה ניתוח מדיד מסייע לצרכים המפורטים ואינה מהווה תחליף/שיווק עם בעל רישיון מתאים שיאשר לך המלצה סופית. (PRD §4.3, Educational mode)"
        }
      </div>

      {ALL_HOUSEHOLD_FIXTURES.map((fixture) => {
        const input = fromHouseholdFixture(fixture, {}, NOW);
        const { result, trace } = calculator.calculate(input, STARTER_ENGINE_CONFIG);

        return (
          <section className="card" key={fixture.name}>
            <h2>ביטוח חיים — {fixture.name}</h2>
            <p className="fixture-desc">{fixture.description}</p>

            <div className="badges">
              <span className={`badge confidence-${result.confidence}`}>אמינות נתונים: {CONFIDENCE_LABELS[result.confidence]}</span>
              <span className="badge">טווח הגנה: {result.horizonYears} שנים</span>
              {result.reasonCodes.map((code) => (
                <span className="badge" key={code}>
                  {REASON_CODE_LABELS[code] ?? code}
                </span>
              ))}
            </div>

            <div className="figures">
              <div className="figure">
                <div className="label">צורך חישובי (ברוטו)</div>
                <div className="value">{formatExact(result.grossNeed.toExactString())}</div>
              </div>
              <div className="figure">
                <div className="label">כיסוי ומשאבים קיימים</div>
                <div className="value">{formatExact(result.availableResources.toExactString())}</div>
              </div>
              <div className="figure gap">
                <div className="label">פער מומלץ לכיסוי</div>
                <div className="value">{formatExact(result.gap.toExactString())}</div>
              </div>
            </div>

            <p style={{ fontSize: "0.86rem", color: "var(--muted)" }}>
              טווח מוצע: {formatExact(result.recommendedRange.min.toExactString())} – {formatExact(result.recommendedRange.max.toExactString())}
            </p>

            {result.missingFacts.length > 0 && (
              <p className="missing">
                נתונים חסרים (הוחלף בהנחת 0 עד להשלמה): {result.missingFacts.join(", ")}
              </p>
            )}

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
      })}
    </main>
  );
}
