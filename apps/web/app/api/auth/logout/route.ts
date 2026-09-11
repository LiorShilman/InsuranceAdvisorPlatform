import { NextResponse } from "next/server";
import { deleteSession, getSessionCookieValue, SESSION_COOKIE } from "../../../../lib/auth";

export async function POST(request: Request) {
  const sessionId = getSessionCookieValue(request);
  if (sessionId) await deleteSession(sessionId);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", { path: "/", expires: new Date(0) });
  return response;
}
