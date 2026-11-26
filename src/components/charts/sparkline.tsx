"use client";

import { useState } from "react";

export interface SparkPoint {
  date: string;
  value: number;
  label: string;
}

/**
 * History of one biomarker (single series, so no legend). 2px line, 8px markers with a surface
 * ring, first and last values direct-labelled, hover/focus tooltip on every point.
 */
export function Sparkline({ points, unit, title }: { points: SparkPoint[]; unit: string; title: string }) {
  const [active, setActive] = useState<number | null>(null);
  if (points.length < 2) return null;
  const W = 240;
  const H = 64;
  const padX = 10;
  const padY = 14;
  const vals = points.map((p) => p.value);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const span = hi - lo || Math.abs(hi) * 0.2 || 1;
  const x = (i: number) => padX + (i / (points.length - 1)) * (W - padX * 2);
  const y = (v: number) => H - padY - ((v - lo) / span) * (H - padY * 2);
  const d = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const a = active !== null ? points[active] : null;

  return (
    <figure className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-16 w-full overflow-visible" role="img" aria-label={`${title}: ${points.map((p) => `${p.label} on ${p.date}`).join(", ")}`}>
        <line x1={padX} x2={W - padX} y1={H - 2} y2={H - 2} stroke="var(--color-chart-grid)" strokeWidth={1} />
        <path d={d} fill="none" stroke="var(--color-chart-mark)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <g key={p.date + i}>
            <circle cx={x(i)} cy={y(p.value)} r={4} fill="var(--color-chart-mark)" stroke="white" strokeWidth={2} />
            {/* Larger invisible hit target than the mark. */}
            <circle
              cx={x(i)}
              cy={y(p.value)}
              r={14}
              fill="transparent"
              tabIndex={0}
              aria-label={`${p.label} on ${p.date}`}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
            />
          </g>
        ))}
        <text x={x(0)} y={y(points[0].value) - 9} textAnchor="start" className="fill-ink-faint text-[10px]">
          {points[0].label}
        </text>
        <text x={x(points.length - 1)} y={y(points[points.length - 1].value) - 9} textAnchor="end" className="fill-ink text-[10px] font-semibold">
          {points[points.length - 1].label}
        </text>
      </svg>
      {a && (
        <div
          role="tooltip"
          className="pointer-events-none absolute -top-9 z-10 -translate-x-1/2 rounded-lg bg-ink px-2.5 py-1 text-xs whitespace-nowrap text-white"
          style={{ left: `${(x(active!) / W) * 100}%` }}
        >
          {a.label} {unit}, {a.date}
        </div>
      )}
    </figure>
  );
}
