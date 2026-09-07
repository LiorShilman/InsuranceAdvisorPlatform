import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "תצוגה מקדימה — מנוע ביטוח חיים",
  description: "Preview only — Milestone 3 slice of the Insurance Advisor Platform.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
