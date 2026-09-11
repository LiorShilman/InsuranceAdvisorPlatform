"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        setError(body.error ?? "ההתחברות נכשלה");
        return;
      }
      router.push("/questionnaire");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main>
      <h1>התחברות</h1>
      <form onSubmit={handleSubmit} className="wizard-card" style={{ maxWidth: 420 }}>
        <label style={{ display: "block", marginBottom: 14 }}>
          <div className="wizard-help" style={{ margin: "0 0 4px" }}>
            אימייל
          </div>
          <input type="email" required autoFocus className="form-input" style={{ width: "100%", padding: "10px 12px", borderRadius: "var(--radius-md)" }} value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label style={{ display: "block", marginBottom: 18 }}>
          <div className="wizard-help" style={{ margin: "0 0 4px" }}>
            סיסמה
          </div>
          <input type="password" required className="form-input" style={{ width: "100%", padding: "10px 12px", borderRadius: "var(--radius-md)" }} value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && (
          <p className="missing" style={{ color: "var(--danger)" }}>
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary" disabled={submitting} style={{ width: "100%" }}>
          {submitting ? "מתחבר..." : "התחברות"}
        </button>
        <p style={{ marginTop: 14, fontSize: "0.9rem" }}>
          עדיין אין לך חשבון?{" "}
          <Link href="/register" style={{ color: "var(--brand)" }}>
            הרשמה
          </Link>
        </p>
      </form>
    </main>
  );
}
