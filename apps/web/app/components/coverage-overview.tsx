/**
 * A single at-a-glance summary across all 4 gap-producing categories, at
 * the top of the report — previously you had to scroll through 4 full
 * cards to get this picture. Reuses the exact same `.gap-bar-track`/
 * `.gap-bar-existing` bar each ResultCard already renders per-category —
 * not a new visual language, just composed into one compact list.
 *
 * Deliberately a sequential (single-hue, magnitude) bar, not a
 * traffic-light-colored one: the job here is "compare magnitude across
 * categories," which is a sequential job per the dataviz skill's
 * choosing-a-form.md, and it sidesteps the whole red/green/amber
 * CVD-separation problem documented in docs/DECISIONS.md entirely — a
 * radar/spider chart was considered and rejected for the same reason
 * that table doesn't list it as a sanctioned form for any job.
 */
export function CoverageOverview(props: { rows: Array<{ key: string; icon: string; label: string; coverageRatio: number }> }) {
  const { rows } = props;
  return (
    <section className="card">
      <div className="card-header">
        <span className="card-icon" aria-hidden="true">
          🛡️
        </span>
        <h2>מבט־על על הכיסוי</h2>
      </div>
      {rows.map((row) => {
        const pct = Math.round(Math.min(1, Math.max(0, row.coverageRatio)) * 100);
        return (
          <div key={row.key} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <span style={{ width: 26, textAlign: "center" }} aria-hidden="true">
              {row.icon}
            </span>
            <span style={{ width: 130, fontSize: "0.85rem", color: "var(--muted)" }}>{row.label}</span>
            <div className="gap-bar-track" style={{ flex: 1, margin: 0 }} title={`מכוסה: ${pct}%`}>
              <div className="gap-bar-existing" style={{ width: `${pct}%` }} />
            </div>
            <span style={{ width: 42, textAlign: "left", fontSize: "0.85rem", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{pct}%</span>
          </div>
        );
      })}
    </section>
  );
}
