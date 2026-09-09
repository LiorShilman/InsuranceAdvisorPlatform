"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Fact } from "@insurance-advisor/shared";
import {
  STARTER_QUESTIONS,
  resolveWizardStep,
  completionScore,
  validateAnswer,
  produceFacts,
  type Question,
  type ValidationIssue,
} from "@insurance-advisor/questionnaire";
import { ResultCard, CATEGORY_ICONS, formatExact } from "../components/result-card";
import { HealthModuleCard } from "../components/health-module-card";
import { computeAllRecommendations } from "../../lib/compute-recommendations";

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

function parseDraft(question: Question, draft: string): unknown {
  if (draft === "") return undefined;
  if (question.answerType === "boolean") return draft === "true";
  if (question.answerType === "number" || question.answerType === "money") {
    const n = Number(draft);
    return Number.isFinite(n) ? n : undefined;
  }
  return draft;
}

function draftFromValue(question: Question, value: unknown): string {
  if (value === undefined) return "";
  if (question.answerType === "boolean") return ""; // rendered via the selected choice-card, not the text draft
  return String(value);
}

function QuestionForm(props: {
  question: Question;
  onAnswer: (value: unknown) => void;
  onBack?: () => void;
  progress: number;
  /** Set while reviewing/editing an already-answered question (resolveWizardStep's "reviewing" step) — pre-fills the current value. */
  currentValue?: unknown;
}) {
  const { question, onAnswer, onBack, progress, currentValue } = props;
  const [draft, setDraft] = useState(() => draftFromValue(question, currentValue));
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
    <section className="wizard-card">
      <div className="wizard-progress-track">
        <div className="wizard-progress-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>

      {onBack && (
        <button type="button" className="btn btn-ghost btn-sm" style={{ marginBottom: 8 }} onClick={onBack}>
          → חזרה לשאלה הקודמת
        </button>
      )}

      <h2 className="wizard-question">{question.text}</h2>
      {question.helpText && <p className="wizard-help">{question.helpText}</p>}

      {question.answerType === "boolean" ? (
        <div className="choice-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <button type="button" className={`choice-card${currentValue === true ? " selected" : ""}`} onClick={() => onAnswer(true)}>
            כן
          </button>
          <button type="button" className={`choice-card${currentValue === false ? " selected" : ""}`} onClick={() => onAnswer(false)}>
            לא
          </button>
        </div>
      ) : question.answerType === "single_select" ? (
        <div className="choice-grid">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`choice-card${currentValue === opt.value ? " selected" : ""}`}
              onClick={() => onAnswer(opt.value)}
            >
              {opt.label}
            </button>
          ))}
          {question.id.startsWith("health_module_") && (
            <button type="button" className="btn btn-ghost btn-sm" style={{ justifySelf: "flex-start" }} onClick={() => onAnswer(undefined)}>
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
            style={{ flex: 1, padding: "12px 14px", borderRadius: "var(--radius-md)" }}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            autoFocus
          />
          <button type="button" className="btn btn-primary" onClick={submit}>
            המשך
          </button>
        </div>
      )}

      {!question.required && question.answerType !== "boolean" && question.answerType !== "single_select" && (
        <p style={{ marginTop: 12 }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onAnswer(undefined)}>
            דלג (שאלה לא חובה)
          </button>
        </p>
      )}

      {issues.map((issue, i) => (
        <p key={i} className="missing" style={{ color: issue.severity === "error" ? "var(--danger)" : "var(--muted)" }}>
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
  // Ordered list of question ids actually asked, and a read head into it —
  // see resolveWizardStep's doc comment for the full model. pointer ===
  // history.length means "at the live edge" (adaptive selection applies).
  const [history, setHistory] = useState<string[]>([]);
  const [pointer, setPointer] = useState(0);
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
      // Best-effort history reconstruction after a refresh: the API doesn't
      // record the order questions were originally asked in, only the facts
      // themselves — so "back" after a refresh walks answers in the order
      // they came back from the DB (in practice usually creation order),
      // not necessarily the exact original sequence. Good enough for
      // "let me fix something I got wrong," not claimed as more than that.
      const reconstructedHistory = Object.keys(rehydrated);
      setHistory(reconstructedHistory);
      setPointer(reconstructedHistory.length);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const step = useMemo(() => resolveWizardStep(STARTER_QUESTIONS, answers, history, pointer), [answers, history, pointer]);
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
    if (step.kind === "reviewing") {
      // Editing a previous answer invalidates whatever came after it (later
      // questions may have been selected/gated based on the old value) —
      // truncate history here and let live selection pick up fresh from
      // this point, rather than silently carrying over now-possibly-stale
      // downstream answers.
      setHistory((prev) => [...prev.slice(0, pointer), question.id]);
      setPointer((p) => p + 1);
    } else {
      setHistory((prev) => [...prev, question.id]);
      setPointer((p) => p + 1);
    }
  }

  function handleBack() {
    setPointer((p) => Math.max(0, p - 1));
  }

  async function handleRestart() {
    setAnswers({});
    setHistory([]);
    setPointer(0);
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
        <Link href="/" style={{ color: "var(--brand)" }}>
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
      ) : step.kind !== "done" ? (
        <QuestionForm
          key={step.question.id}
          question={step.question}
          progress={progress}
          currentValue={answers[step.question.id]}
          onAnswer={(value) => handleAnswer(step.question, value)}
          onBack={pointer > 0 ? handleBack : undefined}
        />
      ) : (
        <LiveRecommendations
          facts={facts}
          clientProfileId={clientProfileId ?? "unknown"}
          onRestart={handleRestart}
          onBack={pointer > 0 ? handleBack : undefined}
        />
      )}
    </main>
  );
}

function LiveRecommendations(props: { facts: Fact[]; clientProfileId: string; onRestart: () => void; onBack?: () => void }) {
  const { facts, clientProfileId, onRestart, onBack } = props;
  const computed = useMemo(() => computeAllRecommendations(facts, clientProfileId, new Date()), [facts, clientProfileId]);
  const { life, disability, ci, ltc, health } = computed;

  return (
    <>
      {onBack && (
        <button type="button" className="btn btn-ghost btn-sm" style={{ marginBottom: 12 }} onClick={onBack}>
          → חזרה לשאלה האחרונה
        </button>
      )}
      <p style={{ fontWeight: 600 }}>סיימת! אלו ההמלצות המחושבות מהתשובות שלך, ממש עכשיו, על פני כל חמשת הביטוחים:</p>
      <p>
        <Link href="/report" style={{ color: "var(--brand)", fontWeight: 600 }}>
          → צפה בדוח המלא (§39)
        </Link>
      </p>

      <ResultCard
        title="ביטוח חיים"
        icon={CATEGORY_ICONS.life}
        coverageRatio={life.coverageRatio}
        badges={[`טווח הגנה: ${life.result.horizonYears} שנים`]}
        confidence={life.result.confidence}
        priority={life.priority}
        status={life.recommendation.status}
        rationale={life.recommendation.rationale}
        nextReviewDate={life.nextReviewDate}
        reasonCodes={life.result.reasonCodes}
        figures={[
          { label: "צורך חישובי (ברוטו)", amountExact: life.result.grossNeed.toExactString() },
          { label: "כיסוי ומשאבים קיימים", amountExact: life.result.availableResources.toExactString() },
          { label: "פער מומלץ לכיסוי", amountExact: life.result.gap.toExactString(), emphasize: true },
        ]}
        note={`טווח מוצע: ${formatExact(life.result.recommendedRange.min.toExactString())} – ${formatExact(life.result.recommendedRange.max.toExactString())}`}
        missingFacts={life.result.missingFacts}
        trace={life.trace}
        extraContent={
          life.affordability.budgetSupportedCoverage && (
            <p className="missing" style={{ color: "var(--muted)" }}>
              חלופה מוגבלת תקציב: כיסוי נתמך {formatExact(life.affordability.budgetSupportedCoverage.toExactString())} · פער שנותר{" "}
              {formatExact(life.affordability.remainingUninsuredGap.toExactString())} (§20 — ראה{" "}
              <Link href="/report" style={{ color: "var(--brand)" }}>
                דוח מלא
              </Link>
              )
            </p>
          )
        }
      />

      <ResultCard
        title="ביטוח אבדן כושר עבודה"
        icon={CATEGORY_ICONS.disability}
        coverageRatio={disability.coverageRatio}
        badges={[disability.result.recommendedDurationYears !== undefined ? `משך מומלץ: ${disability.result.recommendedDurationYears} שנים` : "משך מומלץ: לא ידוע"]}
        confidence={disability.result.confidence}
        priority={disability.priority}
        status={disability.recommendation.status}
        rationale={disability.recommendation.rationale}
        nextReviewDate={disability.nextReviewDate}
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
        icon={CATEGORY_ICONS.critical_illness}
        coverageRatio={ci.coverageRatio}
        badges={["תרחיש מוצג: התאוששות 6 חודשים"]}
        confidence={ci.result.confidence}
        priority={ci.priority}
        status={ci.recommendation.status}
        rationale={ci.recommendation.rationale}
        nextReviewDate={ci.nextReviewDate}
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
        icon={CATEGORY_ICONS.ltc}
        coverageRatio={ltc.coverageRatio}
        badges={["תרחיש מוצג: תוחלת 3 שנים"]}
        confidence={ltc.result.confidence}
        priority={ltc.priority}
        status={ltc.recommendation.status}
        rationale={ltc.recommendation.rationale}
        nextReviewDate={ltc.nextReviewDate}
        reasonCodes={ltc.result.reasonCodes}
        figures={[
          { label: "פער חודשי בעלות טיפול", amountExact: ltc.result.monthlyGap.toExactString() },
          { label: "הון נדרש (מהוון)", amountExact: ltc.result.capitalNeed.toExactString(), emphasize: true },
        ]}
        missingFacts={ltc.result.missingFacts}
        trace={ltc.trace}
      />

      <button type="button" className="btn btn-ghost" onClick={onRestart}>
        התחל שאלון מחדש
      </button>
    </>
  );
}
