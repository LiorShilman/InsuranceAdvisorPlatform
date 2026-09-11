"use client";

import { useState } from "react";

/**
 * PRD §29 "explain deterministic result", on demand — a button, not an
 * automatic call on page load, so visiting the report doesn't silently cost
 * an LLM call per category every time. The server (app/api/explain/route.ts)
 * recomputes the recommendation itself from this user's own saved Facts; the
 * client only ever tells it *which* category to explain.
 */
export function ExplainButton({ clientProfileId, category }: { clientProfileId: string; category: "life" | "disability" | "critical_illness" | "ltc" }) {
  const [state, setState] = useState<{ status: "idle" } | { status: "loading" } | { status: "done"; text: string } | { status: "error"; message: string }>({ status: "idle" });

  async function handleClick() {
    setState({ status: "loading" });
    try {
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientProfileId, category }),
      });
      const body = (await res.json()) as { explanation?: string; error?: string };
      if (!res.ok || !body.explanation) {
        setState({ status: "error", message: body.error ?? "יצירת ההסבר נכשלה" });
        return;
      }
      setState({ status: "done", text: body.explanation });
    } catch {
      setState({ status: "error", message: "יצירת ההסבר נכשלה — בדוק/י את החיבור לרשת" });
    }
  }

  if (state.status === "done") {
    return (
      <div className="banner" style={{ marginTop: 10 }}>
        <strong>הסבר בשפה פשוטה:</strong> {state.text}
      </div>
    );
  }

  return (
    <div style={{ marginTop: 10 }}>
      <button type="button" className="btn btn-sm" onClick={handleClick} disabled={state.status === "loading"}>
        {state.status === "loading" ? "מייצר הסבר..." : "💬 הסבר בשפה פשוטה"}
      </button>
      {state.status === "error" && (
        <p className="missing" style={{ marginTop: 6 }}>
          {state.message}
        </p>
      )}
    </div>
  );
}
