"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Fact } from "@insurance-advisor/shared";
import { STARTER_ENGINE_CONFIG } from "@insurance-advisor/config";
import { STARTER_QUESTIONS } from "@insurance-advisor/questionnaire";
import { ResultCard, CATEGORY_ICONS, formatExact, PRIORITY_BAND_LABELS } from "../components/result-card";
import { HealthModuleCard } from "../components/health-module-card";
import { computeAllRecommendations, type ComputedRecommendations } from "../../lib/compute-recommendations";
import { computeDeduplication, type ApiCoverage } from "../../lib/compute-dedup";
import { singleSelectLabelForFact } from "../../lib/answer-labels";

/**
 * The PRD §39 report structure, built from the SAME persisted Facts the
 * questionnaire writes — this is a real report over real (if sparse)
 * data, not a mockup. Sections the live flow genuinely can't fill yet
 * (§20 budget, §18 overlaps — see body) say so explicitly rather than
 * being silently omitted, same "unknown stays unknown" discipline as
 * everywhere else in this codebase.
 *
 * "Export" is a browser print-to-PDF via the print button below (see
 * globals.css's @media print rules) rather than a PDF-generation library
 * dependency — good enough for a first report renderer.
 */

const FACT_LABELS = new Map<string, string>(
  STARTER_QUESTIONS.flatMap((q) => q.factsProduced.map((key): [string, string] => [key, q.text])),
);

/** `factKey` is optional only for the one call site (§13's missing-facts list) that passes a fact *key*, not a value — see its own translation below instead. */
function formatFactValue(value: unknown, factKey?: string): string {
  if (typeof value === "number") return new Intl.NumberFormat("he-IL").format(value);
  if (typeof value === "boolean") return value ? "כן" : "לא";
  if (factKey) {
    const label = singleSelectLabelForFact(factKey, value);
    if (label) return label;
  }
  return String(value);
}

const CATEGORY_LABELS: Record<string, string> = {
  life: "ביטוח חיים",
  disability: "ביטוח אבדן כושר עבודה",
  critical_illness: "ביטוח מחלות קשות",
  ltc: "ביטוח סיעודי",
};

export default function ReportPage() {
  const [clientProfileId, setClientProfileId] = useState<string | null>(null);
  const [facts, setFacts] = useState<Fact[] | null>(null);
  const [coverages, setCoverages] = useState<ApiCoverage[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const profileRes = await fetch("/api/profile");
      const { clientProfileId: id } = (await profileRes.json()) as { clientProfileId: string };
      if (cancelled) return;
      setClientProfileId(id);

      const [factsRes, coveragesRes] = await Promise.all([
        fetch(`/api/facts?clientProfileId=${id}`),
        fetch(`/api/coverages?clientProfileId=${id}`),
      ]);
      const { facts: savedFacts } = (await factsRes.json()) as { facts: Fact[] };
      const { coverages: savedCoverages } = (await coveragesRes.json()) as { coverages: ApiCoverage[] };
      if (cancelled) return;
      setFacts(savedFacts);
      setCoverages(savedCoverages);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const computed = useMemo<ComputedRecommendations | null>(() => {
    if (!facts || !clientProfileId) return null;
    return computeAllRecommendations(facts, clientProfileId, new Date());
  }, [facts, clientProfileId]);

  if (!facts || !computed || !coverages) {
    return (
      <main>
        <p>טוען דוח...</p>
      </main>
    );
  }

  const dedup = computeDeduplication(coverages);

  const categories = [
    { key: "life", ...computed.life },
    { key: "disability", ...computed.disability },
    { key: "critical_illness", ...computed.ci },
    { key: "ltc", ...computed.ltc },
  ] as const;

  const sortedByPriority = [...categories].sort((a, b) => b.priority.score - a.priority.score);
  const allMissingFacts = Array.from(new Set(categories.flatMap((c) => c.result.missingFacts)));
  const allAssumptions = categories.flatMap((c) => c.result.assumptions);
  const uniqueAssumptions = Array.from(new Map(allAssumptions.map((a) => [a.key + a.source, a])).values());

  return (
    <main>
      <div className="no-print">
        <h1>דוח צרכי ביטוח מלא</h1>
        <p className="subtitle">PRD §39 · נבנה מהנתונים השמורים האמיתיים שלך (PostgreSQL), לא ממוקאפ.</p>
        <p>
          <Link href="/questionnaire" style={{ color: "var(--brand)" }}>
            ← חזרה לשאלון
          </Link>
          {"   "}
          <button
            type="button"
            className="btn btn-primary btn-sm"
            style={{ marginInlineStart: 8 }}
            onClick={() => {
              // <details> content is only visible when [open] — CSS alone can't reveal it for
              // print, so force every trace open right before printing.
              document.querySelectorAll("details").forEach((el) => el.setAttribute("open", ""));
              window.print();
            }}
          >
            🖨 הדפס / ייצוא ל-PDF
          </button>
        </p>
      </div>

      <div className="banner">
        {
          "זה ניתוח מדיד מסייע לצרכים המפורטים ואינה מהווה תחליף/שיווק עם בעל רישיון מתאים שיאשר לך המלצה סופית. (PRD §4.3, Educational mode)"
        }
      </div>

      {/* 1. Executive summary */}
      <section className="card">
        <h2>1. תקציר מנהלים</h2>
        <p>
          נבדקו {categories.length} קטגוריות ביטוח. {sortedByPriority.filter((c) => c.recommendation.status === "recommended").length} מומלצות
          לפעולה, {sortedByPriority.filter((c) => c.recommendation.status === "consider").length} לשקילה,{" "}
          {sortedByPriority.filter((c) => c.recommendation.status === "manual_review").length} דורשות בדיקה ידנית עקב נתונים חסרים.
        </p>
      </section>

      {/* 2. Data supplied */}
      <section className="card">
        <h2>2. נתונים שסופקו</h2>
        {facts.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>לא סופקו נתונים עדיין.</p>
        ) : (
          <table className="trace">
            <tbody>
              {facts.map((f) => (
                <tr key={f.key}>
                  <td>{FACT_LABELS.get(f.key) ?? f.key}</td>
                  <td className="amount">{formatFactValue(f.value, f.key)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* 3. Assumptions */}
      <section className="card">
        <h2>3. הנחות</h2>
        {uniqueAssumptions.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>לא הופעלו הנחות ברירת מחדל — כל הנתונים הנדרשים סופקו.</p>
        ) : (
          <ul>
            {uniqueAssumptions.map((a) => (
              <li key={a.key + a.source}>{a.description}</li>
            ))}
          </ul>
        )}
      </section>

      {/* 4. Household risk map */}
      <section className="card">
        <h2>4. מפת סיכון משק הבית</h2>
        <p>
          תלויים כלכליים: {computed.hasDependents ? "כן" : "לא ידוע/אין"}. סטטוס משפחתי:{" "}
          {(() => {
            const maritalStatus = facts.find((f) => f.key === "household.maritalStatus")?.value;
            return maritalStatus === undefined ? "לא סופק" : formatFactValue(maritalStatus, "household.maritalStatus");
          })()}
          .
        </p>
      </section>

      {/* 5-7. Existing coverage, calculated needs, gaps */}
      <section className="card">
        <h2>5-7. כיסוי קיים, צורך מחושב ופער — לפי קטגוריה</h2>
        <table className="trace">
          <thead>
            <tr>
              <th style={{ textAlign: "right" }}>קטגוריה</th>
              <th style={{ textAlign: "right" }}>צורך</th>
              <th style={{ textAlign: "right" }}>כיסוי קיים</th>
              <th style={{ textAlign: "right" }}>פער</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => {
              const need = "grossNeed" in c.result ? c.result.grossNeed : "requiredMonthlyIncome" in c.result ? c.result.requiredMonthlyIncome : "need" in c.result ? c.result.need : c.result.capitalNeed;
              const existing = "availableResources" in c.result ? c.result.availableResources : "existingNetExpectedDisabilityIncome" in c.result ? c.result.existingNetExpectedDisabilityIncome : "existingCoverage" in c.result ? c.result.existingCoverage : undefined;
              const gap = "gap" in c.result ? c.result.gap : c.result.monthlyGap;
              return (
                <tr key={c.key}>
                  <td>{CATEGORY_LABELS[c.key]}</td>
                  <td className="amount">{formatExact(need.toExactString())}</td>
                  <td className="amount">{existing ? formatExact(existing.toExactString()) : "—"}</td>
                  <td className="amount">
                    <strong>{formatExact(gap.toExactString())}</strong>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <HealthModuleCard assessments={computed.health} />
      </section>

      {/* 8. Recommendations (full cards) */}
      <section>
        <h2>8. המלצות מפורטות</h2>
        <ResultCard
          title="ביטוח חיים"
          icon={CATEGORY_ICONS.life}
          coverageRatio={computed.life.coverageRatio}
          badges={[`טווח הגנה: ${computed.life.result.horizonYears} שנים`]}
          confidence={computed.life.result.confidence}
          priority={computed.life.priority}
          status={computed.life.recommendation.status}
          rationale={computed.life.recommendation.rationale}
          nextReviewDate={computed.life.nextReviewDate}
          reasonCodes={computed.life.result.reasonCodes}
          figures={[
            { label: "צורך חישובי (ברוטו)", amountExact: computed.life.result.grossNeed.toExactString() },
            { label: "כיסוי ומשאבים קיימים", amountExact: computed.life.result.availableResources.toExactString() },
            { label: "פער מומלץ לכיסוי", amountExact: computed.life.result.gap.toExactString(), emphasize: true },
          ]}
          missingFacts={computed.life.result.missingFacts}
          trace={computed.life.trace}
        />
        <ResultCard
          title="ביטוח אבדן כושר עבודה"
          icon={CATEGORY_ICONS.disability}
          coverageRatio={computed.disability.coverageRatio}
          badges={[]}
          confidence={computed.disability.result.confidence}
          priority={computed.disability.priority}
          status={computed.disability.recommendation.status}
          rationale={computed.disability.recommendation.rationale}
          nextReviewDate={computed.disability.nextReviewDate}
          reasonCodes={computed.disability.result.reasonCodes}
          figures={[
            { label: "הכנסה חודשית נדרשת", amountExact: computed.disability.result.requiredMonthlyIncome.toExactString() },
            { label: "כיסוי קיים (נטו, חודשי)", amountExact: computed.disability.result.existingNetExpectedDisabilityIncome.toExactString() },
            { label: "פער חודשי מומלץ", amountExact: computed.disability.result.monthlyGap.toExactString(), emphasize: true },
          ]}
          missingFacts={computed.disability.result.missingFacts}
          trace={computed.disability.trace}
        />
        <ResultCard
          title="ביטוח מחלות קשות"
          icon={CATEGORY_ICONS.critical_illness}
          coverageRatio={computed.ci.coverageRatio}
          badges={["תרחיש: 6 חודשים"]}
          confidence={computed.ci.result.confidence}
          priority={computed.ci.priority}
          status={computed.ci.recommendation.status}
          rationale={computed.ci.recommendation.rationale}
          nextReviewDate={computed.ci.nextReviewDate}
          reasonCodes={computed.ci.result.reasonCodes}
          figures={[
            { label: "צורך חד-פעמי", amountExact: computed.ci.result.need.toExactString() },
            { label: "כיסוי קיים", amountExact: computed.ci.result.existingCoverage.toExactString() },
            { label: "פער מומלץ", amountExact: computed.ci.result.gap.toExactString(), emphasize: true },
          ]}
          missingFacts={computed.ci.result.missingFacts}
          trace={computed.ci.trace}
        />
        <ResultCard
          title="ביטוח סיעודי"
          icon={CATEGORY_ICONS.ltc}
          coverageRatio={computed.ltc.coverageRatio}
          badges={["תרחיש: תוחלת 3 שנים"]}
          confidence={computed.ltc.result.confidence}
          priority={computed.ltc.priority}
          status={computed.ltc.recommendation.status}
          rationale={computed.ltc.recommendation.rationale}
          nextReviewDate={computed.ltc.nextReviewDate}
          reasonCodes={computed.ltc.result.reasonCodes}
          figures={[
            { label: "פער חודשי", amountExact: computed.ltc.result.monthlyGap.toExactString() },
            { label: "הון נדרש", amountExact: computed.ltc.result.capitalNeed.toExactString(), emphasize: true },
          ]}
          missingFacts={computed.ltc.result.missingFacts}
          trace={computed.ltc.trace}
        />
      </section>

      {/* 9. Priority order */}
      <section className="card">
        <h2>9. סדר עדיפויות</h2>
        <table className="trace">
          <tbody>
            {sortedByPriority.map((c, i) => (
              <tr key={c.key}>
                <td>
                  {i + 1}. {CATEGORY_LABELS[c.key]}
                </td>
                <td>{PRIORITY_BAND_LABELS[c.priority.band] ?? c.priority.band}</td>
                <td className="amount">{c.priority.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* 10. Budget-constrained alternative */}
      <section className="card">
        <h2>10. חלופה מוגבלת תקציב (ביטוח חיים)</h2>
        {computed.life.affordability.budgetSupportedCoverage ? (
          <>
            <table className="trace">
              <tbody>
                <tr>
                  <td>צורך מחושב (ללא הגבלת תקציב)</td>
                  <td className="amount">{formatExact(computed.life.affordability.calculatedNeed.toExactString())}</td>
                </tr>
                <tr>
                  <td>כיסוי נתמך תקציבית</td>
                  <td className="amount">{formatExact(computed.life.affordability.budgetSupportedCoverage.toExactString())}</td>
                </tr>
                <tr>
                  <td>
                    <strong>פער שנותר לא מבוטח</strong>
                  </td>
                  <td className="amount">
                    <strong>{formatExact(computed.life.affordability.remainingUninsuredGap.toExactString())}</strong>
                  </td>
                </tr>
              </tbody>
            </table>
            <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
              הצורך המחושב עצמו אינו מוקטן על ידי התקציב (כלל מפורש ב-PRD §20) — זו רק אפשרות נוספת לצדו. יחס
              ההמרה תקציב→כיסוי אינו תמחור ביטוחי אמיתי (ראו docs/ASSUMPTIONS.md).
            </p>
          </>
        ) : (
          <p style={{ color: "var(--muted)" }}>
            לא צוין תקציב חודשי בשאלון — שכבת ה-Budget/Affordability (§20) קיימת ונבדקה (
            <code>BudgetAffordabilityEngine</code>) ומוצגת כאן ברגע שתענה על השאלה המתאימה בשאלון.
          </p>
        )}
      </section>

      {/* 11. Possible overlaps */}
      <section className="card">
        <h2>11. חפיפות אפשריות</h2>
        {coverages.length < 2 ? (
          <p style={{ color: "var(--muted)" }}>
            הוזנו {coverages.length} פוליסות קיימות — נדרשות לפחות 2 כדי לבדוק חפיפה ביניהן. הזן פוליסות בעמוד{" "}
            <Link href="/coverages" style={{ color: "var(--brand)" }}>
              פוליסות קיימות
            </Link>
            .
          </p>
        ) : dedup.flags.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>לא נמצאה חפיפה חשודה בין {coverages.length} הפוליסות שהוזנו.</p>
        ) : (
          dedup.flags.map((f) => (
            <div key={`${f.coverageIdA}-${f.coverageIdB}`} className="missing" style={{ marginBottom: 6 }}>
              {f.message} (ניקוד חפיפה: {f.duplicateScore})
            </div>
          ))
        )}
      </section>

      {/* 12. Holding/review horizon */}
      <section className="card">
        <h2>12. אופק החזקה/בדיקה</h2>
        <table className="trace">
          <tbody>
            {categories.map((c) => (
              <tr key={c.key}>
                <td>{CATEGORY_LABELS[c.key]}</td>
                <td>בדיקה הבאה: {c.nextReviewDate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* 13. Unknown data */}
      <section className="card">
        <h2>13. נתונים לא ידועים</h2>
        {allMissingFacts.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>אין נתונים חסרים מהותיים.</p>
        ) : (
          <ul>
            {allMissingFacts.map((key) => (
              <li key={key}>{FACT_LABELS.get(key) ?? key}</li>
            ))}
          </ul>
        )}
      </section>

      {/* 14. Methodology */}
      <section className="card">
        <h2>14. מתודולוגיית חישוב</h2>
        <p>
          כל מספר בדוח זה מגיע ממחשבון דטרמיניסטי (לא מ-LLM, PRD §29) עם שקיפות חישוב מלאה — לחץ על "איך חושב
          הפער?" בכל כרטיס בסעיף 8 לפירוט השורות והנוסחאות המדויקות.
        </p>
      </section>

      {/* 15. Disclosures */}
      <section className="card">
        <h2>15. גילויים</h2>
        <p>
          זהו מסמך במצב חינוכי/MVP (PRD §4.3) — אינו ייעוץ פנסיוני/ביטוחי מוסמך. אין להסתמך עליו לצורך קבלת החלטת
          רכישה ללא בעל רישיון מתאים.
        </p>
      </section>

      {/* 16. Engine version + timestamp */}
      <section className="card">
        <h2>16. גרסת מנוע ותאריך</h2>
        <p>
          גרסת קונפיגורציה: {STARTER_ENGINE_CONFIG.version} (בתוקף מ-{STARTER_ENGINE_CONFIG.effectiveFrom}) · דוח
          הופק: {new Date().toISOString()}
        </p>
      </section>
    </main>
  );
}
