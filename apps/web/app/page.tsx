import { STARTER_ENGINE_CONFIG } from "@insurance-advisor/config";
import { ALL_HOUSEHOLD_FIXTURES } from "@insurance-advisor/test-fixtures";
import type { CalculationTrace } from "@insurance-advisor/shared";
import {
  LifeInsuranceCalculator,
  DisabilityInsuranceCalculator,
  fromHouseholdFixture,
  fromHouseholdFixtureForDisability,
} from "@insurance-advisor/calculators";

const REASON_CODE_LABELS: Record<string, string> = {
  LIFE_DEPENDENTS_PRESENT: "קיימים תלויים כלכליים",
  LIFE_INCOME_DEPENDENCY: "תלות בהכנסת המפרנס",
  LIFE_MORTGAGE_GAP: "פער בכיסוי המשכנתה",
  LIFE_EXISTING_COVERAGE_SUFFICIENT: "הכיסוי הקיים מספיק לצורך המחושב",
  DI_INCOME_DEPENDENCY: "תלות בהכנסה השוטפת",
  DI_EXISTING_MONTHLY_GAP: "פער חודשי מול הכיסוי הקיים",
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

type Figure = { label: string; amountExact: string; emphasize?: boolean };

function ResultCard(props: {
  title: string;
  badges: string[];
  confidence: "high" | "medium" | "low";
  reasonCodes: string[];
  figures: Figure[];
  note?: string;
  missingFacts: string[];
  trace: CalculationTrace;
}) {
  const { title, badges, confidence, reasonCodes, figures, note, missingFacts, trace } = props;
  return (
    <section className="card">
      <h2>{title}</h2>

      <div className="badges">
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

      {note && <p style={{ fontSize: "0.86rem", color: "var(--muted)" }}>{note}</p>}

      {missingFacts.length > 0 && (
        <p className="missing">נתונים חסרים (הוחלף בהנחת 0 עד להשלמה): {missingFacts.join(", ")}</p>
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
}

const lifeCalculator = new LifeInsuranceCalculator();
const disabilityCalculator = new DisabilityInsuranceCalculator();
// Fixed "now" so the preview is deterministic across runs/reviewers, matching the fixtures' own reference date.
const NOW = new Date("2026-09-07T00:00:00.000Z");

export default function PreviewPage() {
  return (
    <main>
      <h1>תצוגה מקדימה — מנוע צרכי ביטוח</h1>
      <p className="subtitle">
        Milestone 3 (PRD §12-13, §48) · מריץ את מחשבוני ביטוח חיים ואבדן כושר עבודה על 5 פרופילי בדיקה ישירות מהקוד —
        ללא שאלון, ללא API, ללא אחסון.
      </p>

      <div className="banner">
        {
          "זה ניתוח מדיד מסייע לצרכים המפורטים ואינה מהווה תחליף/שיווק עם בעל רישיון מתאים שיאשר לך המלצה סופית. (PRD §4.3, Educational mode)"
        }
      </div>

      {ALL_HOUSEHOLD_FIXTURES.map((fixture) => {
        const lifeInput = fromHouseholdFixture(fixture, {}, NOW);
        const life = lifeCalculator.calculate(lifeInput, STARTER_ENGINE_CONFIG);

        const disabilityInput = fromHouseholdFixtureForDisability(fixture, {}, NOW);
        const disability = disabilityCalculator.calculate(disabilityInput, STARTER_ENGINE_CONFIG);

        return (
          <div key={fixture.name}>
            <h2 style={{ marginBottom: 2 }}>{fixture.name}</h2>
            <p className="fixture-desc" style={{ marginTop: 0, marginBottom: 14 }}>
              {fixture.description}
            </p>

            <ResultCard
              title="ביטוח חיים"
              badges={[`טווח הגנה: ${life.result.horizonYears} שנים`]}
              confidence={life.result.confidence}
              reasonCodes={life.result.reasonCodes}
              figures={[
                { label: "צורך חישובי (ברוטו)", amountExact: life.result.grossNeed.toExactString() },
                { label: "כיסוי ומשאבים קיימים", amountExact: life.result.availableResources.toExactString() },
                { label: "פער מומלץ לכיסוי", amountExact: life.result.gap.toExactString(), emphasize: true },
              ]}
              note={`טווח מוצע: ${formatExact(life.result.recommendedRange.min.toExactString())} – ${formatExact(life.result.recommendedRange.max.toExactString())}`}
              missingFacts={life.result.missingFacts}
              trace={life.trace}
            />

            <ResultCard
              title="ביטוח אבדן כושר עבודה"
              badges={[
                disability.result.recommendedDurationYears !== undefined
                  ? `משך מומלץ: ${disability.result.recommendedDurationYears} שנים`
                  : "משך מומלץ: לא ידוע (חסרים נתוני גיל)",
              ]}
              confidence={disability.result.confidence}
              reasonCodes={disability.result.reasonCodes}
              figures={[
                { label: "הכנסה חודשית נדרשת", amountExact: disability.result.requiredMonthlyIncome.toExactString() },
                { label: "כיסוי קיים (נטו, חודשי)", amountExact: disability.result.existingNetExpectedDisabilityIncome.toExactString() },
                { label: "פער חודשי מומלץ", amountExact: disability.result.monthlyGap.toExactString(), emphasize: true },
              ]}
              missingFacts={disability.result.missingFacts}
              trace={disability.trace}
            />
          </div>
        );
      })}
    </main>
  );
}
