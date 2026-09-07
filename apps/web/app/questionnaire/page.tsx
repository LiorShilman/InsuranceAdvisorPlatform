"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Fact } from "@insurance-advisor/shared";
import { STARTER_ENGINE_CONFIG } from "@insurance-advisor/config";
import {
  STARTER_LIFE_QUESTIONS,
  getNextQuestion,
  completionScore,
  validateAnswer,
  produceFacts,
  type Question,
  type ValidationIssue,
} from "@insurance-advisor/questionnaire";
import {
  LifeInsuranceCalculator,
  PriorityEngine,
  RecommendationBuilder,
  ReviewScheduler,
  factsToLifeCalculatorInput,
} from "@insurance-advisor/calculators";
import { ResultCard, formatExact } from "../components/result-card";

/**
 * A REAL interactive flow — no hardcoded fixtures. Answers go through the
 * same `getNextQuestion`/`validateAnswer`/`produceFacts` engine as any
 * future full UI would, and the recommendation at the end is computed
 * live from what you typed via `factsToLifeCalculatorInput`, the actual
 * Facts→calculator adapter (not the `fromHouseholdFixture` demo one the
 * main preview page uses). Scoped to Life Insurance only — see
 * docs/DECISIONS.md.
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

const lifeCalculator = new LifeInsuranceCalculator();
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
          {(SINGLE_SELECT_OPTIONS[question.id] ?? []).map((opt) => (
            <button
              key={opt.value}
              className="badge"
              style={{ cursor: "pointer", fontSize: "1rem", padding: "8px 16px", textAlign: "right" }}
              onClick={() => onAnswer(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type={question.answerType === "date" ? "date" : "text"}
            inputMode={question.answerType === "number" || question.answerType === "money" ? "decimal" : undefined}
            className="form-input"
            style={{ flex: 1, padding: 10, fontSize: "1rem", borderRadius: 8, border: "1px solid var(--border)" }}
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
        <p key={i} className={issue.severity === "error" ? "missing" : "missing"} style={{ color: issue.severity === "error" ? "var(--gap)" : "var(--muted)" }}>
          {issue.message}
        </p>
      ))}
    </section>
  );
}

export default function QuestionnairePage() {
  const [answers, setAnswers] = useState<Record<string, unknown>>({});

  const next = useMemo(() => getNextQuestion(STARTER_LIFE_QUESTIONS, answers), [answers]);
  const progress = useMemo(() => completionScore(STARTER_LIFE_QUESTIONS, answers), [answers]);

  const facts: Fact[] = useMemo(
    () =>
      Object.entries(answers).flatMap(([questionId, value]) => {
        if (value === undefined) return [];
        const question = STARTER_LIFE_QUESTIONS.find((q) => q.id === questionId);
        return question ? produceFacts(question, value) : [];
      }),
    [answers],
  );

  return (
    <main>
      <h1>שאלון אינטראקטיבי — ביטוח חיים</h1>
      <p className="subtitle">
        Milestone 2 (PRD §7, §49) · שאלה הבאה נבחרת דינמית לפי decisionImpact ורלוונטיות (showWhen), לא רשימה קבועה.
        התשובות הופכות ל-Facts (§8) שעוברות דרך <code>factsToLifeCalculatorInput</code> — מתאם ה-Facts האמיתי, לא
        פיקסצ׳ר קשיח.
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

      {next ? (
        <QuestionForm
          question={next}
          progress={progress}
          onAnswer={(value) => setAnswers((prev) => ({ ...prev, [next.id]: value }))}
        />
      ) : (
        <LiveRecommendation facts={facts} onRestart={() => setAnswers({})} />
      )}
    </main>
  );
}

function LiveRecommendation(props: { facts: Fact[]; onRestart: () => void }) {
  const { facts, onRestart } = props;
  const NOW = new Date();

  const input = factsToLifeCalculatorInput(facts);
  const { result, trace } = lifeCalculator.calculate(input, STARTER_ENGINE_CONFIG);

  const priority = priorityEngine.score(
    {
      category: "life",
      ...PriorityEngine.gapRatioAndCoverageAdequacy(result.grossNeed.toNumber(), result.availableResources.toNumber()),
      hasDependents: input.dependentCount > 0,
    },
    STARTER_ENGINE_CONFIG,
  );

  const recommendation = recommendationBuilder.build(
    {
      clientProfileId: "live-questionnaire-session",
      category: "life",
      title: "ביטוח חיים",
      needAmount: result.grossNeed,
      existingAmount: result.availableResources,
      gapAmount: result.gap,
      horizon: { type: "years", value: result.horizonYears },
      reasonCodes: result.reasonCodes,
      reviewTriggers: result.reviewTriggers,
      missingFacts: result.missingFacts,
      assumptions: result.assumptions,
      confidence: result.confidence,
      calculationTraceId: trace.id,
      priority,
    },
    STARTER_ENGINE_CONFIG,
  );

  return (
    <>
      <p style={{ fontWeight: 600 }}>סיימת! זו ההמלצה המחושבת מהתשובות שלך, ממש עכשיו:</p>
      <ResultCard
        title="ביטוח חיים"
        badges={[`טווח הגנה: ${result.horizonYears} שנים`]}
        confidence={result.confidence}
        priority={priority}
        status={recommendation.status}
        rationale={recommendation.rationale}
        nextReviewDate={reviewScheduler.nextReviewDate(recommendation, NOW)}
        reasonCodes={result.reasonCodes}
        figures={[
          { label: "צורך חישובי (ברוטו)", amountExact: result.grossNeed.toExactString() },
          { label: "כיסוי ומשאבים קיימים", amountExact: result.availableResources.toExactString() },
          { label: "פער מומלץ לכיסוי", amountExact: result.gap.toExactString(), emphasize: true },
        ]}
        note={`טווח מוצע: ${formatExact(result.recommendedRange.min.toExactString())} – ${formatExact(result.recommendedRange.max.toExactString())}`}
        missingFacts={result.missingFacts}
        trace={trace}
      />
      <button className="badge" style={{ cursor: "pointer", padding: "8px 20px" }} onClick={onRestart}>
        התחל שאלון מחדש
      </button>
    </>
  );
}
