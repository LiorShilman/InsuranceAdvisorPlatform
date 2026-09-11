import { OAuth2Client } from "google-auth-library";

/**
 * Server-side verification of the Google Identity Services ID token the
 * client sends after a successful Google Sign-In. Unlike the naive
 * client-side-only JWT decode elsewhere on this machine
 * (ls-financial-advisor's google-sso.component.ts — trusts the token
 * without checking its signature), this actually verifies the signature
 * and audience against Google's own public keys before trusting anything
 * in the payload. No client secret is needed for this flow — verifying an
 * ID token only needs the client ID (as the expected `aud`).
 */

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

let client: OAuth2Client | null = null;
function getClient(): OAuth2Client {
  if (!client) client = new OAuth2Client(GOOGLE_CLIENT_ID);
  return client;
}

export type GoogleIdentity = {
  googleId: string;
  email: string;
  emailVerified: boolean;
  displayName: string | null;
};

/** Verifies the ID token's signature/audience/expiry. Returns null on any failure — callers should treat that as "reject the sign-in", not throw. */
export async function verifyGoogleIdToken(credential: string): Promise<GoogleIdentity | null> {
  if (!GOOGLE_CLIENT_ID) return null;
  try {
    const ticket = await getClient().verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email) return null;
    return {
      googleId: payload.sub,
      email: payload.email,
      emailVerified: payload.email_verified ?? false,
      displayName: payload.name ?? null,
    };
  } catch {
    return null;
  }
}
