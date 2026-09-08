import { NextResponse } from "next/server";
import { getOrCreateDemoClientProfile } from "../../../lib/demo-profile";

export async function GET() {
  const clientProfileId = await getOrCreateDemoClientProfile();
  return NextResponse.json({ clientProfileId });
}
