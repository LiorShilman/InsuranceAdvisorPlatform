import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../lib/auth";
import { getOrCreateClientProfileForUser } from "../../../lib/client-profile";

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  const { clientProfileId, primaryPersonId } = await getOrCreateClientProfileForUser(user.id);
  return NextResponse.json({ clientProfileId, primaryPersonId });
}
