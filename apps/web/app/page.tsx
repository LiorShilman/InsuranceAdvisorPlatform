import { STARTER_ENGINE_CONFIG } from "@insurance-advisor/config";
import { ALL_HOUSEHOLD_FIXTURES } from "@insurance-advisor/test-fixtures";
import { Money, type CalculationTrace } from "@insurance-advisor/shared";
import type { HealthCoverageModule, InsuranceCategory } from "@insurance-advisor/domain";
import type { HouseholdFixture } from "@insurance-advisor/test-fixtures";
import {
  LifeInsuranceCalculator,
  DisabilityInsuranceCalculator,
  CriticalIllnessCalculator,
  HealthModuleAssessor,
  LongTermCareCalculator,
  CoverageDeduplicationEngine,
  PriorityEngine,
  RecommendationBuilder,
  ReviewScheduler,
  type DeduplicationResult,
  fromHouseholdFixture,
  fromHouseholdFixtureForDisability,
  fromHouseholdFixtureForCriticalIllness,
  fromHouseholdFixtureForHealth,
  fromHouseholdFixtureForLongTermCare,
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
  LTC_MONTHLY_GAP: "פער חודשי בעלות הטיפול הסיעודי",
  LTC_SELF_FUNDING_CAPACITY_HIGH: "יכולת מימון עצמי גבוהה",
};

const CONFIDENCE_LABELS: Record<string, string> = {
  high: "גבוהה",
  medium: "בינונית",
  low: "נמוכה",
};

const PRIORITY_BAND_LABELS: Record<string, string> = {
  CRITICAL: "קריטי",
  HIGH: "גבוה",
  MEDIUM: "בינוני",
  LOW: "נמוך",
  INFORMATIONAL: "מידע בלבד",
};

function priorityBadgeText(band: string, score: number): string {
  return `עדיפות: ${PRIORITY_BAND_LABELS[band] ?? band} (${score})`;
}

const STATUS_LABELS: Record<string, string> = {
  recommended: "מומלץ",
  consider: "לשקול",
  not_needed: "לא נדרש",
  review_existing: "לבדוק כיסוי קיים",
  manual_review: "נדרשת בדיקה ידנית",
};

/** Does any flagged duplicate pair for this fixture involve a coverage of the given category? */
function categoryHasDuplicateFlag(dedup: DeduplicationResult, fixture: HouseholdFixture, category: InsuranceCategory): boolean {
  const idsInCategory = new Set(fixture.coverages.filter((c) => c.category === category).map((c) => c.id));
  return dedup.flags.some((f) => idsInCategory.has(f.coverageIdA) || idsInCategory.has(f.coverageIdB));
}

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
const longTermCareCalculator = new LongTermCareCalculator();
const deduplicationEngine = new CoverageDeduplicationEngine();
const priorityEngine = new PriorityEngine();
const recommendationBuilder = new RecommendationBuilder();
const reviewScheduler = new ReviewScheduler();
const CI_HEADLINE_DURATION_MONTHS = 6;
const LTC_HEADLINE_DURATION_YEARS = 3;
// Fixed "now" so the preview is deterministic across runs/reviewers, matching the fixtures' own reference date.
const NOW = new Date("2026-09-07T00:00:00.000Z");

export default function PreviewPage() {
  return (
    <main>
      <h1>תצוגה מקדימה — מנוע צרכי ביטוח</h1>
      <p className="subtitle">
        Milestone 3-5 (PRD §12-22 בחלקן, §48) · מחשבוני ביטוח חיים / אבדן כושר עבודה / מחלות קשות / סיעוד, מנוע הערכת
        מודולי הבריאות, בדיקת כפילויות, מנוע עדיפויות (§19), הרכבת אובייקט המלצה (§21), ותאריך בדיקה הבא (§22, התג
        הכחול) — על 5 פרופילי בדיקה ישירות מהקוד, ללא שאלון, ללא API, ללא אחסון.
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

        const ltcInput = fromHouseholdFixtureForLongTermCare(fixture);
        const ltcScenarios = longTermCareCalculator.calculateScenarios(ltcInput, STARTER_ENGINE_CONFIG);
        const ltcHeadline = ltcScenarios.find((s) => s.expectedDurationYears === LTC_HEADLINE_DURATION_YEARS) ?? ltcScenarios[0];
        if (!ltcHeadline) {
          return null; // unreachable — LTC_DURATION_SCENARIOS_YEARS is never empty
        }

        const dedup = deduplicationEngine.detect(fixture.coverages, STARTER_ENGINE_CONFIG);

        const hasDependents = lifeInput.dependentCount > 0;

        const lifePriority = priorityEngine.score(
          {
            category: "life",
            ...PriorityEngine.gapRatioAndCoverageAdequacy(life.result.grossNeed.toNumber(), life.result.availableResources.toNumber()),
            hasDependents,
            duplicateFlagged: categoryHasDuplicateFlag(dedup, fixture, "life"),
          },
          STARTER_ENGINE_CONFIG,
        );
        const disabilityPriority = priorityEngine.score(
          {
            category: "disability",
            ...PriorityEngine.gapRatioAndCoverageAdequacy(
              disability.result.requiredMonthlyIncome.toNumber(),
              disability.result.existingNetExpectedDisabilityIncome.toNumber(),
            ),
            hasDependents,
            duplicateFlagged: categoryHasDuplicateFlag(dedup, fixture, "disability"),
          },
          STARTER_ENGINE_CONFIG,
        );
        const ciPriority = priorityEngine.score(
          {
            category: "critical_illness",
            ...PriorityEngine.gapRatioAndCoverageAdequacy(ciHeadline.result.need.toNumber(), ciHeadline.result.existingCoverage.toNumber()),
            hasDependents,
            duplicateFlagged: categoryHasDuplicateFlag(dedup, fixture, "critical_illness"),
          },
          STARTER_ENGINE_CONFIG,
        );
        // LTC's capitalNeed is already net of benefits/self-funding (no separate raw need/existing pair to compare) —
        // treated as a simple has-gap/no-gap signal rather than a proportional ratio. See docs/DECISIONS.md.
        const ltcPriority = priorityEngine.score(
          {
            category: "ltc",
            ...PriorityEngine.gapRatioAndCoverageAdequacy(ltcHeadline.result.capitalNeed.toNumber(), 0),
            hasDependents,
            duplicateFlagged: categoryHasDuplicateFlag(dedup, fixture, "ltc"),
          },
          STARTER_ENGINE_CONFIG,
        );

        const lifeRecommendation = recommendationBuilder.build(
          {
            clientProfileId: fixture.clientProfile.id,
            category: "life",
            title: "ביטוח חיים",
            needAmount: life.result.grossNeed,
            existingAmount: life.result.availableResources,
            gapAmount: life.result.gap,
            horizon: { type: "years", value: life.result.horizonYears },
            reasonCodes: life.result.reasonCodes,
            reviewTriggers: life.result.reviewTriggers,
            missingFacts: life.result.missingFacts,
            assumptions: life.result.assumptions,
            confidence: life.result.confidence,
            calculationTraceId: life.trace.id,
            priority: lifePriority,
          },
          STARTER_ENGINE_CONFIG,
        );

        const disabilityRecommendation = recommendationBuilder.build(
          {
            clientProfileId: fixture.clientProfile.id,
            category: "disability",
            title: "ביטוח אבדן כושר עבודה",
            needAmount: disability.result.requiredMonthlyIncome,
            existingAmount: disability.result.existingNetExpectedDisabilityIncome,
            gapAmount: disability.result.monthlyGap,
            monthlyBenefitTarget: disability.result.monthlyGap,
            horizon:
              disability.result.recommendedDurationYears !== undefined
                ? { type: "years", value: disability.result.recommendedDurationYears }
                : undefined,
            reasonCodes: disability.result.reasonCodes,
            reviewTriggers: disability.result.reviewTriggers,
            missingFacts: disability.result.missingFacts,
            assumptions: disability.result.assumptions,
            confidence: disability.result.confidence,
            calculationTraceId: disability.trace.id,
            priority: disabilityPriority,
          },
          STARTER_ENGINE_CONFIG,
        );

        const ciRecommendation = recommendationBuilder.build(
          {
            clientProfileId: fixture.clientProfile.id,
            category: "critical_illness",
            title: "ביטוח מחלות קשות",
            needAmount: ciHeadline.result.need,
            existingAmount: ciHeadline.result.existingCoverage,
            gapAmount: ciHeadline.result.gap,
            reasonCodes: ciHeadline.result.reasonCodes,
            reviewTriggers: ciHeadline.result.reviewTriggers,
            missingFacts: ciHeadline.result.missingFacts,
            assumptions: ciHeadline.result.assumptions,
            confidence: ciHeadline.result.confidence,
            calculationTraceId: ciHeadline.trace.id,
            priority: ciPriority,
          },
          STARTER_ENGINE_CONFIG,
        );

        const ltcRecommendation = recommendationBuilder.build(
          {
            clientProfileId: fixture.clientProfile.id,
            category: "ltc",
            title: "ביטוח סיעודי",
            needAmount: ltcHeadline.result.capitalNeed,
            existingAmount: Money.zero(),
            gapAmount: ltcHeadline.result.capitalNeed,
            horizon: { type: "years", value: ltcHeadline.expectedDurationYears },
            reasonCodes: ltcHeadline.result.reasonCodes,
            reviewTriggers: ltcHeadline.result.reviewTriggers,
            missingFacts: ltcHeadline.result.missingFacts,
            assumptions: ltcHeadline.result.assumptions,
            confidence: ltcHeadline.result.confidence,
            calculationTraceId: ltcHeadline.trace.id,
            priority: ltcPriority,
          },
          STARTER_ENGINE_CONFIG,
        );

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
              priority={lifePriority}
              status={lifeRecommendation.status}
              rationale={lifeRecommendation.rationale}
              nextReviewDate={reviewScheduler.nextReviewDate(lifeRecommendation, NOW)}
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
              priority={disabilityPriority}
              status={disabilityRecommendation.status}
              rationale={disabilityRecommendation.rationale}
              nextReviewDate={reviewScheduler.nextReviewDate(disabilityRecommendation, NOW)}
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
              priority={ciPriority}
              status={ciRecommendation.status}
              rationale={ciRecommendation.rationale}
              nextReviewDate={reviewScheduler.nextReviewDate(ciRecommendation, NOW)}
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

            <ResultCard
              title="ביטוח סיעודי"
              badges={[`תרחיש מוצג: תוחלת ${ltcHeadline.expectedDurationYears} שנים`]}
              confidence={ltcHeadline.result.confidence}
              priority={ltcPriority}
              status={ltcRecommendation.status}
              rationale={ltcRecommendation.rationale}
              nextReviewDate={reviewScheduler.nextReviewDate(ltcRecommendation, NOW)}
              reasonCodes={ltcHeadline.result.reasonCodes}
              figures={[
                { label: "פער חודשי בעלות טיפול", amountExact: ltcHeadline.result.monthlyGap.toExactString() },
                { label: "הון נדרש (מהוון)", amountExact: ltcHeadline.result.capitalNeed.toExactString(), emphasize: true },
              ]}
              missingFacts={ltcHeadline.result.missingFacts}
              trace={ltcHeadline.trace}
              extraContent={
                <details>
                  <summary>השוואת תרחישי תוחלת טיפול (PRD §16)</summary>
                  <table className="trace">
                    <tbody>
                      {ltcScenarios.map((s) => (
                        <tr key={s.expectedDurationYears}>
                          <td>{s.expectedDurationYears} שנים</td>
                          <td className="amount">{formatExact(s.result.capitalNeed.toExactString())}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              }
            />

            <section className="card">
              <h2>בדיקת כפילות כיסויים קיימים</h2>
              {dedup.flags.length === 0 ? (
                <p style={{ fontSize: "0.9rem", color: "var(--muted)" }}>לא נמצאה חפיפה חשודה בין הכיסויים הקיימים.</p>
              ) : (
                dedup.flags.map((f) => (
                  <div key={`${f.coverageIdA}-${f.coverageIdB}`} className="missing" style={{ marginBottom: 6 }}>
                    {f.message} (ניקוד חפיפה: {f.duplicateScore}, פוליסות {f.coverageIdA} ↔ {f.coverageIdB})
                  </div>
                ))
              )}
            </section>
          </div>
        );
      })}
    </main>
  );
}
