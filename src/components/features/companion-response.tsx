"use client";

import { AnimatePresence, motion } from "motion/react";
import { useId, useState } from "react";
import { Badge, Disclaimer, ProvenanceTag, TidePanel } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { useReducedMotion } from "@/lib/preferences";
import type { CompanionResponse } from "@/server/ai/schemas";
import { EvidenceList } from "./evidence-list";

const CATEGORY_LABEL: Record<CompanionResponse["nextMove"]["category"], string> = {
  movement: "Movement",
  nutrition: "Nutrition",
  sleep: "Sleep",
  supplement: "Supplement information",
  professional: "Talk to a professional",
  other: "Next step",
};

/**
 * One answer: the next move first, on the tide panel (coral-tinted when something is flagged),
 * with the detail one tap away.
 */
export function CompanionResponseView({ res, compact = false }: { res: CompanionResponse; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const reduced = useReducedMotion();
  const detailsId = useId();
  const flagged = res.safety.flagForProfessional;

  return (
    <div className="space-y-3">
      {res.engineNotice && <p className="rounded-2xl bg-stone px-4 py-2.5 text-sm text-stone-ink">{res.engineNotice}</p>}

      <TidePanel className={cn(flagged && "tide-alert", compact && "p-5 sm:p-6")}>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium text-teal-ink">Your next move</span>
          <Badge tone={res.nextMove.category === "professional" ? "coral" : "teal"}>{CATEGORY_LABEL[res.nextMove.category]}</Badge>
        </div>
        <h3 className={cn("mt-2 font-display leading-tight text-ink", compact ? "text-2xl" : "text-3xl sm:text-4xl")}>{res.nextMove.title}</h3>
        <p className="mt-3 max-w-2xl text-ink-soft">{res.nextMove.detail}</p>
        {res.nextMoveReasons.length > 0 && <p className="mt-2 max-w-2xl text-sm text-ink-faint">Chosen because: {res.nextMoveReasons.join("; ")}.</p>}

        {flagged && !compact && (
          <div role="status" className="mt-5 max-w-2xl border-l-2 border-coral pl-4 text-sm text-coral-ink">
            <p className="font-semibold">Worth discussing with a healthcare professional</p>
            <p className="mt-0.5">{res.safety.reasons.slice(0, 5).join(". ")}.</p>
          </div>
        )}

        {!compact && <p className="mt-5 max-w-2xl text-ink">{res.whyItMatters}</p>}

        {!compact && res.supportingActions.length > 0 && (
          <div className="mt-6">
            <p className="text-sm font-medium text-teal-ink">Small supporting steps</p>
            <ul className="mt-2 grid gap-3 sm:grid-cols-3">
              {res.supportingActions.map((a) => (
                <li key={a.title} className="rounded-2xl bg-white/70 p-4 text-sm ring-1 ring-white">
                  <p className="font-semibold text-ink">{a.title}</p>
                  <p className="mt-1 text-ink-soft">{a.detail}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </TidePanel>

      <button
        type="button"
        aria-expanded={open}
        aria-controls={detailsId}
        onClick={() => setOpen((o) => !o)}
        className="text-sm font-semibold text-teal-ink underline decoration-teal/40 underline-offset-4 hover:decoration-teal-ink"
      >
        {open ? "Hide the detail" : "What I noticed, the evidence, and the limits"}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={detailsId}
            key="details"
            initial={reduced ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduced ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="grid gap-8 rounded-[var(--radius-card)] bg-white p-5 ring-1 ring-line sm:grid-cols-2 sm:p-6">
              <section>
                <h4 className="mb-2 font-display text-lg">What I noticed</h4>
                {res.noticed.length === 0 ? (
                  <p className="text-sm text-ink-soft">Nothing specific stood out.</p>
                ) : (
                  <ul className="hairline text-sm">
                    {res.noticed.map((n) => (
                      <li key={n.title} className="py-2.5">
                        <p className="font-semibold text-ink">{n.title}</p>
                        <p className="text-ink-soft">{n.detail}</p>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-3">
                  <ProvenanceTag kind="ai_interpretation" />
                </div>
              </section>
              <section>
                <h4 className="mb-2 font-display text-lg">Supporting evidence</h4>
                {res.evidence.length > 0 && (
                  <ul className="mb-3 list-disc space-y-1 pl-5 text-sm text-ink-soft">
                    {res.evidence.map((e) => (
                      <li key={e.evidenceId}>{e.claim}</li>
                    ))}
                  </ul>
                )}
                {res.sources.length === 0 ? (
                  <p className="text-sm text-ink-soft">No curated sources were retrieved for this answer.</p>
                ) : (
                  <EvidenceList items={res.sources} title="Sources given to the AI" />
                )}
              </section>
              <section>
                <h4 className="mb-2 font-display text-lg">Limitations</h4>
                <ul className="list-disc space-y-1 pl-5 text-sm text-ink-soft">
                  {res.limitations.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              </section>
              <section>
                <h4 className="mb-2 font-display text-lg">You could ask next</h4>
                <ul className="space-y-1 text-sm text-ink-soft">
                  {res.followUps.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                <p className="mt-4 text-xs text-ink-faint">
                  Engine: {res.engine}
                  {res.safety.interventions.length > 0 && `. Safety checks applied: ${res.safety.interventions.join(" ")}`}
                </p>
              </section>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Disclaimer />
    </div>
  );
}
