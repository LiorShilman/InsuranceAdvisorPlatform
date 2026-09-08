import { NextResponse } from "next/server";
import { getOrCreateDemoClientProfile } from "../../../lib/demo-profile";

export async function GET() {
  const { clientProfileId, primaryPersonId } = await getOrCreateDemoClientProfile();
  return NextResponse.json({ clientProfileId, primaryPersonId });
}
