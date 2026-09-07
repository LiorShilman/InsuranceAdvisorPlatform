import type { BaseEntity } from "./base.js";

/** PRD §35 — marketing consent is explicitly kept separate from service consent. */
export type ConsentType =
  | "terms"
  | "privacy"
  | "sensitive_data"
  | "document_processing"
  | "ai_processing"
  | "marketing";

export type Consent = BaseEntity & {
  userId: string;
  type: ConsentType;
  version: string;
  accepted: boolean;
  acceptedAt: string;
  ipHash?: string;
};
