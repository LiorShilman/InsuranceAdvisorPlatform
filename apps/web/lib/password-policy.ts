/**
 * Password-complexity check that needs no external service (no breach-list
 * API, no email) — see docs/ASSUMPTIONS.md and the 2026-09-11 auth-hardening
 * entry in docs/DECISIONS.md for why this is the deliberately-scoped slice.
 * Real breach-list checking (e.g. Have I Been Pwned's k-anonymity API) is a
 * later improvement, not implemented here.
 */

const MIN_LENGTH = 8;

// A short, deliberately small blocklist of passwords common enough that
// meeting the length+letter+digit rule alone wouldn't stop them.
const COMMON_PASSWORDS = new Set([
  "password", "password1", "password123", "12345678", "123456789",
  "1234567890", "qwerty123", "qwertyuiop", "letmein1", "welcome1",
  "admin1234", "iloveyou1", "abc123456", "passw0rd", "p@ssw0rd",
  "football1", "monkey123", "dragon123", "master123", "michael1",
]);

export function validatePasswordStrength(password: string): string | null {
  if (password.length < MIN_LENGTH) {
    return "הסיסמה חייבת להכיל לפחות 8 תווים";
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return "הסיסמה חייבת להכיל גם אות וגם ספרה";
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return "הסיסמה נפוצה מדי ולא בטוחה — בחר/י סיסמה ייחודית יותר";
  }
  return null;
}
