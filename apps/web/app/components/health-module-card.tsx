import type { HealthCoverageModule } from "@insurance-advisor/domain";
import type { HealthModuleAssessor } from "@insurance-advisor/calculators";
import { CONFIDENCE_LABELS, REASON_CODE_LABELS } from "./result-card";

export const HEALTH_MODULE_LABELS: Record<HealthCoverageModule, string> = {
  surgeries_israel: "ניתוחים בישראל",
  surgeries_abroad: "ניתוחים בחו״ל",
  transplants: "השתלות",
  special_treatments_abroad: "טיפולים מיוחדים בחו״ל",
  medications_outside_basket: "תרופות מחוץ לסל",
  ambulatory: "אמבולטורי",
  personalized_medicine: "רפואה מותאמת אישית",
};

export const HEALTH_NEED_LABELS: Record<string, string> = {
  high: "גבוה",
  medium: "בינוני",
  low: "נמוך",
  not_applicable: "קיים",
};

export function HealthModuleCard(props: { assessments: ReturnType<HealthModuleAssessor["assess"]> }) {
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
