import type { Fact } from "@insurance-advisor/shared";
import type { Question } from "./question.js";

/**
 * Named normalizer registry — PRD §7.1's `normalizer?: string` field
 * references one of these by name. Deliberately tiny; add more as real
 * questions need them rather than speculatively.
 */
const NORMALIZERS: Record<string, (raw: unknown) => unknown> = {
  trimString: (raw) => (typeof raw === "string" ? raw.trim() : raw),
  roundMoneyToShekel: (raw) => (typeof raw === "number" ? Math.round(raw) : raw),
};

function normalize(question: Question, rawValue: unknown): unknown {
  if (!question.normalizer) return rawValue;
  const fn = NORMALIZERS[question.normalizer];
  return fn ? fn(rawValue) : rawValue;
}

/**
 * Turns one answered Question into the Fact(s) it produces (PRD §8) — a
 * question can fan out into more than one fact key (`factsProduced`),
 * though every question in the starter bank here produces exactly one.
 * `source: "user"` + `verified: true`: unlike §30's free-text AI
 * extraction (which explicitly requires user confirmation before a
 * candidate fact is trusted), a direct questionnaire answer IS the
 * trusted value — there's no extra confirmation step for it in this
 * milestone.
 */
export function produceFacts(question: Question, rawValue: unknown, now: string = new Date().toISOString()): Fact[] {
  const value = normalize(question, rawValue);
  return question.factsProduced.map((key) => ({
    key,
    value,
    source: "user",
    confidence: 1,
    verified: true,
    effectiveDate: now,
  }));
}
