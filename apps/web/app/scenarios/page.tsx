"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Fact } from "@insurance-advisor/shared";
import type { ComputedRecommendations } from "../../lib/compute-recommendations";
import { SCENARIO_PRESETS, computeAllScenarios, type ScenarioKey } from "../../lib/scenario-simulator";
import { RECOMMENDATION_CATEGORY_LABELS, FACT_LABELS } from "../../lib/answer-labels";
import { formatExact, CATEGORY_ICONS } from "../components/result-card";

/**
 * PRD §23 Scenario Simulator — see scenario-simulator.ts for the exact,
 * honestly-documented scope (2 of the PRD's 9 listed knobs, 4 fixed
 * presets rather than live sliders over all 9).
 */

type Category = { key: "life" | "disability" | "critical_illness" | "ltc"; icon: string };
const CATEGORIES: Category[] = [
  { key: "life", icon: CATEGORY_ICONS.life },
  { key: "disability", icon: CATEGORY_ICONS.disability },
  { key: "critical_illness", icon: CATEGORY_ICONS.critical_illness },
  { key: "ltc", icon: CATEGORY_ICONS.ltc },
];

function gapFor(computed: ComputedRecommendations, category: Category["key"]) {
  if (category === "life") return computed.life.result.gap;
  if (category === "disability") return computed.disability.result.monthlyGap;
  if (category === "critical_illness") return computed.ci.result.gap;
  return computed.ltc.result.capitalNeed;
}

export default function ScenariosPage() {
  const [facts, setFacts] = useState<Fact[] | null>(null);
  const [clientProfileId, setClientProfileId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const profileRes = await fetch("/api/profile");
      const { clientProfileId: id } = (await profileRes.json()) as { clientProfileId: string };
      if (cancelled) return;
      setClientProfileId(id);

      const factsRes = await fetch(`/api/facts?clientProfileId=${id}`);
      const { facts: savedFacts } = (await factsRes.json()) as { facts: Fact[] };
      if (cancelled) return;
      setFacts(savedFacts);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const scenarios = useMemo(() => {
    if (!facts || !clientProfileId) return null;
    return computeAllScenarios(facts, clientProfileId, new Date());
  }, [facts, clientProfileId]);

  if (!facts || !scenarios) {
    return (
      <main>
        <p>טוען תרחישים...</p>
      </main>
    );
  }

  if (facts.length === 0) {
    return (
      <main>
        <h1>סימולטור תרחישים</h1>
        <p className="subtitle">
          עדיין לא סופקו נתונים — יש להשלים קודם את{" "}
          <Link href="/questionnaire" style={{ color: "var(--brand)" }}>
            השאלון האינטראקטיבי
          </Link>
          .
        </p>
      </main>
    );
  }

  return (
    <main>
      <h1>סימולטור תרחישים</h1>
      <p className="subtitle">
        PRD §23 · השוואה חיה בין 4 תרחישים על סמך הנתונים האמיתיים שלך — כל תרחיש מפעיל מחדש את אותם מנועי חישוב
        דטרמיניסטיים (PRD §29, ללא LLM) תחת שתי הנחות שונות: רמת הוצאות רצויה ("lifestyle percentage") וריבית היוון.
        אף תרחיש אינו "נעול" — כולם מוצגים זה לצד זה.
      </p>

      <div className="banner">
        {
          "זה ניתוח מדיד מסייע לצרכים המפורטים ואינה מהווה תחליף/שיווק עם בעל רישיון מתאים שיאשר לך המלצה סופית. (PRD §4.3, Educational mode)"
        }
      </div>

      <section className="card">
        <h2>השוואת פערים לפי תרחיש</h2>
        <div style={{ overflowX: "auto" }}>
          <table className="trace">
            <thead>
              <tr>
                <th style={{ textAlign: "right" }}>קטגוריה</th>
                {SCENARIO_PRESETS.map((preset) => (
                  <th key={preset.key} style={{ textAlign: "right" }}>
                    {preset.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CATEGORIES.map((category) => (
                <tr key={category.key}>
                  <td>
                    <span aria-hidden="true">{category.icon}</span> {RECOMMENDATION_CATEGORY_LABELS[category.key]}
                  </td>
                  {SCENARIO_PRESETS.map((preset) => (
                    <td key={preset.key} className="amount">
                      {formatExact(gapFor(scenarios[preset.key as ScenarioKey], category.key).toExactString())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(() => {
          // Every scenario shares the same missingFacts (scaling/discount-rate
          // don't change which facts exist) — "current" is enough to represent all 4.
          const allMissing = Array.from(
            new Set([
              ...scenarios.current.life.result.missingFacts,
              ...scenarios.current.disability.result.missingFacts,
              ...scenarios.current.ci.result.missingFacts,
              ...scenarios.current.ltc.result.missingFacts,
            ]),
          );
          if (allMissing.length === 0) return null;
          return (
            <p className="missing">
              נתונים חסרים שמשפיעים על התרחישים למעלה (חלק מהמספרים עלולים להיות 0 עד שישלימו): {allMissing.map((key) => FACT_LABELS.get(key) ?? key).join(", ")}.
            </p>
          );
        })()}
      </section>

      <section className="card">
        <h2>מה משתנה בכל תרחיש</h2>
        {SCENARIO_PRESETS.map((preset) => (
          <p key={preset.key} style={{ fontSize: "0.9rem" }}>
            <strong>{preset.label}:</strong> {preset.description}
          </p>
        ))}
        <p className="missing">
          הערה: זהו יישום ממוקד של 2 מתוך 9 המשתנים שה-PRD מפרט בסימולטור התרחישים (§23) — רמת הוצאות רצויה וריבית
          היוון — כ-4 תרחישים קבועים, לא כל 9 המשתנים כסליידרים אינטראקטיביים. הרחבה מלאה נשארת כצעד עתידי נפרד.
        </p>
      </section>

      <p>
        <Link href="/report" style={{ color: "var(--brand)" }}>
          → חזרה לדוח המלא
        </Link>
      </p>
    </main>
  );
}
