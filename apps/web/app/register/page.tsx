"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GoogleSignInButton } from "../components/google-sign-in-button";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleGoogleCredential = useCallback(
    async (credential: string) => {
      setError(null);
      const res = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        setError(body.error ?? "ההרשמה עם Google נכשלה");
        return;
      }
      router.push("/questionnaire");
      router.refresh();
    },
    [router]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("הסיסמאות אינן תואמות");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        setError(body.error ?? "ההרשמה נכשלה");
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
      <h1>הרשמה</h1>
      <form onSubmit={handleSubmit} className="wizard-card" style={{ maxWidth: 420 }}>
        <label style={{ display: "block", marginBottom: 14 }}>
          <div className="wizard-help" style={{ margin: "0 0 4px" }}>
            אימייל
          </div>
          <input type="email" required autoFocus className="form-input" style={{ width: "100%", padding: "10px 12px", borderRadius: "var(--radius-md)" }} value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label style={{ display: "block", marginBottom: 14 }}>
          <div className="wizard-help" style={{ margin: "0 0 4px" }}>
            סיסמה (לפחות 8 תווים, כולל אות וספרה)
          </div>
          <input type="password" required minLength={8} className="form-input" style={{ width: "100%", padding: "10px 12px", borderRadius: "var(--radius-md)" }} value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <label style={{ display: "block", marginBottom: 18 }}>
          <div className="wizard-help" style={{ margin: "0 0 4px" }}>
            אימות סיסמה
          </div>
          <input type="password" required className="form-input" style={{ width: "100%", padding: "10px 12px", borderRadius: "var(--radius-md)" }} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
        </label>
        {error && (
          <p className="missing" style={{ color: "var(--danger)" }}>
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary" disabled={submitting} style={{ width: "100%" }}>
          {submitting ? "נרשם..." : "הרשמה"}
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "18px 0" }}>
          <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
          <span className="wizard-help" style={{ margin: 0 }}>
            או
          </span>
          <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
        </div>
        <GoogleSignInButton onCredential={handleGoogleCredential} onError={setError} />
        <p style={{ marginTop: 14, fontSize: "0.9rem" }}>
          כבר יש לך חשבון?{" "}
          <Link href="/login" style={{ color: "var(--brand)" }}>
            התחברות
          </Link>
        </p>
      </form>
    </main>
  );
}
