import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

/**
 * Real, revocable, cookie-based sessions — replaces `lib/demo-profile.ts`'s
 * single hardcoded user (see docs/DECISIONS.md). Deliberately NOT
 * Next.js Edge Middleware for route protection: Prisma's query engine
 * needs the Node.js runtime, and Edge Middleware runs on the Edge
 * runtime by default — trying to validate a session there would mean
 * either a second, unvalidated "cookie merely exists" check (weaker) or
 * Prisma Accelerate/Data Proxy (a hosted dependency this project doesn't
 * have). Instead, every page's own existing `/api/profile` fetch (already
 * the first thing each page does) now doubles as the auth check: a 401
 * response sends the client to `/login` — no separate middleware layer,
 * full server-side validation, same request that was happening anyway.
 */

export const SESSION_COOKIE = "session_id";
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// Account-lockout policy (2026-09-11 auth hardening, docs/DECISIONS.md):
// 5 consecutive failed attempts locks the account for 15 minutes. This is
// per-account (by email), a second layer beneath the per-IP rate limit in
// lib/rate-limit.ts.
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string): Promise<{ id: string; expiresAt: Date }> {
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  return prisma.authSession.create({ data: { userId, expiresAt } });
}

/** Best-effort — logging out should succeed from the client's point of view even if the row was already gone. */
export async function deleteSession(sessionId: string): Promise<void> {
  await prisma.authSession.delete({ where: { id: sessionId } }).catch(() => {});
}

export type SessionUser = { id: string; email: string; displayName: string | null };

/** Looks up the session cookie value against the DB — real revocation (deleting the row logs the user out everywhere), not just a signature check on a client-held token. Opportunistically cleans up an expired session. */
export async function getUserFromSessionId(sessionId: string | undefined): Promise<SessionUser | null> {
  if (!sessionId) return null;
  const session = await prisma.authSession.findUnique({ where: { id: sessionId }, include: { user: true } });
  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await deleteSession(session.id);
    return null;
  }
  return { id: session.user.id, email: session.user.email, displayName: session.user.displayName };
}

/**
 * Route Handlers here are typed as plain `Request` (matching the existing
 * `/api/facts`/`/api/profile` style) rather than `NextRequest`, so this
 * parses the `Cookie` header by hand instead of relying on
 * `NextRequest.cookies`. One shared helper instead of repeating the
 * regex in every route.
 */
export function getSessionCookieValue(request: Request): string | undefined {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader.match(new RegExp(`(?:^|; )${SESSION_COOKIE}=([^;]+)`));
  return match?.[1];
}

/** Convenience: reads the cookie from the request and resolves straight to the session user (or null). */
export async function getCurrentUser(request: Request): Promise<SessionUser | null> {
  return getUserFromSessionId(getSessionCookieValue(request));
}

/** True if this account is currently locked out from a prior run of failed logins. */
export function isLockedOut(user: { lockedUntil: Date | null }): boolean {
  return user.lockedUntil !== null && user.lockedUntil > new Date();
}

/**
 * Call after a failed password check. Increments the counter and, once it
 * reaches the threshold, sets lockedUntil — resetting the counter so a
 * lockout is always exactly MAX_FAILED_ATTEMPTS more failures away, not a
 * one-time trip.
 */
export async function recordFailedLogin(userId: string): Promise<void> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { failedLoginAttempts: { increment: 1 } },
  });
  if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
    await prisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: 0, lockedUntil: new Date(Date.now() + LOCKOUT_DURATION_MS) },
    });
  }
}

/** Call after a successful login — clears any accumulated failure count. */
export async function resetFailedLogins(userId: string): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { failedLoginAttempts: 0, lockedUntil: null } });
}
