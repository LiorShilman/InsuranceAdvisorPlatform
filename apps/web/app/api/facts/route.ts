import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export async function GET(request: Request) {
  const clientProfileId = new URL(request.url).searchParams.get("clientProfileId");
  if (!clientProfileId) {
    return NextResponse.json({ error: "clientProfileId is required" }, { status: 400 });
  }
  const facts = await prisma.fact.findMany({ where: { clientProfileId } });
  return NextResponse.json({ facts });
}

/**
 * Upserts one Fact by (clientProfileId, key). No unique constraint exists
 * on that pair in the schema (only an index) — find-then-update-or-create
 * instead of a real `upsert`. Fine for a single-user local demo with no
 * concurrent writers; a real multi-user deployment would need the unique
 * constraint and an actual upsert.
 */
export async function POST(request: Request) {
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
  const clientProfileId = new URL(request.url).searchParams.get("clientProfileId");
  if (!clientProfileId) {
    return NextResponse.json({ error: "clientProfileId is required" }, { status: 400 });
  }
  await prisma.fact.deleteMany({ where: { clientProfileId } });
  return NextResponse.json({ ok: true });
}
