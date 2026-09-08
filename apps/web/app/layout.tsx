import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import "./globals.css";
import { NavBar } from "./components/nav-bar";

const heebo = Heebo({ subsets: ["hebrew", "latin"], variable: "--font-heebo" });

export const metadata: Metadata = {
  title: "Insurance Advisor Platform",
  description: "Insurance Needs Analysis Platform — PRD-driven implementation.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={heebo.variable}>
      <body>
        <NavBar />
        <div className="app-content">{children}</div>
      </body>
    </html>
  );
}
