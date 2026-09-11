import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { getCurrentUser } from "../../../lib/auth";
import { clientProfileBelongsToUser } from "../../../lib/client-profile";

/**
 * Real CRUD over the `coverages` table (prisma/schema.prisma) — the
 * domain `Coverage` entity (PRD §18) existed since Milestone 1 but was
 * only ever populated by `packages/test-fixtures`, never by a live user.
 * This is what lets `CoverageDeduplicationEngine` (already implemented
 * and tested — see docs/DECISIONS.md) finally run against real,
 * user-entered data instead of only the 5 fixed personas on `/`.
 *
 * Amount/monthlyBenefit are serialized as plain numbers here (same
 * Decimal→Number fix already applied to /api/facts's `confidence`),
 * not Prisma's string-serialized Decimal — the frontend builds real
 * `Money` instances from these numbers before calling the engine.
 */
function serializeCoverage(row: {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  clientProfileId: string;
  category: string;
  subtype: string;
  insuredPersonId: string;
  beneficiaryType: string | null;
  amount: unknown;
  monthlyBenefit: unknown;
  startDate: Date | null;
  endDate: Date | null;
  waitingPeriodDays: number | null;
  verified: boolean;
  source: string;
  exclusionsKnown: boolean;
  notes: string | null;
}) {
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    clientProfileId: row.clientProfileId,
    category: row.category,
    subtype: row.subtype,
    insuredPersonId: row.insuredPersonId,
    beneficiaryType: row.beneficiaryType ?? undefined,
    amount: row.amount === null ? undefined : Number(row.amount),
    monthlyBenefit: row.monthlyBenefit === null ? undefined : Number(row.monthlyBenefit),
    startDate: row.startDate ? row.startDate.toISOString().slice(0, 10) : undefined,
    endDate: row.endDate ? row.endDate.toISOString().slice(0, 10) : undefined,
    waitingPeriodDays: row.waitingPeriodDays ?? undefined,
    verified: row.verified,
    source: row.source,
    exclusionsKnown: row.exclusionsKnown,
    notes: row.notes ?? undefined,
  };
}

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  const clientProfileId = new URL(request.url).searchParams.get("clientProfileId");
  if (!clientProfileId) {
    return NextResponse.json({ error: "clientProfileId is required" }, { status: 400 });
  }
  if (!(await clientProfileBelongsToUser(clientProfileId, user.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const rows = await prisma.coverage.findMany({ where: { clientProfileId }, orderBy: { createdAt: "asc" } });
  return NextResponse.json({ coverages: rows.map(serializeCoverage) });
}

export async function POST(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  const body = await request.json();
  const {
    clientProfileId,
    category,
    subtype,
    insuredPersonId,
    beneficiaryType,
    amount,
    monthlyBenefit,
    startDate,
    endDate,
    waitingPeriodDays,
    notes,
  } = body as {
    clientProfileId?: string;
    category?: string;
    subtype?: string;
    insuredPersonId?: string;
    beneficiaryType?: string;
    amount?: number;
    monthlyBenefit?: number;
    startDate?: string;
    endDate?: string;
    waitingPeriodDays?: number;
    notes?: string;
  };

  if (!clientProfileId || !category || !subtype || !insuredPersonId) {
    return NextResponse.json({ error: "clientProfileId, category, subtype and insuredPersonId are required" }, { status: 400 });
  }
  if (!(await clientProfileBelongsToUser(clientProfileId, user.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (amount === undefined && monthlyBenefit === undefined) {
    return NextResponse.json({ error: "at least one of amount or monthlyBenefit is required" }, { status: 400 });
  }

  const row = await prisma.coverage.create({
    data: {
      clientProfileId,
      category,
      subtype,
      insuredPersonId,
      beneficiaryType: beneficiaryType ?? null,
      amount: amount ?? null,
      monthlyBenefit: monthlyBenefit ?? null,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      waitingPeriodDays: waitingPeriodDays ?? null,
      // A user manually entering their own existing policy here is "self-reported,
      // unverified" — same honesty-over-convenience default used for every other
      // user-entered Fact in this app (see /api/facts's source: "user").
      verified: false,
      source: "user",
      exclusionsKnown: false,
      notes: notes ?? null,
    },
  });

  return NextResponse.json({ coverage: serializeCoverage(row) });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }
  // No clientProfileId is supplied here (only the coverage's own id) — look up which
  // profile it belongs to before deleting, same ownership discipline as every other route.
  const existing = await prisma.coverage.findUnique({ where: { id } });
  if (!existing || !(await clientProfileBelongsToUser(existing.clientProfileId, user.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  await prisma.coverage.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
