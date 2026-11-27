"use client";

import Link from "next/link";
import { useState } from "react";
import { EvidenceList, type EvidenceRef } from "@/components/features/evidence-list";
import { Badge, RangeBadge } from "@/components/ui/primitives";
import type { SystemId } from "@/data/evidence/catalogue";
import type { SystemInsight } from "@/server/systems/organ-systems";

/** Evidence is resolved to display references on the server, so the corpus never ships to the browser. */
export type SystemView = Omit<SystemInsight, "evidence"> & { refs: EvidenceRef[] };
import { BodyMap } from "./body-map";

const STATE_LABEL = { none: "Not enough data", partial: "Partly measured", complete: "Core markers measured" } as const;

export function BodyExplorer({ insights }: { insights: SystemView[] }) {
  const initial = insights.find((s) => s.outsideRangeCount > 0) ?? insights.find((s) => s.dataState !== "none") ?? insights[0];
  const [selected, setSelected] = useState<SystemId>(initial.system.id);
  const s = insights.find((x) => x.system.id === selected)!;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(280px,420px)_1fr] lg:items-start">
      <div className="mx-auto w-full max-w-[380px] lg:sticky lg:top-20 lg:max-w-none">
        <BodyMap
          systems={insights.map((i) => ({ id: i.system.id, name: i.system.name, outsideRangeCount: i.outsideRangeCount, dataState: i.dataState }))}
          selected={selected}
          onSelect={setSelected}
        />
      </div>

      <section aria-live="polite" aria-labelledby="system-title" className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={s.dataState === "none" ? "neutral" : "mist"}>{STATE_LABEL[s.dataState]}</Badge>
          {s.outsideRangeCount > 0 && <Badge tone="coral">{s.summary}</Badge>}
        </div>
        <h2 id="system-title" className="mt-2 font-display text-4xl tracking-tight text-ink">
          {s.system.name}
        </h2>
        <p className="mt-2 max-w-xl text-ink-soft">{s.system.description}</p>

        {s.measurements.length > 0 ? (
          <ul className="hairline mt-6 rounded-[var(--radius-card)] bg-white px-5 ring-1 ring-line">
            {s.measurements.map((m) => (
              <li key={m.code} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span className="text-ink">
                  {m.history.name}
                  {m.role === "supporting" && <span className="ml-1.5 text-xs text-ink-faint">supporting</span>}
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-xl text-ink tabular-nums">{m.history.latest.valueText}</span>
                  <span className="text-sm text-ink-soft">{m.history.latest.unitAsReported}</span>
                  {m.history.change && m.history.change.direction !== "same" && (
                    <span className="text-xs text-ink-faint">
                      {m.history.change.direction === "up" ? "up" : "down"} from {m.history.change.from.valueText}
                    </span>
                  )}
                  <RangeBadge status={m.history.latest.rangeStatus} />
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-6 rounded-[var(--radius-card)] border border-dashed border-sage/70 bg-mint-soft/40 p-5 text-ink-soft">
            Nothing measured for this system yet. It isn&apos;t assumed to be normal: results will appear once a report includes them.
          </p>
        )}

        <div className="mt-8 grid gap-8 sm:grid-cols-2">
          <div>
            <h3 className="mb-2 font-display text-lg">What stands out</h3>
            {s.observations.length ? (
              <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink-soft">
                {s.observations.map((o) => (
                  <li key={o}>{o}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-soft">{s.dataState === "none" ? "No measurements yet." : "Nothing outside your lab's ranges, and no changes to note."}</p>
            )}
          </div>
          <div>
            <h3 className="mb-2 font-display text-lg">Next steps</h3>
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink-soft">
              {s.nextSteps.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-2 font-display text-lg">Not measured</h3>
            <p className="text-sm text-ink-soft">{s.missing.length ? s.missing.map((m) => m.name).join(", ") : "Everything mapped to this system was measured."}</p>
          </div>
          <div>
            <h3 className="mb-2 font-display text-lg">Keep in mind</h3>
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink-soft">
              {s.limitations.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </div>
        </div>

        {s.refs.length > 0 && (
          <div className="mt-8 border-t border-line pt-5">
            <EvidenceList items={s.refs} title="Supporting evidence" />
          </div>
        )}
        {s.dataState !== "none" && (
          <Link
            href={`/app?q=${encodeURIComponent(`What do my results for ${s.system.name.toLowerCase()} mean?`)}`}
            className="mt-6 inline-block text-sm font-semibold text-teal-ink underline decoration-teal/40 underline-offset-4"
          >
            Ask Clarity about these results
          </Link>
        )}
      </section>
    </div>
  );
}
