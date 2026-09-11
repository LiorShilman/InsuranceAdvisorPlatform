import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { getCurrentUser } from "../../../lib/auth";
import { clientProfileBelongsToUser } from "../../../lib/client-profile";

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  const clientProfileId = new URL(request.url).searchParams.get("clientProfileId");
  if (!clientProfileId) {
    return NextResponse.json({ error: "clientProfileId is required" }, { status: 400 });
  }
  // A clientProfileId is client-supplied — confirm it's actually this user's own before reading anything through it.
  if (!(await clientProfileBelongsToUser(clientProfileId, user.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const rows = await prisma.fact.findMany({ where: { clientProfileId } });
  // Prisma's Decimal serializes to a string over JSON — convert back to a
  // number here so the response actually matches the shared `Fact` type's
  // `confidence: number`, instead of silently handing callers a string.
  const facts = rows.map((f) => ({ ...f, confidence: Number(f.confidence) }));
  return NextResponse.json({ facts });
}

/**
 * Upserts one Fact by (clientProfileId, key). No unique constraint exists
 * on that pair in the schema (only an index) — find-then-update-or-create
 * instead of a real `upsert`. Now that real multi-user accounts exist,
 * two concurrent tabs for the *same* user answering the *same* question
 * at once could theoretically race into two rows — narrow, low-stakes
 * (the questionnaire is a single-user-at-a-time flow in practice), but a
 * real unique constraint + `upsert` would close it properly; flagged
 * rather than fixed here to keep this change scoped to auth itself.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  const body = await request.json();
  const { clientProfileId, key, value, source, confidence, verified } = body as {
    clientProfileId?: string;
    key?: string;
    value?: unknown;
    source?: string;
    confidence?: number;
    verified?: boolean;
  };

  if (!clientProfileId || !key) {
    return NextResponse.json({ error: "clientProfileId and key are required" }, { status: 400 });
  }
  if (!(await clientProfileBelongsToUser(clientProfileId, user.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const existing = await prisma.fact.findFirst({ where: { clientProfileId, key } });

  const data = {
    clientProfileId,
    key,
    value: value as never,
    source: source ?? "user",
    confidence: confidence ?? 1,
    verified: verified ?? true,
  };

  const fact = existing
    ? await prisma.fact.update({ where: { id: existing.id }, data })
    : await prisma.fact.create({ data });

  return NextResponse.json({ fact });
}

/** Clears every fact for a profile — used by the questionnaire's "start over" action. */
export async function DELETE(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  const clientProfileId = new URL(request.url).searchParams.get("clientProfileId");
  if (!clientProfileId) {
    return NextResponse.json({ error: "clientProfileId is required" }, { status: 400 });
  }
  if (!(await clientProfileBelongsToUser(clientProfileId, user.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  await prisma.fact.deleteMany({ where: { clientProfileId } });
  return NextResponse.json({ ok: true });
}
