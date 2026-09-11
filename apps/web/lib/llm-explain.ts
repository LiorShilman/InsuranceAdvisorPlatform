import Anthropic from "@anthropic-ai/sdk";
import type { Recommendation } from "@insurance-advisor/domain";
import type { CalculationTrace } from "@insurance-advisor/shared";
import { RECOMMENDATION_CATEGORY_LABELS } from "./answer-labels";

/**
 * PRD §29 "LLM Boundary" — the explanation layer. This is deliberately the
 * *only* place in the app that calls an LLM, and it only ever does the one
 * thing §29 allows here ("explain deterministic result"): every number in
 * the output already exists in `recommendation`/`trace` before the model
 * sees them. The model paraphrases and contextualizes; it never computes.
 *
 * Scope note (docs/ASSUMPTIONS.md): unlike the PRD's literal tool contract
 * (`allowedFacts: []` — raw Facts), this sends only the Recommendation +
 * CalculationTrace + assumptions/missingFacts already computed server-side
 * — never a client's raw Fact rows, and never anything from
 * HealthDisclosure. That keeps sensitive data (health, income specifics
 * beyond what's already aggregated into the trace) from ever leaving the
 * server for a third-party API, at the cost of the explanation not being
 * able to reference facts that didn't end up in the trace/assumptions.
 */

const SYSTEM_PROMPT = `את/ה שכבת הסבר בלבד במערכת ייעוץ ביטוחי. תפקידך להסביר תוצאה מספרית שכבר חושבה — לא לחשב, לא להמליץ, ולא להמציא.

כללים מוחלטים:
- לעולם אל תשני/תשנה ערך מספרי כלשהו מהנתונים שסופקו. כל מספר בתשובה שלך חייב להופיע כפי שהוא בנתונים.
- לעולם אל תמציא/י חברת ביטוח, מוצר ביטוחי, או תנאי פוליסה.
- לעולם אל תסיק/י עובדות רפואיות שלא סופקו במפורש.
- לעולם אל תבטלי כלל זכאות ואל תמליצי על ביטול ביטוח קיים.
- כשנתון מסומן כחסר (missingFacts) — ציין/ציני זאת במפורש כלא ידוע, אל תנחש/י ערך.
- הפלט שלך הוא הסבר בעברית פשוטה וברורה לאדם ללא רקע ביטוחי/פיננסי, לא ייעוץ אישי ולא הבטחה.
- כלול תמיד, בסוף התשובה, את הגילויים הנדרשים שסופקו לך (requiredDisclosures) בדיוק כלשונם, ללא שינוי.
- אורך: 3-5 משפטים קצרים, לא רשימה, לא כותרות.`;

export type ExplainPayload = {
  recommendation: {
    category: string;
    title: string;
    priorityBand: string;
    confidence: string;
    needAmount?: string;
    existingAmount?: string;
    gapAmount?: string;
    reasonCodes: string[];
    missingFacts: string[];
    assumptions: { description: string; value: string | number | boolean }[];
  };
  calculationTrace: { label: string; amountExact: string }[];
  requiredDisclosures: string[];
};

export function buildExplainPayload(recommendation: Recommendation, trace: CalculationTrace, requiredDisclosures: string[]): ExplainPayload {
  return {
    recommendation: {
      category: RECOMMENDATION_CATEGORY_LABELS[recommendation.category] ?? recommendation.category,
      title: recommendation.title,
      priorityBand: recommendation.priorityBand,
      confidence: recommendation.confidence,
      needAmount: recommendation.needAmount?.toExactString(),
      existingAmount: recommendation.existingAmount?.toExactString(),
      gapAmount: recommendation.gapAmount?.toExactString(),
      reasonCodes: recommendation.reasonCodes,
      missingFacts: recommendation.missingFacts,
      assumptions: recommendation.assumptions.map((a) => ({ description: a.description, value: a.value })),
    },
    calculationTrace: trace.lines.map((line) => ({ label: line.label, amountExact: line.amountExact })),
    requiredDisclosures,
  };
}

let client: Anthropic | null = null;
function getClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  if (!client) client = new Anthropic({ apiKey });
  return client;
}

export class ExplainUnavailableError extends Error {}

export async function explainRecommendation(payload: ExplainPayload): Promise<string> {
  const anthropic = getClient();
  if (!anthropic) throw new ExplainUnavailableError("ANTHROPIC_API_KEY is not configured");

  const message = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 500,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: JSON.stringify(payload) }],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new ExplainUnavailableError("Empty response from the explanation model");
  return textBlock.text.trim();
}
