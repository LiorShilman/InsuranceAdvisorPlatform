export * from "./types.js";
export * from "./persona-a-family-with-mortgage.js";
export * from "./persona-b-self-employed-single.js";
export * from "./persona-c-young-couple-planning-family.js";
export * from "./persona-d-near-retiree.js";
export * from "./persona-e-prd-worked-example.js";

import { PERSONA_A_FAMILY_WITH_MORTGAGE } from "./persona-a-family-with-mortgage.js";
import { PERSONA_B_SELF_EMPLOYED_SINGLE } from "./persona-b-self-employed-single.js";
import { PERSONA_C_YOUNG_COUPLE_PLANNING_FAMILY } from "./persona-c-young-couple-planning-family.js";
import { PERSONA_D_NEAR_RETIREE } from "./persona-d-near-retiree.js";
import { PERSONA_E_PRD_WORKED_EXAMPLE } from "./persona-e-prd-worked-example.js";
import type { HouseholdFixture } from "./types.js";

export const ALL_HOUSEHOLD_FIXTURES: HouseholdFixture[] = [
  PERSONA_A_FAMILY_WITH_MORTGAGE,
  PERSONA_B_SELF_EMPLOYED_SINGLE,
  PERSONA_C_YOUNG_COUPLE_PLANNING_FAMILY,
  PERSONA_D_NEAR_RETIREE,
  PERSONA_E_PRD_WORKED_EXAMPLE,
];
