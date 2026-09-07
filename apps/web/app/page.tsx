import { STARTER_ENGINE_CONFIG } from "@insurance-advisor/config";
import { ALL_HOUSEHOLD_FIXTURES } from "@insurance-advisor/test-fixtures";
import type { CalculationTrace } from "@insurance-advisor/shared";
import type { HealthCoverageModule } from "@insurance-advisor/domain";
import {
  LifeInsuranceCalculator,
  DisabilityInsuranceCalculator,
  CriticalIllnessCalculator,
  HealthModuleAssessor,
  fromHouseholdFixture,
  fromHouseholdFixtureForDisability,
  fromHouseholdFixtureForCriticalIllness,
  fromHouseholdFixtureForHealth,
} from "@insurance-advisor/calculators";

const HEALTH_MODULE_LABELS: Record<HealthCoverageModule, string> = {
  surgeries_israel: "ניתוחים בישראל",
  surgeries_abroad: "ניתוחים בחו״ל",
  transplants: "השתלות",
  special_treatments_abroad: "טיפולים מיוחדים בחו״ל",
  medications_outside_basket: "תרופות מחוץ לסל",
  ambulatory: "אמבולטורי",
  personalized_medicine: "רפואה מותאמת אישית",
};

const HEALTH_NEED_LABELS: Record<string, string> = {
  high: "גבוה",
  medium: "בינוני",
  low: "נמוך",
  not_applicable: "קיים",
};

const REASON_CODE_LABELS: Record<string, string> = {
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
  extraContent?: React.ReactNode;
}) {
  const { title, badges, confidence, reasonCodes, figures, note, missingFacts, trace, extraContent } = props;
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

function HealthModuleCard(props: { assessments: ReturnType<HealthModuleAssessor["assess"]> }) {
  const { assessments } = props;
  return (
    <section className="card">
      <h2>ביטוח בריאות פרטי — לפי מודול</h2>
      <div className="badges">
        <span className={`badge confidence-${assessments.confidence}`}>
          אמינות נתונים: {CONFIDENCE_LABELS[assessments.confidence]}
        </span>
      </div>
      <table className="trace">
        <tbody>
          {assessments.moduleAssessments.map((a) => (
            <tr key={a.module}>
              <td>{HEALTH_MODULE_LABELS[a.module]}</td>
              <td>{a.existing === "unknown" ? "לא ידוע" : a.existing ? "קיים" : "לא קיים"}</td>
              <td>עוצמת צורך: {HEALTH_NEED_LABELS[a.need] ?? a.need}</td>
              <td className="amount">
                {a.reasonCodes.map((code) => (
                  <span className="badge" key={code} style={{ marginInlineStart: 4 }}>
                    {REASON_CODE_LABELS[code] ?? code}
                  </span>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

const lifeCalculator = new LifeInsuranceCalculator();
const disabilityCalculator = new DisabilityInsuranceCalculator();
const criticalIllnessCalculator = new CriticalIllnessCalculator();
const healthModuleAssessor = new HealthModuleAssessor();
const CI_HEADLINE_DURATION_MONTHS = 6;
// Fixed "now" so the preview is deterministic across runs/reviewers, matching the fixtures' own reference date.
const NOW = new Date("2026-09-07T00:00:00.000Z");

export default function PreviewPage() {
  return (
    <main>
      <h1>תצוגה מקדימה — מנוע צרכי ביטוח</h1>
      <p className="subtitle">
        Milestone 3-4 (PRD §12-15, §48) · מריץ את מחשבוני ביטוח חיים, אבדן כושר עבודה, מחלות קשות ואת מנוע הערכת
        מודולי הבריאות על 5 פרופילי בדיקה ישירות מהקוד — ללא שאלון, ללא API, ללא אחסון.
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

        const ciInput = fromHouseholdFixtureForCriticalIllness(fixture);
        const ciScenarios = criticalIllnessCalculator.calculateScenarios(ciInput, STARTER_ENGINE_CONFIG);
        const ciHeadline = ciScenarios.find((s) => s.recoveryDurationMonths === CI_HEADLINE_DURATION_MONTHS) ?? ciScenarios[0];
        if (!ciHeadline) {
          return null; // unreachable — RECOVERY_DURATION_OPTIONS_MONTHS is never empty
        }

        const healthInput = fromHouseholdFixtureForHealth(fixture);
        const health = healthModuleAssessor.assess(healthInput, STARTER_ENGINE_CONFIG);

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

            <ResultCard
              title="ביטוח מחלות קשות"
              badges={[`תרחיש מוצג: התאוששות ${ciHeadline.recoveryDurationMonths} חודשים`]}
              confidence={ciHeadline.result.confidence}
              reasonCodes={ciHeadline.result.reasonCodes}
              figures={[
                { label: "צורך חד-פעמי (ברוטו)", amountExact: ciHeadline.result.need.toExactString() },
                { label: "כיסוי קיים", amountExact: ciHeadline.result.existingCoverage.toExactString() },
                { label: "פער מומלץ", amountExact: ciHeadline.result.gap.toExactString(), emphasize: true },
              ]}
              missingFacts={ciHeadline.result.missingFacts}
              trace={ciHeadline.trace}
              extraContent={
                <details>
                  <summary>השוואת תרחישי משך התאוששות (PRD §14)</summary>
                  <table className="trace">
                    <tbody>
                      {ciScenarios.map((s) => (
                        <tr key={s.recoveryDurationMonths}>
                          <td>{s.recoveryDurationMonths} חודשים</td>
                          <td className="amount">{formatExact(s.result.gap.toExactString())}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              }
            />

            <HealthModuleCard assessments={health} />
          </div>
        );
      })}
    </main>
  );
}
