/** Every persisted entity gets these — PRD §26.2 ("every table has id/created_at/updated_at"). */
export type BaseEntity = {
  id: string;
  createdAt: string;
  updatedAt: string;
};
