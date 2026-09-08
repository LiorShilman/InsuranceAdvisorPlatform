"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Money, type Fact } from "@insurance-advisor/shared";
import { STARTER_ENGINE_CONFIG } from "@insurance-advisor/config";
import {
  STARTER_QUESTIONS,
  getNextQuestion,
  completionScore,
  validateAnswer,
  produceFacts,
  type Question,
  type ValidationIssue,
} from "@insurance-advisor/questionnaire";
import {
  LifeInsuranceCalculator,
  DisabilityInsuranceCalculator,
  CriticalIllnessCalculator,
  LongTermCareCalculator,
  HealthModuleAssessor,
  PriorityEngine,
  RecommendationBuilder,
  ReviewScheduler,
  factsToLifeCalculatorInput,
  factsToDisabilityCalculatorInput,
  factsToCriticalIllnessInput,
  factsToLongTermCareInput,
  factsToHealthInput,
} from "@insurance-advisor/calculators";
import { ResultCard, formatExact } from "../components/result-card";
import { HealthModuleCard } from "../components/health-module-card";

/**
 * A REAL interactive flow across all five calculators — no hardcoded
 * fixtures. Answers go through the same `getNextQuestion`/
 * `validateAnswer`/`produceFacts` engine as any future full UI would, and
 * every card below is computed live from what you typed, via the real
 * Facts→calculator adapters (not the `fromHouseholdFixture*` demo ones
 * the main `/` page uses).
 */

const SINGLE_SELECT_OPTIONS: Record<string, Array<{ value: string; label: string }>> = {
  household_marital_status: [
    { value: "single", label: "רווק/ה" },
    { value: "married", label: "נשוי/אה" },
    { value: "divorced", label: "גרוש/ה" },
    { value: "widowed", label: "אלמן/ה" },
    { value: "partnered", label: "ידוע/ה בציבור" },
  ],
};

const HEALTH_MODULE_TRISTATE_OPTIONS = [
  { value: "yes", label: "יש לי" },
  { value: "no", label: "אין לי" },
  { value: "unknown", label: "לא יודע/ת" },
];

function optionsFor(question: Question): Array<{ value: string; label: string }> {
  if (question.id.startsWith("health_module_")) return HEALTH_MODULE_TRISTATE_OPTIONS;
  return SINGLE_SELECT_OPTIONS[question.id] ?? [];
}

const lifeCalculator = new LifeInsuranceCalculator();
const disabilityCalculator = new DisabilityInsuranceCalculator();
const criticalIllnessCalculator = new CriticalIllnessCalculator();
const longTermCareCalculator = new LongTermCareCalculator();
const healthModuleAssessor = new HealthModuleAssessor();
const priorityEngine = new PriorityEngine();
const recommendationBuilder = new RecommendationBuilder();
const reviewScheduler = new ReviewScheduler();

function parseDraft(question: Question, draft: string): unknown {
  if (draft === "") return undefined;
  if (question.answerType === "boolean") return draft === "true";
  if (question.answerType === "number" || question.answerType === "money") {
    const n = Number(draft);
    return Number.isFinite(n) ? n : undefined;
  }
  return draft;
}

function QuestionForm(props: { question: Question; onAnswer: (value: unknown) => void; progress: number }) {
  const { question, onAnswer, progress } = props;
  const [draft, setDraft] = useState("");
  const [issues, setIssues] = useState<ValidationIssue[]>([]);

  function submit() {
    const value = parseDraft(question, draft);
    const result = validateAnswer(question, value);
    setIssues(result);
    if (result.some((i) => i.severity === "error")) return;
    onAnswer(value);
    setDraft("");
    setIssues([]);
  }

  const options = optionsFor(question);

  return (
    <section className="card">
      <div style={{ background: "var(--border)", height: 6, borderRadius: 3, marginBottom: 16, overflow: "hidden" }}>
        <div style={{ background: "var(--accent)", height: "100%", width: `${Math.round(progress * 100)}%`, transition: "width 0.2s" }} />
      </div>

      <h2 style={{ marginTop: 0 }}>{question.text}</h2>
      {question.helpText && <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>{question.helpText}</p>}

      {question.answerType === "boolean" ? (
        <div style={{ display: "flex", gap: 8 }}>
          <button className="badge" style={{ cursor: "pointer", fontSize: "1rem", padding: "8px 20px" }} onClick={() => onAnswer(true)}>
            כן
          </button>
          <button className="badge" style={{ cursor: "pointer", fontSize: "1rem", padding: "8px 20px" }} onClick={() => onAnswer(false)}>
            לא
          </button>
        </div>
      ) : question.answerType === "single_select" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {options.map((opt) => (
            <button
              key={opt.value}
              className="badge"
              style={{ cursor: "pointer", fontSize: "1rem", padding: "8px 16px", textAlign: "right" }}
              onClick={() => onAnswer(opt.value)}
            >
              {opt.label}
            </button>
          ))}
          {question.id.startsWith("health_module_") && (
            <button className="badge" style={{ cursor: "pointer", alignSelf: "flex-start" }} onClick={() => onAnswer(undefined)}>
              דלג
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type={question.answerType === "date" ? "date" : "text"}
            inputMode={question.answerType === "number" || question.answerType === "money" ? "decimal" : undefined}
            className="form-input"
            style={{ flex: 1, padding: 10, fontSize: "1rem", borderRadius: 8 }}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            autoFocus
          />
          <button className="badge priority-HIGH" style={{ cursor: "pointer", fontSize: "1rem", padding: "8px 20px" }} onClick={submit}>
            המשך
          </button>
        </div>
      )}

      {!question.required && question.answerType !== "boolean" && question.answerType !== "single_select" && (
        <p style={{ marginTop: 8 }}>
          <button className="badge" style={{ cursor: "pointer" }} onClick={() => onAnswer(undefined)}>
            דלג (שאלה לא חובה)
          </button>
        </p>
      )}

      {issues.map((issue, i) => (
        <p key={i} className="missing" style={{ color: issue.severity === "error" ? "var(--gap)" : "var(--muted)" }}>
          {issue.message}
        </p>
      ))}
    </section>
  );
}

const FACT_KEY_TO_QUESTION_ID = new Map<string, string>(
  STARTER_QUESTIONS.flatMap((q) => q.factsProduced.map((factKey) => [factKey, q.id] as const)),
);

/** Best-effort: a failed persist shouldn't block the user from continuing the flow client-side. */
function persistFact(clientProfileId: string, fact: Fact): void {
  fetch("/api/facts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientProfileId,
      key: fact.key,
      value: fact.value,
      source: fact.source,
      confidence: fact.confidence,
      verified: fact.verified,
    }),
  }).catch(() => {
    // A real product would surface/retry this (PRD §34: no silent data loss). Logged, not hidden.
    console.error(`Failed to persist fact ${fact.key} — it only exists client-side until the next successful save.`);
  });
}

export default function QuestionnairePage() {
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [clientProfileId, setClientProfileId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Real persistence (PRD §55: "no recommendation loss on page refresh") — backed by the
  // actual Postgres schema (prisma/schema.prisma), not browser-only state. One demo profile
  // per local database (no auth yet) — see lib/demo-profile.ts.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const profileRes = await fetch("/api/profile");
      const { clientProfileId: id } = (await profileRes.json()) as { clientProfileId: string };
      if (cancelled) return;
      setClientProfileId(id);

      const factsRes = await fetch(`/api/facts?clientProfileId=${id}`);
      const { facts: savedFacts } = (await factsRes.json()) as { facts: Array<{ key: string; value: unknown }> };
      if (cancelled) return;

      const rehydrated: Record<string, unknown> = {};
      for (const fact of savedFacts) {
        const questionId = FACT_KEY_TO_QUESTION_ID.get(fact.key);
        if (questionId) rehydrated[questionId] = fact.value;
      }
      setAnswers(rehydrated);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const next = useMemo(() => getNextQuestion(STARTER_QUESTIONS, answers), [answers]);
  const progress = useMemo(() => completionScore(STARTER_QUESTIONS, answers), [answers]);

  const facts: Fact[] = useMemo(
    () =>
      Object.entries(answers).flatMap(([questionId, value]) => {
        if (value === undefined) return [];
        const question = STARTER_QUESTIONS.find((q) => q.id === questionId);
        return question ? produceFacts(question, value) : [];
      }),
    [answers],
  );

  function handleAnswer(question: Question, value: unknown) {
    setAnswers((prev) => ({ ...prev, [question.id]: value }));
    if (value !== undefined && clientProfileId) {
      for (const fact of produceFacts(question, value)) {
        persistFact(clientProfileId, fact);
      }
    }
  }

  async function handleRestart() {
    setAnswers({});
    if (clientProfileId) {
      await fetch(`/api/facts?clientProfileId=${clientProfileId}`, { method: "DELETE" }).catch(() => {});
    }
  }

  return (
    <main>
      <h1>שאלון אינטראקטיבי — כל צרכי הביטוח</h1>
      <p className="subtitle">
        Milestone 2 + התחלת Milestone 6 (PRD §7, §49, §55) · שאלון אחד מאוחד לכל חמשת המחשבונים. התשובות נשמרות
        באמת ב-PostgreSQL (לא רק בזיכרון הדפדפן) — רענון הדף לא מוחק התקדמות. השאלה הבאה נבחרת דינמית לפי
        decisionImpact ורלוונטיות (showWhen).
      </p>
      <p>
        <Link href="/" style={{ color: "var(--accent)" }}>
          ← חזרה לתצוגת ה-5 פרופילים
        </Link>
      </p>

      <div className="banner">
        {
          "זה ניתוח מדיד מסייע לצרכים המפורטים ואינה מהווה תחליף/שיווק עם בעל רישיון מתאים שיאשר לך המלצה סופית. (PRD §4.3, Educational mode)"
        }
      </div>

      {!loaded ? (
        <p>טוען נתונים שמורים...</p>
      ) : next ? (
        <QuestionForm key={next.id} question={next} progress={progress} onAnswer={(value) => handleAnswer(next, value)} />
      ) : (
        <LiveRecommendations facts={facts} onRestart={handleRestart} />
      )}
    </main>
  );
}

function LiveRecommendations(props: { facts: Fact[]; onRestart: () => void }) {
  const { facts, onRestart } = props;
  const NOW = new Date();

  const lifeInput = factsToLifeCalculatorInput(facts);
  const life = lifeCalculator.calculate(lifeInput, STARTER_ENGINE_CONFIG);
  const hasDependents = lifeInput.dependentCount > 0;

  const disabilityInput = factsToDisabilityCalculatorInput(facts);
  const disability = disabilityCalculator.calculate(disabilityInput, STARTER_ENGINE_CONFIG);

  const ciInput = factsToCriticalIllnessInput(facts);
  const ci = criticalIllnessCalculator.calculate({ ...ciInput, recoveryDurationMonths: 6 }, STARTER_ENGINE_CONFIG);

  const ltcInput = factsToLongTermCareInput(facts);
  const ltc = longTermCareCalculator.calculate({ ...ltcInput, expectedDurationYears: 3 }, STARTER_ENGINE_CONFIG);

  const health = healthModuleAssessor.assess(factsToHealthInput(facts), STARTER_ENGINE_CONFIG);

  const lifePriority = priorityEngine.score(
    { category: "life", ...PriorityEngine.gapRatioAndCoverageAdequacy(life.result.grossNeed.toNumber(), life.result.availableResources.toNumber()), hasDependents },
    STARTER_ENGINE_CONFIG,
  );
  const disabilityPriority = priorityEngine.score(
    {
      category: "disability",
      ...PriorityEngine.gapRatioAndCoverageAdequacy(disability.result.requiredMonthlyIncome.toNumber(), disability.result.existingNetExpectedDisabilityIncome.toNumber()),
      hasDependents,
    },
    STARTER_ENGINE_CONFIG,
  );
  const ciPriority = priorityEngine.score(
    { category: "critical_illness", ...PriorityEngine.gapRatioAndCoverageAdequacy(ci.result.need.toNumber(), ci.result.existingCoverage.toNumber()), hasDependents },
    STARTER_ENGINE_CONFIG,
  );
  const ltcPriority = priorityEngine.score(
    { category: "ltc", ...PriorityEngine.gapRatioAndCoverageAdequacy(ltc.result.capitalNeed.toNumber(), 0), hasDependents },
    STARTER_ENGINE_CONFIG,
  );

  const lifeRecommendation = recommendationBuilder.build(
    {
      clientProfileId: "live-questionnaire-session",
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
      clientProfileId: "live-questionnaire-session",
      category: "disability",
      title: "ביטוח אבדן כושר עבודה",
      needAmount: disability.result.requiredMonthlyIncome,
      existingAmount: disability.result.existingNetExpectedDisabilityIncome,
      gapAmount: disability.result.monthlyGap,
      monthlyBenefitTarget: disability.result.monthlyGap,
      horizon: disability.result.recommendedDurationYears !== undefined ? { type: "years", value: disability.result.recommendedDurationYears } : undefined,
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
      clientProfileId: "live-questionnaire-session",
      category: "critical_illness",
      title: "ביטוח מחלות קשות",
      needAmount: ci.result.need,
      existingAmount: ci.result.existingCoverage,
      gapAmount: ci.result.gap,
      reasonCodes: ci.result.reasonCodes,
      reviewTriggers: ci.result.reviewTriggers,
      missingFacts: ci.result.missingFacts,
      assumptions: ci.result.assumptions,
      confidence: ci.result.confidence,
      calculationTraceId: ci.trace.id,
      priority: ciPriority,
    },
    STARTER_ENGINE_CONFIG,
  );
  const ltcRecommendation = recommendationBuilder.build(
    {
      clientProfileId: "live-questionnaire-session",
      category: "ltc",
      title: "ביטוח סיעודי",
      needAmount: ltc.result.capitalNeed,
      existingAmount: Money.zero(),
      gapAmount: ltc.result.capitalNeed,
      horizon: { type: "years", value: 3 },
      reasonCodes: ltc.result.reasonCodes,
      reviewTriggers: ltc.result.reviewTriggers,
      missingFacts: ltc.result.missingFacts,
      assumptions: ltc.result.assumptions,
      confidence: ltc.result.confidence,
      calculationTraceId: ltc.trace.id,
      priority: ltcPriority,
    },
    STARTER_ENGINE_CONFIG,
  );

  return (
    <>
      <p style={{ fontWeight: 600 }}>סיימת! אלו ההמלצות המחושבות מהתשובות שלך, ממש עכשיו, על פני כל חמשת הביטוחים:</p>

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
        badges={[disability.result.recommendedDurationYears !== undefined ? `משך מומלץ: ${disability.result.recommendedDurationYears} שנים` : "משך מומלץ: לא ידוע"]}
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
        badges={["תרחיש מוצג: התאוששות 6 חודשים"]}
        confidence={ci.result.confidence}
        priority={ciPriority}
        status={ciRecommendation.status}
        rationale={ciRecommendation.rationale}
        nextReviewDate={reviewScheduler.nextReviewDate(ciRecommendation, NOW)}
        reasonCodes={ci.result.reasonCodes}
        figures={[
          { label: "צורך חד-פעמי (ברוטו)", amountExact: ci.result.need.toExactString() },
          { label: "כיסוי קיים", amountExact: ci.result.existingCoverage.toExactString() },
          { label: "פער מומלץ", amountExact: ci.result.gap.toExactString(), emphasize: true },
        ]}
        missingFacts={ci.result.missingFacts}
        trace={ci.trace}
      />

      <HealthModuleCard assessments={health} />

      <ResultCard
        title="ביטוח סיעודי"
        badges={["תרחיש מוצג: תוחלת 3 שנים"]}
        confidence={ltc.result.confidence}
        priority={ltcPriority}
        status={ltcRecommendation.status}
        rationale={ltcRecommendation.rationale}
        nextReviewDate={reviewScheduler.nextReviewDate(ltcRecommendation, NOW)}
        reasonCodes={ltc.result.reasonCodes}
        figures={[
          { label: "פער חודשי בעלות טיפול", amountExact: ltc.result.monthlyGap.toExactString() },
          { label: "הון נדרש (מהוון)", amountExact: ltc.result.capitalNeed.toExactString(), emphasize: true },
        ]}
        missingFacts={ltc.result.missingFacts}
        trace={ltc.trace}
      />

      <button className="badge" style={{ cursor: "pointer", padding: "8px 20px" }} onClick={onRestart}>
        התחל שאלון מחדש
      </button>
    </>
  );
}
