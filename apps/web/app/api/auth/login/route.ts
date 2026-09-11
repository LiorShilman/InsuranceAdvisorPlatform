import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { verifyPassword, createSession, isLockedOut, recordFailedLogin, resetFailedLogins, SESSION_COOKIE } from "../../../../lib/auth";
import { checkRateLimit, clientIp } from "../../../../lib/rate-limit";

export async function POST(request: Request) {
  // Coarse per-IP throttle (defense against one IP hammering many different
  // emails) — the real per-account defense is the lockout below.
  if (!checkRateLimit(`login:${clientIp(request)}`, 20, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "יותר מדי ניסיונות התחברות. נסה/י שוב בעוד כמה דקות" }, { status: 429 });
  }

  const body = await request.json();
  const { email, password } = body as { email?: string; password?: string };

  if (!email || !password) {
    return NextResponse.json({ error: "יש למלא אימייל וסיסמה" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  // Deliberately the same generic message whether the email doesn't exist or the
  // password is wrong — telling an attacker which one failed leaks which emails
  // are registered.
  const genericError = () => NextResponse.json({ error: "אימייל או סיסמה שגויים" }, { status: 401 });
  if (!user) return genericError();

  if (isLockedOut(user)) {
    return NextResponse.json({ error: "החשבון ננעל זמנית עקב ניסיונות התחברות כושלים. נסה/י שוב בעוד 15 דקות" }, { status: 423 });
  }

  // A Google-only account (no local password ever set) can't be logged into
  // this way — same generic message, doesn't reveal the account exists.
  if (!user.passwordHash) return genericError();

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    await recordFailedLogin(user.id);
    return genericError();
  }

  await resetFailedLogins(user.id);
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
