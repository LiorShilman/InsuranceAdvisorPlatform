"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const LINKS = [
  { href: "/", label: "5 פרופילים", icon: "🗂️" },
  { href: "/questionnaire", label: "שאלון אישי", icon: "📝" },
  { href: "/coverages", label: "פוליסות קיימות", icon: "📋" },
  { href: "/scenarios", label: "סימולטור תרחישים", icon: "🎛️" },
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
  const router = useRouter();
  const [theme, setTheme] = useState<ThemeChoice>("system");
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Per-viewer preference only — never affects other visitors, so localStorage is fine here.
  useEffect(() => {
    const saved = window.localStorage.getItem("theme") as ThemeChoice | null;
    if (saved === "light" || saved === "dark" || saved === "system") {
      setTheme(saved);
      applyTheme(saved);
    }
  }, []);

  // Re-checks on every navigation (pathname change) so signing in/out on one
  // page updates the nav immediately, without a full reload.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : { user: null }))
      .then((body: { user: { email: string } | null }) => {
        if (!cancelled) setUserEmail(body.user?.email ?? null);
      })
      .catch(() => {
        if (!cancelled) setUserEmail(null);
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  async function handleSignOut() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setUserEmail(null);
    router.push("/login");
    router.refresh();
  }

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
            <Link key={link.href} href={link.href} className={`app-nav-link${pathname === link.href ? " active" : ""}`} title={link.label}>
              <span aria-hidden="true">{link.icon}</span>
              <span className="app-nav-link-label">{link.label}</span>
            </Link>
          ))}
          <button type="button" className="app-nav-link app-theme-toggle" onClick={cycleTheme} title={`ערכת נושא: ${themeLabel} (לחץ להחלפה)`}>
            <span aria-hidden="true">{themeIcon}</span>
            <span className="app-nav-link-label">{themeLabel}</span>
          </button>
          {userEmail ? (
            <button type="button" className="app-nav-link" onClick={handleSignOut} title={`מחובר/ת בתור ${userEmail} — לחץ להתנתקות`}>
              <span aria-hidden="true">👤</span>
              <span className="app-nav-link-label">התנתקות</span>
            </button>
          ) : (
            <Link href="/login" className={`app-nav-link${pathname === "/login" ? " active" : ""}`}>
              <span aria-hidden="true">👤</span>
              <span className="app-nav-link-label">התחברות</span>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
