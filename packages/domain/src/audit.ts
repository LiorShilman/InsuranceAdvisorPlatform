/**
 * PRD §36. AuditEvent is append-only and must be written from a path
 * separate from normal application endpoints (PRD rule of thumb in §36) —
 * that separation is an infrastructure/service concern for a later
 * milestone, not something the type itself can enforce.
 */
export type AuditActorType = "user" | "agent" | "system" | "admin";

export type AuditEvent = {
  id: string;
  actorType: AuditActorType;
  actorId?: string;

  action: string;
  entityType: string;
  entityId: string;

  beforeHash?: string;
  afterHash?: string;

  ruleEngineVersion?: string;
  createdAt: string;
};
