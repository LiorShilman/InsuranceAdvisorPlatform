/**
 * `packages/test-fixtures`' `name`/`description` fields are deliberately
 * English/technical — `name` is a stable identifier real test code looks
 * up by (`fixtures.test.ts`: `f.name === "persona_e_prd_worked_example"`),
 * and `description` documents which PRD §5 persona a fixture represents,
 * for developers reading the source. Neither was ever meant to be shown
 * to a user directly — but `app/page.tsx` did exactly that (persona
 * accordion titles literally read "persona_a_family_with_mortgage", and
 * every avatar showed the same "p" initial, since every fixture name
 * starts with "persona_"). Same class of bug as the health-module
 * question text and the report's raw "divorced" value — see
 * docs/DECISIONS.md. This is the Hebrew display layer, keyed by the
 * fixture's real `name` so the underlying identifier stays untouched.
 */
export const PERSONA_DISPLAY: Record<string, { name: string; description: string }> = {
  persona_a_family_with_mortgage: {
    name: "משפחה עם משכנתה",
    description: "זוג שכיר עם שני ילדים, משכנתה, וביטוח חיים קיים בסיסי (PRD §5, פרסונה A).",
  },
  persona_b_self_employed_single: {
    name: "עצמאי רווק",
    description: "עצמאי, רווק, ללא תלויים, ללא כיסוי ביטוחי קיים, הכנסה לא סדירה (PRD §5, פרסונה B).",
  },
  persona_c_young_couple_planning_family: {
    name: "זוג צעיר המתכנן משפחה",
    description: "זוג נשוי צעיר, טרם הביא ילדים, כיסוי מודולי בריאות לא ידוע (PRD §5, פרסונה C).",
  },
  persona_d_near_retiree: {
    name: "זוג לקראת פרישה",
    description: "זוג לקראת פרישה, נכסים גבוהים, דגש על יכולת מימון עצמי לסיעוד (PRD §5, פרסונה D).",
  },
  persona_e_prd_worked_example: {
    name: 'דוגמה מלאה מהפרוד"ד',
    description: 'משחזר במדויק את הדוגמה המלאה מסעיף 57 בפרוד"ד (גילאים 40/38, שני ילדים, משכנתה).',
  },
};

/** Falls back to the raw fixture name/description if a new fixture is ever added without a translation — visible-but-ugly beats silently missing, same "unknown stays unknown" discipline as everywhere else. */
export function personaDisplay(fixtureName: string, fixtureDescription: string): { name: string; description: string } {
  return PERSONA_DISPLAY[fixtureName] ?? { name: fixtureName, description: fixtureDescription };
}
