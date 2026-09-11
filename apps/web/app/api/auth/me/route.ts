import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../lib/auth";

/** Used by the nav bar to show the signed-in user's email + a sign-out control, or a sign-in link. */
export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ user: null }, { status: 401 });
  return NextResponse.json({ user: { email: user.email, displayName: user.displayName } });
}
