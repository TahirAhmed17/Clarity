"use client";

import { useState } from "react";

export type ValueFormat = "integer" | "hours" | "decimal";

const FORMATTERS: Record<ValueFormat, (v: number) => string> = {
  integer: (v) => Math.round(v).toLocaleString("en-GB"),
  hours: (v) => (v / 60).toFixed(1),
  decimal: (v) => v.toFixed(1),
};

export interface DailyPoint {
  day: string;
  value: number;
}

/**
 * One wearable metric per chart (single series, title names it, so no legend; one y-axis).
 * Bars for daily totals, a line for daily averages. A dashed 7-day-average reference line is
 * direct-labelled. Every mark has a hover/focus tooltip, and a table view is one click away.
 */
export function DailyChart({
  title,
  points,
  kind,
  format,
  unitLabel,
}: {
  title: string;
  points: DailyPoint[];
  kind: "bar" | "line";
  format: ValueFormat;
  unitLabel: string;
}) {
  const fmt = FORMATTERS[format];
  const [active, setActive] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);
  if (points.length === 0) return null;

  const W = 360;
  const H = 150;
  const m = { l: 36, r: 8, t: 14, b: 22 };
  const vals = points.map((p) => p.value);
  const last7 = vals.slice(-7);
  const avg = last7.reduce((a, b) => a + b, 0) / last7.length;
  const minV = kind === "bar" ? 0 : Math.min(...vals) * 0.9;
  const maxV = Math.max(...vals, avg) * 1.08;
  const ix = (i: number) => m.l + (i + 0.5) * ((W - m.l - m.r) / points.length);
  const y = (v: number) => H - m.b - ((v - minV) / (maxV - minV || 1)) * (H - m.t - m.b);
  const barW = Math.max(4, (W - m.l - m.r) / points.length - 2); // 2px surface gap between bars
  const ticks = [minV, (minV + maxV) / 2, maxV];
  const short = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  const a = active !== null ? points[active] : null;

  return (
    <figure className="rounded-[var(--radius-card)] bg-white p-4 ring-1 ring-line">
      <figcaption className="mb-1 flex items-baseline justify-between gap-3">
        <span className="font-semibold text-ink">{title}</span>
        <button type="button" onClick={() => setAsTable((t) => !t)} className="text-xs font-medium text-teal-ink underline decoration-teal/40 underline-offset-2">
          {asTable ? "Show chart" : "Show table"}
        </button>
      </figcaption>
      <p className="mb-2 text-sm text-ink-soft">
        7-day average <span className="font-display text-lg text-ink tabular-nums">{fmt(avg)}</span> {unitLabel}
      </p>

      {asTable ? (
        <div className="max-h-48 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-ink-faint">
              <tr>
                <th className="py-1 font-medium">Day</th>
                <th className="py-1 text-right font-medium">{unitLabel}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line tabular-nums">
              {points.map((p) => (
                <tr key={p.day}>
                  <td className="py-1">{short(p.day)}</td>
                  <td className="py-1 text-right">{fmt(p.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible" role="img" aria-label={`${title}, last ${points.length} days. 7-day average ${fmt(avg)} ${unitLabel}.`}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} stroke="var(--color-chart-grid)" strokeWidth={1} />
                <text x={m.l - 6} y={y(t) + 3} textAnchor="end" className="fill-ink-faint text-[10px] tabular-nums">
                  {fmt(t)}
                </text>
              </g>
            ))}
            {kind === "bar"
              ? points.map((p, i) => {
                  const top = y(p.value);
                  const h = Math.max(1, H - m.b - top);
                  const r = Math.min(4, barW / 2, h); // 4px rounded data-end, square at the baseline
                  const x0 = ix(i) - barW / 2;
                  return (
                    <path
                      key={p.day}
                      d={`M${x0},${H - m.b} V${top + r} Q${x0},${top} ${x0 + r},${top} H${x0 + barW - r} Q${x0 + barW},${top} ${x0 + barW},${top + r} V${H - m.b} Z`}
                      fill="var(--color-chart-mark)"
                      opacity={active === null || active === i ? 1 : 0.45}
                    />
                  );
                })
              : (
                <>
                  <path
                    d={points.map((p, i) => `${i ? "L" : "M"}${ix(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ")}
                    fill="none"
                    stroke="var(--color-chart-mark)"
                    strokeWidth={2}
                    strokeLinejoin="round"
                  />
                  {points.map((p, i) => (
                    <circle key={p.day} cx={ix(i)} cy={y(p.value)} r={active === i ? 5 : 3.5} fill="var(--color-chart-mark)" stroke="white" strokeWidth={2} />
                  ))}
                </>
              )}
            <line x1={m.l} x2={W - m.r} y1={y(avg)} y2={y(avg)} stroke="var(--color-ink-soft)" strokeWidth={1.25} strokeDasharray="4 3" />
            <text x={W - m.r} y={y(avg) - 4} textAnchor="end" className="fill-ink-soft text-[10px]">
              7-day avg
            </text>
            {[0, points.length - 1].map((i) => (
              <text key={i} x={ix(i)} y={H - 6} textAnchor={i === 0 ? "start" : "end"} className="fill-ink-faint text-[10px]">
                {short(points[i].day)}
              </text>
            ))}
            {active !== null && <line x1={ix(active)} x2={ix(active)} y1={m.t} y2={H - m.b} stroke="var(--color-ink-faint)" strokeWidth={1} />}
            {points.map((p, i) => (
              <rect
                key={`hit-${p.day}`}
                x={ix(i) - (W - m.l - m.r) / points.length / 2}
                y={m.t}
                width={(W - m.l - m.r) / points.length}
                height={H - m.t - m.b}
                fill="transparent"
                tabIndex={0}
                aria-label={`${short(p.day)}: ${fmt(p.value)} ${unitLabel}`}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
              />
            ))}
          </svg>
          {a && (
            <div
              role="tooltip"
              className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg bg-ink px-2.5 py-1 text-xs whitespace-nowrap text-white"
              style={{ left: `${(ix(active!) / W) * 100}%` }}
            >
              {short(a.day)}: {fmt(a.value)} {unitLabel}
            </div>
          )}
        </div>
      )}
    </figure>
  );
}
