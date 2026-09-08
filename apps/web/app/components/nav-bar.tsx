"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "5 פרופילים", icon: "🗂️" },
  { href: "/questionnaire", label: "שאלון אישי", icon: "📝" },
  { href: "/report", label: "דוח מלא", icon: "📄" },
];

type ThemeChoice = "light" | "dark" | "system";

function applyTheme(choice: ThemeChoice) {
  if (choice === "system") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", choice);
  }
}

export function NavBar() {
  const pathname = usePathname();
  const [theme, setTheme] = useState<ThemeChoice>("system");

  // Per-viewer preference only — never affects other visitors, so localStorage is fine here.
  useEffect(() => {
    const saved = window.localStorage.getItem("theme") as ThemeChoice | null;
    if (saved === "light" || saved === "dark" || saved === "system") {
      setTheme(saved);
      applyTheme(saved);
    }
  }, []);

  function cycleTheme() {
    const next: ThemeChoice = theme === "system" ? "light" : theme === "light" ? "dark" : "system";
    setTheme(next);
    applyTheme(next);
    try {
      window.localStorage.setItem("theme", next);
    } catch {
      // best-effort — a blocked/private-mode localStorage shouldn't break theme switching for this session
    }
  }

  const themeIcon = theme === "light" ? "☀️" : theme === "dark" ? "🌙" : "🖥️";
  const themeLabel = theme === "light" ? "בהיר" : theme === "dark" ? "כהה" : "לפי המערכת";

  return (
    <header className="app-nav no-print">
      <div className="app-nav-inner">
        <Link href="/" className="app-brand">
          <span className="app-brand-mark">🛡️</span>
          <span>Insurance Advisor</span>
        </Link>
        <nav className="app-nav-links">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className={`app-nav-link${pathname === link.href ? " active" : ""}`}>
              <span aria-hidden="true">{link.icon}</span>
              {link.label}
            </Link>
          ))}
          <button type="button" className="app-nav-link" onClick={cycleTheme} title={`ערכת נושא: ${themeLabel} (לחץ להחלפה)`}>
            <span aria-hidden="true">{themeIcon}</span>
            {themeLabel}
          </button>
        </nav>
      </div>
    </header>
  );
}
