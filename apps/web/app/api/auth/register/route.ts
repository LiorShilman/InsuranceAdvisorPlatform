import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { hashPassword, createSession, SESSION_COOKIE } from "../../../../lib/auth";
import { validatePasswordStrength } from "../../../../lib/password-policy";
import { checkRateLimit, clientIp } from "../../../../lib/rate-limit";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  if (!checkRateLimit(`register:${clientIp(request)}`, 10, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "יותר מדי נסיונות הרשמה. נסה/י שוב בעוד כמה דקות" }, { status: 429 });
  }

  const body = await request.json();
  const { email, password, displayName } = body as { email?: string; password?: string; displayName?: string };

  if (!email || !EMAIL_PATTERN.test(email)) {
    return NextResponse.json({ error: "כתובת אימייל לא תקינה" }, { status: 400 });
  }
  if (!password) {
    return NextResponse.json({ error: "הסיסמה חייבת להכיל לפחות 8 תווים" }, { status: 400 });
  }
  const passwordError = validatePasswordStrength(password);
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "כתובת האימייל הזו כבר רשומה במערכת" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({ data: { email, passwordHash, displayName: displayName || null, role: "client" } });

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
