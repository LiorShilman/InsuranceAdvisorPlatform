import type { CalculationTraceLine } from "@insurance-advisor/shared";
import { formatExact } from "../../lib/format";

/**
 * PRD §24 Explainability — the exact example in the PRD is a waterfall
 * ("+1,420,000 Income replacement / +650,000 Mortgage / ... / -300,000
 * Existing cover / ------ / 1,850,000 Calculated gap"). `trace.lines`
 * already carries signed amounts (offsets are pushed as `.negate()`), so
 * summing every line's amountExact always equals the final result exactly
 * — the chart below is a direct visual rendering of the same numbers the
 * `<details>` table already shows, not a separate computation.
 *
 * Colors: dataviz skill's validate_palette.js — light mode reuses
 * --info/--danger's exact values (all checks pass, CVD ΔE 29.3); dark
 * mode needed new, more-saturated values (--info/--danger's dark values
 * are too light for a bar fill, failing the dark-mode lightness band) —
 * see --chart-positive/--chart-negative in globals.css and docs/DECISIONS.md.
 * Numbered bars (not full Hebrew labels) avoid fighting rotated RTL text
 * in a narrow card; the numbered legend below carries the real labels —
 * this doubles as the "identity isn't color-alone" reinforcement the
 * skill requires for a 2-color categorical chart, on top of each bar's
 * own native <title> tooltip.
 */

const CHART_HEIGHT = 200;
const TOP_PADDING = 28;
const BOTTOM_PADDING = 28;
const BAR_MAX_WIDTH = 24;

export function WaterfallChart(props: { lines: CalculationTraceLine[]; totalLabel: string; totalExact: string }) {
  const { lines, totalLabel, totalExact } = props;
  if (lines.length === 0) return null;

  const amounts = lines.map((l) => Number(l.amountExact));
  const cumulative = [0];
  for (const a of amounts) cumulative.push(cumulative[cumulative.length - 1] + a);
  const total = cumulative[cumulative.length - 1];

  const steps = amounts.length + 1; // +1 for the total bar
  const values = [...cumulative, 0, total]; // include the total bar's own span in the y-domain
  const yMin = Math.min(0, ...values);
  const yMax = Math.max(0, ...values);
  const yRange = yMax - yMin || 1;
  const plotHeight = CHART_HEIGHT - TOP_PADDING - BOTTOM_PADDING;

  function yFor(value: number): number {
    return TOP_PADDING + plotHeight * (1 - (value - yMin) / yRange);
  }

  // viewBox units, not real px — since the whole chart scales with its container width
  // (width="100%"), a true fixed-px cap would need a measured container width instead
  // of a viewBox; this caps bars relative to the slot instead, which stays close to the
  // spec's "never fill the slot" intent without that extra machinery.
  const slotWidthUnits = 400 / steps;
  const barWidth = Math.min(BAR_MAX_WIDTH, slotWidthUnits * 0.6);

  const zeroY = yFor(0);

  return (
    <div style={{ margin: "12px 0" }}>
      <svg viewBox={`0 0 400 ${CHART_HEIGHT}`} width="100%" height={CHART_HEIGHT} role="img" aria-label={`תרשים מפל: ${lines.map((l) => l.label).join(", ")}, סה"כ ${totalLabel}`}>
        {/* Zero baseline — recessive hairline, per marks-and-anatomy.md */}
        <line x1="0" y1={zeroY} x2="400" y2={zeroY} stroke="var(--border)" strokeWidth="1" />

        {lines.map((line, i) => {
          const from = cumulative[i];
          const to = cumulative[i + 1];
          const x = (i + 0.5) * (400 / steps);
          const isPositive = amounts[i] >= 0;
          const topY = yFor(Math.max(from, to));
          const bottomY = yFor(Math.min(from, to));
          const height = Math.max(1, bottomY - topY);
          const labelY = isPositive ? topY - 8 : bottomY + 16;

          return (
            <g key={line.key}>
              {/* Connector to the next bar's (or the total bar's) starting level — thin, recessive, never dashed. */}
              <line x1={x + barWidth / 2} y1={yFor(to)} x2={x + 400 / steps - barWidth / 2} y2={yFor(to)} stroke="var(--border)" strokeWidth="1" />
              <rect
                x={x - barWidth / 2}
                y={topY}
                width={barWidth}
                height={height}
                rx="4"
                fill={isPositive ? "var(--chart-positive)" : "var(--chart-negative)"}
              >
                {/* A single string child, not multiple JSX expressions — <title> is an
                    RCDATA element (like <textarea>/<style>), so the browser's native
                    HTML parser treats its content as literal text, never as markup or
                    comments. React relies on inserting <!-- --> comment markers between
                    sibling children to keep hydration matching order-independent, but
                    inside RCDATA those markers become part of the literal rendered text
                    on the very first server parse — a real, reproducible hydration
                    mismatch, not a cosmetic one (caught from a live console error). */}
                <title>{`${line.label}: ${formatExact(line.amountExact)}`}</title>
              </rect>
              <text x={x} y={labelY} textAnchor="middle" fontSize="10" fill="var(--muted)" fontWeight={700}>
                {i + 1}
              </text>
            </g>
          );
        })}

        {/* Total bar, from 0 — a distinct neutral color, per PRD §24's own "Calculated gap" summary line. */}
        {(() => {
          const x = (lines.length + 0.5) * (400 / steps);
          const topY = yFor(Math.max(0, total));
          const bottomY = yFor(Math.min(0, total));
          const height = Math.max(1, bottomY - topY);
          const labelY = total >= 0 ? topY - 8 : bottomY + 16;
          return (
            <g>
              <rect x={x - barWidth / 2} y={topY} width={barWidth} height={height} rx="4" fill="var(--chart-total)">
                <title>{`${totalLabel}: ${formatExact(totalExact)}`}</title>
              </rect>
              <text x={x} y={labelY} textAnchor="middle" fontSize="10" fill="var(--muted)" fontWeight={700}>
                {"="}
              </text>
            </g>
          );
        })()}
      </svg>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", fontSize: "0.78rem", color: "var(--muted)", marginTop: 4 }}>
        {lines.map((line, i) => (
          <span key={line.key}>
            <span
              aria-hidden="true"
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                borderRadius: 2,
                background: Number(line.amountExact) >= 0 ? "var(--chart-positive)" : "var(--chart-negative)",
                marginInlineEnd: 4,
              }}
            />
            {i + 1}. {line.label} ({formatExact(line.amountExact)})
          </span>
        ))}
        <span>
          <span aria-hidden="true" style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "var(--chart-total)", marginInlineEnd: 4 }} />
          {"= "}
          {totalLabel} ({formatExact(totalExact)})
        </span>
      </div>
    </div>
  );
}
