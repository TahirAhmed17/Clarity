import type { RangeStatus } from "@/lib/domain";

/**
 * Where a value sits relative to the LAB's own printed range. The band is the lab range;
 * the marker is the value (coral-ink only when outside). Status is also stated in text by the
 * caller, so colour is never the only signal. One-sided ranges ("< 3.0", "> 60") show an open band.
 */
export function RangeRail({
  value,
  low,
  high,
  status,
  label,
}: {
  value: number | null;
  low: number | null;
  high: number | null;
  status: RangeStatus;
  /** Accessible description, e.g. "13 ug/L, below the lab range 15 – 150". */
  label: string;
}) {
  if (value === null || (low === null && high === null)) {
    return <p className="text-xs text-ink-faint">{value === null ? "Not plotted: reported as a bound, not an exact number." : "No lab range to compare with."}</p>;
  }
  // Domain: pad around the band and the value so neither sits on the edge.
  const lo = Math.min(low ?? (high! > 0 ? 0 : high! * 1.5), value);
  const hi = Math.max(high ?? low! * 1.8, value);
  const span = hi - lo || 1;
  const min = lo - span * 0.12;
  const max = hi + span * 0.12;
  const x = (v: number) => ((v - min) / (max - min)) * 100;
  const bandStart = low !== null ? x(low) : 0;
  const bandEnd = high !== null ? x(high) : 100;
  const outside = status === "above" || status === "below";

  return (
    <div role="img" aria-label={label} className="relative pt-1 pb-5">
      <div className="relative h-2 rounded-full bg-chart-grid">
        <div
          className="absolute inset-y-0 bg-chart-band"
          style={{
            left: `${bandStart}%`,
            width: `${bandEnd - bandStart}%`,
            borderTopLeftRadius: low === null ? 999 : 4,
            borderBottomLeftRadius: low === null ? 999 : 4,
            borderTopRightRadius: high === null ? 999 : 4,
            borderBottomRightRadius: high === null ? 999 : 4,
          }}
        />
        <div
          className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white"
          style={{ left: `${x(value)}%`, background: outside ? "var(--color-chart-alert)" : "var(--color-chart-mark)" }}
        />
      </div>
      {low !== null && (
        <span className="absolute top-4 -translate-x-1/2 text-[11px] text-ink-faint tabular-nums" style={{ left: `${bandStart}%` }}>
          {low}
        </span>
      )}
      {high !== null && (
        <span className="absolute top-4 -translate-x-1/2 text-[11px] text-ink-faint tabular-nums" style={{ left: `${bandEnd}%` }}>
          {high}
        </span>
      )}
    </div>
  );
}
