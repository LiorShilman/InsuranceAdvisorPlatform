"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Coverage } from "@insurance-advisor/domain";
import { formatExact } from "../components/result-card";
import { computeDeduplication, type ApiCoverage } from "../../lib/compute-dedup";

/**
 * Real management UI for existing policies (PRD §18's `Coverage` entity) —
 * until now that table only ever held `packages/test-fixtures` data, so
 * `CoverageDeduplicationEngine` (implemented and tested since Milestone 4)
 * could only ever run against the 5 fixed personas on `/`, never against
 * anything a real user entered. This closes that gap and feeds `/report`'s
 * §11 section, which previously said so explicitly instead of being
 * silently empty (same "unknown stays unknown" discipline as elsewhere).
 */

const CATEGORY_LABELS: Record<Coverage["category"], string> = {
  life: "ביטוח חיים",
  disability: "אבדן כושר עבודה",
  critical_illness: "מחלות קשות",
  health: "בריאות פרטי",
  ltc: "סיעודי",
  personal_accident: "תאונות אישיות",
};

const BENEFICIARY_LABELS: Record<NonNullable<Coverage["beneficiaryType"]>, string> = {
  person: "אדם פרטי / המשפחה",
  lender: "גוף מלווה (משכנתה)",
  estate: "עיזבון",
  other: "אחר",
};

type FormState = {
  category: Coverage["category"];
  subtype: string;
  beneficiaryType: "" | NonNullable<Coverage["beneficiaryType"]>;
  amount: string;
  monthlyBenefit: string;
  startDate: string;
  endDate: string;
  notes: string;
};

const EMPTY_FORM: FormState = {
  category: "life",
  subtype: "",
  beneficiaryType: "",
  amount: "",
  monthlyBenefit: "",
  startDate: "",
  endDate: "",
  notes: "",
};

export default function CoveragesPage() {
  const [clientProfileId, setClientProfileId] = useState<string | null>(null);
  const [primaryPersonId, setPrimaryPersonId] = useState<string | null>(null);
  const [coverages, setCoverages] = useState<ApiCoverage[] | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const profileRes = await fetch("/api/profile");
      const profile = (await profileRes.json()) as { clientProfileId: string; primaryPersonId: string };
      if (cancelled) return;
      setClientProfileId(profile.clientProfileId);
      setPrimaryPersonId(profile.primaryPersonId);
      await reload(profile.clientProfileId);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function reload(profileId: string) {
    const res = await fetch(`/api/coverages?clientProfileId=${profileId}`);
    const { coverages: rows } = (await res.json()) as { coverages: ApiCoverage[] };
    setCoverages(rows);
  }

  async function handleAdd() {
    setError(null);
    if (!clientProfileId || !primaryPersonId) return;
    if (!form.subtype.trim()) {
      setError("יש למלא תיאור/ספק לפוליסה.");
      return;
    }
    const amount = form.amount === "" ? undefined : Number(form.amount);
    const monthlyBenefit = form.monthlyBenefit === "" ? undefined : Number(form.monthlyBenefit);
    if (amount === undefined && monthlyBenefit === undefined) {
      setError("יש למלא סכום חד-פעמי או קצבה חודשית (לפחות אחד).");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/coverages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientProfileId,
          category: form.category,
          subtype: form.subtype.trim(),
          insuredPersonId: primaryPersonId,
          beneficiaryType: form.beneficiaryType || undefined,
          amount,
          monthlyBenefit,
          startDate: form.startDate || undefined,
          endDate: form.endDate || undefined,
          notes: form.notes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        setError(body.error ?? "שמירה נכשלה.");
        return;
      }
      setForm(EMPTY_FORM);
      await reload(clientProfileId);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, subtype: string) {
    if (!clientProfileId) return;
    // Irreversible — this app has no undo/trash (§34 real audit trail doesn't
    // exist yet) — a plain confirm() is the right amount of ceremony here,
    // not a full modal component just for this one destructive action.
    if (!window.confirm(`למחוק את הפוליסה "${subtype}"? לא ניתן לשחזר.`)) return;
    await fetch(`/api/coverages?id=${id}`, { method: "DELETE" });
    await reload(clientProfileId);
  }

  const dedup = useMemo(() => (coverages ? computeDeduplication(coverages) : null), [coverages]);

  return (
    <main>
      <h1>פוליסות קיימות ובדיקת כפילויות</h1>
      <p className="subtitle">
        הזן כאן כל פוליסת ביטוח קיימת שלך — הנתונים נשמרים באמת ונבדקים אוטומטית לאיתור חפיפות אפשריות בין פוליסות.
        אותם נתונים מוצגים גם ב<Link href="/report">דוח המלא</Link>.
      </p>

      <section className="wizard-card" style={{ margin: "8px 0 24px", maxWidth: "none" }}>
        <h2 className="wizard-question" style={{ fontSize: "1.05rem" }}>
          הוספת פוליסה קיימת
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 12 }}>
          <label>
            <div className="wizard-help" style={{ margin: "0 0 4px" }}>
              סוג כיסוי
            </div>
            <select
              className="form-input"
              style={{ width: "100%", padding: "10px 12px", borderRadius: "var(--radius-md)" }}
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as Coverage["category"] }))}
            >
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <div className="wizard-help" style={{ margin: "0 0 4px" }}>
              ספק / תיאור *
            </div>
            <input
              className="form-input"
              style={{ width: "100%", padding: "10px 12px", borderRadius: "var(--radius-md)" }}
              value={form.subtype}
              onChange={(e) => setForm((f) => ({ ...f, subtype: e.target.value }))}
              placeholder='למשל "מגדל — ריסק פרט"'
            />
          </label>

          <label>
            <div className="wizard-help" style={{ margin: "0 0 4px" }}>
              מוטב
            </div>
            <select
              className="form-input"
              style={{ width: "100%", padding: "10px 12px", borderRadius: "var(--radius-md)" }}
              value={form.beneficiaryType}
              onChange={(e) => setForm((f) => ({ ...f, beneficiaryType: e.target.value as FormState["beneficiaryType"] }))}
            >
              <option value="">לא צוין</option>
              {Object.entries(BENEFICIARY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <div className="wizard-help" style={{ margin: "0 0 4px" }}>
              סכום חד-פעמי (₪)
            </div>
            <input
              type="text"
              inputMode="decimal"
              className="form-input"
              style={{ width: "100%", padding: "10px 12px", borderRadius: "var(--radius-md)" }}
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            />
          </label>

          <label>
            <div className="wizard-help" style={{ margin: "0 0 4px" }}>
              קצבה חודשית (₪)
            </div>
            <input
              type="text"
              inputMode="decimal"
              className="form-input"
              style={{ width: "100%", padding: "10px 12px", borderRadius: "var(--radius-md)" }}
              value={form.monthlyBenefit}
              onChange={(e) => setForm((f) => ({ ...f, monthlyBenefit: e.target.value }))}
            />
          </label>

          <label>
            <div className="wizard-help" style={{ margin: "0 0 4px" }}>
              תחילת תוקף
            </div>
            <input
              type="date"
              className="form-input"
              style={{ width: "100%", padding: "10px 12px", borderRadius: "var(--radius-md)" }}
              value={form.startDate}
              onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
            />
          </label>

          <label>
            <div className="wizard-help" style={{ margin: "0 0 4px" }}>
              סיום תוקף (אם ידוע)
            </div>
            <input
              type="date"
              className="form-input"
              style={{ width: "100%", padding: "10px 12px", borderRadius: "var(--radius-md)" }}
              value={form.endDate}
              onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
            />
          </label>
        </div>

        {error && (
          <p className="missing" style={{ color: "var(--danger)" }}>
            {error}
          </p>
        )}

        <button type="button" className="btn btn-primary" disabled={saving || !clientProfileId} onClick={handleAdd}>
          {saving ? "שומר..." : "+ הוסף פוליסה"}
        </button>
      </section>

      <section className="card">
        <div className="card-header">
          <span className="card-icon" aria-hidden="true">
            📋
          </span>
          <h2>פוליסות שהוזנו ({coverages?.length ?? 0})</h2>
        </div>

        {!coverages ? (
          <p style={{ color: "var(--muted)" }}>טוען...</p>
        ) : coverages.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>עדיין לא הוזנו פוליסות. הוסף למעלה כדי לאפשר בדיקת כפילויות אמיתית.</p>
        ) : (
          <table className="trace">
            <thead>
              <tr>
                <th style={{ textAlign: "right" }}>קטגוריה</th>
                <th style={{ textAlign: "right" }}>ספק/תיאור</th>
                <th style={{ textAlign: "right" }}>סכום</th>
                <th style={{ textAlign: "right" }}>מוטב</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {coverages.map((c) => (
                <tr key={c.id}>
                  <td>{CATEGORY_LABELS[c.category]}</td>
                  <td>{c.subtype}</td>
                  <td className="amount">
                    {c.amount !== undefined && formatExact(String(c.amount))}
                    {c.amount !== undefined && c.monthlyBenefit !== undefined && " · "}
                    {c.monthlyBenefit !== undefined && `${formatExact(String(c.monthlyBenefit))}/חודש`}
                  </td>
                  <td>{c.beneficiaryType ? BENEFICIARY_LABELS[c.beneficiaryType] : "—"}</td>
                  <td>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleDelete(c.id, c.subtype)}>
                      🗑 מחק
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card">
        <div className="card-header">
          <span className="card-icon" aria-hidden="true">
            🔎
          </span>
          <h2>בדיקת כפילויות</h2>
        </div>
        {!dedup || (coverages && coverages.length < 2) ? (
          <p style={{ color: "var(--muted)" }}>נדרשות לפחות 2 פוליסות כדי לבדוק חפיפה ביניהן.</p>
        ) : dedup.flags.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>לא נמצאה חפיפה חשודה בין הפוליסות שהוזנו.</p>
        ) : (
          dedup.flags.map((f) => (
            <div key={`${f.coverageIdA}-${f.coverageIdB}`} className="missing" style={{ marginBottom: 6 }}>
              {f.message} (ניקוד חפיפה: {f.duplicateScore})
            </div>
          ))
        )}
      </section>
    </main>
  );
}
