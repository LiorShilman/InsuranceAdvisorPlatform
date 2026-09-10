/**
 * The educational-mode disclaimer, shown once per page — previously
 * copy-pasted identically across 4 pages, each copy ending in a literal
 * "(PRD §4.3, Educational mode)" citation. User: internal spec section
 * numbers reading as visible UI text look like developer notes, not a
 * finished product — same complaint applied to every other PRD/Milestone
 * citation across the app; see docs/DECISIONS.md. Extracted to one
 * component so the disclaimer only needs fixing (or updating) in one
 * place going forward.
 */
export function EducationalModeBanner() {
  return (
    <div className="banner">
      זהו ניתוח ראשוני להערכת צרכי הביטוח שלך, ואינו מהווה ייעוץ או המלצה מחייבת — יש להתייעץ עם בעל רישיון מתאים לפני
      קבלת החלטה סופית.
    </div>
  );
}
