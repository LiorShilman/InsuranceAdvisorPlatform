import type { BaseEntity } from "./base.js";

/**
 * Aggregate root tying a user to their household/person/coverage data —
 * PRD §26.1 ClientProfile. Kept intentionally thin in Milestone 1: it's a
 * pointer, not a place to duplicate data that already lives on Household,
 * Person, Coverage, etc.
 */
export type ClientProfile = BaseEntity & {
  userId: string;
  primaryPersonId: string;
  spousePersonId?: string;
  householdId: string;
};

export type User = BaseEntity & {
  email: string;
  displayName?: string;
  role: "client" | "advisor" | "admin";
};
