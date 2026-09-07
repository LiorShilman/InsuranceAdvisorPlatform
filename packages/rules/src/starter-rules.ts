import type { Rule } from "./rule.js";

/**
 * A small starter rule set for the life category, using fact keys from the
 * PRD §8 examples. Enough to exercise SimpleRuleEngine end-to-end; nowhere
 * near the full rule catalog a real deployment would need (that's ongoing
 * config work, not a one-time code change — see PRD §11.1/§51).
 */
export const STARTER_LIFE_RULES: Rule[] = [
  {
    id: "LIFE_DEPENDENTS_001",
    version: 1,
    category: "life",
    when: {
      all: [{ fact: "household.dependents.count", operator: ">", value: 0 }],
    },
    effect: { needStatus: "required_to_evaluate" },
    reason: "קיימים תלויים כלכליים — נדרשת הערכת צורך ביטוח חיים.",
  },
  {
    id: "LIFE_MORTGAGE_001",
    version: 1,
    category: "life",
    when: {
      all: [{ fact: "debt.mortgage.balance", operator: ">", value: 0 }],
    },
    effect: { needStatus: "recommended" },
    reason: "קיימת יתרת משכנתה — נדרשת בדיקת כיסוי לפירעון החוב במקרה פטירה.",
  },
  {
    id: "LIFE_NO_DEPENDENTS_NO_DEBT_001",
    version: 1,
    category: "life",
    when: {
      all: [
        { fact: "household.dependents.count", operator: "==", value: 0 },
        { fact: "debt.mortgage.balance", operator: "==", value: 0 },
      ],
    },
    effect: { needStatus: "optional" },
    reason: "אין תלויים כלכליים ואין משכנתה — ביטוח חיים הוא שיקול אישי (עיזבון/הוצאות קבורה), לא צורך מחייב.",
  },
];
