import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { verifyPassword, createSession, SESSION_COOKIE } from "../../../../lib/auth";

export async function POST(request: Request) {
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

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return genericError();

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
