"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useId, useState } from "react";
import { RangeRail } from "@/components/charts/range-rail";
import { Sparkline } from "@/components/charts/sparkline";
import { ProvenanceTag } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { useReducedMotion } from "@/lib/preferences";
import type { BiomarkerCardData } from "@/server/insights/view-model";
import { EvidenceList } from "./evidence-list";

const STATUS: Record<BiomarkerCardData["status"], { text: string; glyph: string; tone: string }> = {
  above: { text: "Above your lab's range", glyph: "▲", tone: "text-coral-ink" },
  below: { text: "Below your lab's range", glyph: "▼", tone: "text-coral-ink" },
  within: { text: "Within your lab's range", glyph: "●", tone: "text-teal-ink" },
  no_range: { text: "No range printed", glyph: "○", tone: "text-ink-faint" },
  not_numeric: { text: "Reported as a bound", glyph: "○", tone: "text-ink-faint" },
};

const PROV = { extracted: "extracted", user_provided: "user_provided", calculated: "calculated", synthetic_seed: "synthetic" } as const;

export function BiomarkerCard({ b }: { b: BiomarkerCardData }) {
  const [open, setOpen] = useState(false);
  const reduced = useReducedMotion();
  const id = useId();
  const s = STATUS[b.status];
  const outside = b.status === "above" || b.status === "below";

  return (
    <article className={cn("flex flex-col rounded-[var(--radius-card)] bg-white p-5 ring-1", outside ? "ring-coral/40" : "ring-line")}>
      <header className="flex items-start justify-between gap-3">
        <h3 className="font-semibold text-ink">{b.name}</h3>
        <span className="text-xs text-ink-faint">{b.observedOn ?? "Undated"}</span>
      </header>
      <p className="mt-2 flex items-baseline gap-1.5">
        <span className="font-display text-4xl leading-none text-ink tabular-nums">{b.valueText}</span>
        <span className="text-sm text-ink-soft">{b.unit}</span>
      </p>
      <p className={cn("mt-1.5 text-sm font-medium", s.tone)}>
        <span aria-hidden>{s.glyph} </span>
        {s.text}
        {b.refText && <span className="font-normal text-ink-faint"> ({b.refText})</span>}
      </p>
      <div className="mt-3">
        <RangeRail
          value={b.valueNumeric}
          low={b.refLow}
          high={b.refHigh}
          status={b.status}
          label={`${b.valueText} ${b.unit ?? ""}, ${s.text.toLowerCase()}${b.refText ? ` of ${b.refText}` : ""}`}
        />
      </div>
      {b.history.length > 1 && (
        <div className="mt-4 border-t border-line pt-5">
          <Sparkline points={b.history} unit={b.historyUnit ?? ""} title={`${b.name} over time`} />
          {b.changeText && <p className="text-xs text-ink-faint">{b.changeText}</p>}
        </div>
      )}
      {b.issues.length > 0 && <p className="mt-2 rounded-xl bg-stone px-3 py-2 text-xs text-stone-ink">{b.issues[0]}</p>}

      <div className="mt-auto pt-4">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((o) => !o)}
          className="text-sm font-semibold text-teal-ink underline decoration-teal/40 underline-offset-4 hover:decoration-teal-ink"
        >
          {open ? "Less" : "What this measures"}
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              id={id}
              initial={reduced ? false : { height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={reduced ? undefined : { height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div className="space-y-3 pt-3 text-sm">
                <p className="text-ink-soft">{b.measures ?? "This test isn't in Clarity's library yet, so it's shown exactly as reported."}</p>
                <EvidenceList items={b.evidence} />
                <div className="flex flex-wrap items-center gap-3">
                  <ProvenanceTag kind={PROV[b.source]} />
                  <Link href={`/app?q=${encodeURIComponent(`What does my ${b.name} result mean?`)}`} className="font-semibold text-teal-ink underline decoration-teal/40 underline-offset-4">
                    Ask Clarity about this
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </article>
  );
}
