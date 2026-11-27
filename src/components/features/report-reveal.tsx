"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { RangeRail } from "@/components/charts/range-rail";
import { useReducedMotion } from "@/lib/preferences";
import type { ReportSummary } from "@/lib/report-summary";

/** Counts from 0 to `target` with an ease-out curve; instant when motion is reduced. */
function useCountUp(target: number, durationMs: number, delayMs: number, reduced: boolean) {
  const [value, setValue] = useState(reduced ? target : 0);
  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    let start: number | null = null;
    const tick = (t: number) => {
      start ??= t + delayMs;
      const p = Math.min(1, Math.max(0, (t - start) / durationMs));
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs, delayMs, reduced]);
  return reduced ? target : value;
}

const d = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

/**
 * "Report read" moment after an upload: totals count up, then each result outside the lab's
 * range appears with its range-rail marker gliding to where it sits. The overview answer follows.
 */
export function ReportReveal({ filename, collectedOn, summary }: { filename: string; collectedOn: string | null; summary: ReportSummary }) {
  const reduced = useReducedMotion();
  const total = useCountUp(summary.total, 900, 100, reduced);
  const outside = useCountUp(summary.outside, 700, 450, reduced);
  const within = useCountUp(summary.within, 900, 250, reduced);

  return (
    <section aria-label={`Report read: ${summary.total} results, ${summary.outside} outside your lab's range`} className="rounded-[var(--radius-card)] bg-white p-5 ring-1 ring-line sm:p-6">
      <p className="text-sm text-ink-soft">
        Read <span className="font-medium text-ink">{filename}</span>
        {collectedOn ? `, collected ${collectedOn}` : ", no collection date found"}
      </p>
      <dl className="mt-4 grid grid-cols-3 gap-4" aria-hidden>
        <div>
          <dt className="text-sm text-ink-soft">Results</dt>
          <dd className="font-display text-4xl text-ink tabular-nums">{total}</dd>
        </div>
        <div>
          <dt className="text-sm text-ink-soft">Within range</dt>
          <dd className="font-display text-4xl text-teal-ink tabular-nums">{within}</dd>
        </div>
        <div>
          <dt className="text-sm text-ink-soft">Outside range</dt>
          <dd className={`font-display text-4xl tabular-nums ${summary.outside ? "text-coral-ink" : "text-ink"}`}>{outside}</dd>
        </div>
      </dl>

      {summary.flagged.length > 0 && (
        <ul className="hairline mt-5">
          {summary.flagged.slice(0, 6).map((r, i) => {
            const delayMs = 650 + i * 140;
            return (
              <li key={r.id} className="fade-up grid gap-x-6 gap-y-1 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] sm:items-center" style={d(delayMs)}>
                <p className="text-sm">
                  <span className="font-medium text-ink">{r.nameAsReported}</span>{" "}
                  <span className="text-ink-soft">
                    {r.valueText} {r.unitAsReported ?? ""}
                  </span>{" "}
                  <span className="text-coral-ink">{r.rangeStatus === "above" ? "above" : "below"} range</span>
                </p>
                <RangeRail
                  value={r.valueNumeric}
                  low={r.refLow}
                  high={r.refHigh}
                  status={r.rangeStatus}
                  label={`${r.nameAsReported} ${r.valueText} ${r.unitAsReported ?? ""}, ${r.rangeStatus} the lab range ${r.refText ?? ""}`}
                  revealDelayMs={delayMs + 150}
                />
              </li>
            );
          })}
        </ul>
      )}
      {summary.notCompared > 0 && <p className="mt-3 text-xs text-ink-faint">{summary.notCompared === 1 ? "1 result had" : `${summary.notCompared} results had`} no usable range, so {summary.notCompared === 1 ? "it wasn't" : "they weren't"} compared.</p>}
    </section>
  );
}
