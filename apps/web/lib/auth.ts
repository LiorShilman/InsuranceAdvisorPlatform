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
