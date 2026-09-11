import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { createSession, SESSION_COOKIE } from "../../../../lib/auth";
import { verifyGoogleIdToken } from "../../../../lib/google-auth";
import { checkRateLimit, clientIp } from "../../../../lib/rate-limit";

/**
 * Google Sign-In. The client sends the ID token (`credential`) it got back
 * from Google Identity Services after the user picked an account — this
 * route is the only place that ever trusts it, and only after verifying its
 * signature (lib/google-auth.ts). Three cases:
 *  1. A user already linked to this Google account (google_id matches) → log in.
 *  2. No link yet, but the email matches an existing email/password account →
 *     link this Google identity to it (so either method logs into the same
 *     account from here on) and log in.
 *  3. Neither → create a brand-new account with no local password at all.
 */
export async function POST(request: Request) {
  if (!checkRateLimit(`google-auth:${clientIp(request)}`, 20, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "יותר מדי בקשות. נסה/י שוב בעוד כמה דקות" }, { status: 429 });
  }

  const body = await request.json();
  const { credential } = body as { credential?: string };
  if (!credential) {
    return NextResponse.json({ error: "לא התקבל אישור מ-Google" }, { status: 400 });
  }

  const identity = await verifyGoogleIdToken(credential);
  if (!identity) {
    return NextResponse.json({ error: "אימות ההתחברות עם Google נכשל" }, { status: 401 });
  }
  if (!identity.emailVerified) {
    return NextResponse.json({ error: "כתובת האימייל של חשבון ה-Google לא מאומתת" }, { status: 401 });
  }

  let user = await prisma.user.findUnique({ where: { googleId: identity.googleId } });

  if (!user) {
    const existingByEmail = await prisma.user.findUnique({ where: { email: identity.email } });
    user = existingByEmail
      ? await prisma.user.update({ where: { id: existingByEmail.id }, data: { googleId: identity.googleId } })
      : await prisma.user.create({
          data: {
            email: identity.email,
            googleId: identity.googleId,
            displayName: identity.displayName,
            role: "client",
          },
        });
  }

  const session = await createSession(user.id);
  const response = NextResponse.json({ email: user.email });
  response.cookies.set(SESSION_COOKIE, session.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: session.expiresAt,
  });
  return response;
}
