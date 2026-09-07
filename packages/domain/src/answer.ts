import type { BaseEntity } from "./base.js";

/**
 * A raw answer captured during the questionnaire session (PRD §26.1 Answer,
 * §31 questionnaire endpoints). References a Question by id only —
 * `packages/questionnaire` owns the Question schema itself, so `domain`
 * does not need to depend on it (keeps the package graph acyclic).
 */
export type Answer = BaseEntity & {
  sessionId: string;
  questionId: string;
  questionVersion: number;
  rawValue: unknown;
  answeredAt: string;
};

export type QuestionnaireSession = BaseEntity & {
  clientProfileId: string;
  questionnaireVersion: string;
  status: "in_progress" | "completed" | "abandoned";
  completionScore: number;
};
