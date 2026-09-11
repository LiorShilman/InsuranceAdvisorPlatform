import { NextResponse } from "next/server";
import type { Fact } from "@insurance-advisor/shared";
import { prisma } from "../../../lib/prisma";
import { getCurrentUser } from "../../../lib/auth";
import { clientProfileBelongsToUser } from "../../../lib/client-profile";
import { computeAllRecommendations } from "../../../lib/compute-recommendations";
import { buildExplainPayload, explainRecommendation, ExplainUnavailableError } from "../../../lib/llm-explain";

// The one disclosure §29's contract requires every explanation to carry
// verbatim — same wording as <EducationalModeBanner/>, kept in sync by hand
// since one lives in a client component and the other runs server-only.
const REQUIRED_DISCLOSURES = [
  "זהו ניתוח ראשוני להערכת צרכי הביטוח שלך, ואינו מהווה ייעוץ או המלצה מחייבת — יש להתייעץ עם בעל רישיון מתאים לפני קבלת החלטה סופית.",
];

const VALID_CATEGORIES = ["life", "disability", "critical_illness", "ltc"] as const;
type Category = (typeof VALID_CATEGORIES)[number];

/**
 * PRD §29 — "explain deterministic result". Recomputes the recommendation
 * server-side from this user's own persisted Facts (never trusts a
 * client-supplied recommendation object) and asks the LLM to paraphrase it.
 * See lib/llm-explain.ts for the actual boundary being enforced.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  const body = await request.json();
  const { clientProfileId, category } = body as { clientProfileId?: string; category?: string };

  if (!clientProfileId || !category || !VALID_CATEGORIES.includes(category as Category)) {
    return NextResponse.json({ error: "clientProfileId and a valid category are required" }, { status: 400 });
  }
  if (!(await clientProfileBelongsToUser(clientProfileId, user.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const rows = await prisma.fact.findMany({ where: { clientProfileId } });
  // Same DB→domain-type trust boundary as app/api/facts/route.ts's GET —
  // Prisma's raw row shape (source: string, effectiveDate: Date | null)
  // is structurally wider/narrower than the shared `Fact` type in ways
  // TS can't verify are safe on its own; nothing here actually writes an
  // out-of-union `source` or a non-ISO `effectiveDate`.
  const facts = rows.map((f) => ({ ...f, confidence: Number(f.confidence) })) as unknown as Fact[];
  const computed = computeAllRecommendations(facts, clientProfileId, new Date());

  const byCategory: Record<Category, { recommendation: (typeof computed)["life"]["recommendation"]; trace: (typeof computed)["life"]["trace"] }> = {
    life: computed.life,
    disability: computed.disability,
    critical_illness: computed.ci,
    ltc: computed.ltc,
  };
  const { recommendation, trace } = byCategory[category as Category];

  const payload = buildExplainPayload(recommendation, trace, REQUIRED_DISCLOSURES);

  try {
    const explanation = await explainRecommendation(payload);
    return NextResponse.json({ explanation });
  } catch (err) {
    if (err instanceof ExplainUnavailableError) {
      return NextResponse.json({ error: "שכבת ההסברים אינה זמינה כרגע (חסר מפתח API בהגדרות השרת)" }, { status: 503 });
    }
    console.error("explain error", err);
    return NextResponse.json({ error: "יצירת ההסבר נכשלה" }, { status: 502 });
  }
}
