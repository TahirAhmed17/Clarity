import type { Metadata } from "next";
import { Suspense } from "react";
import { EvidenceList } from "@/components/features/evidence-list";
import { Badge, Card, Disclaimer, PageHeader, RangeBadge } from "@/components/ui/primitives";
import { getRetriever } from "@/server/evidence";
import { retrievedToRefs } from "@/server/evidence/refs";
import { loadPageData } from "@/server/session";
import { buildSystemInsights } from "@/server/systems/organ-systems";

export const metadata: Metadata = { title: "Organ & System Insights" };

const STATE_TONE = { none: "neutral", partial: "mist", complete: "teal" } as const;
const STATE_LABEL = { none: "Not enough data", partial: "Partial data", complete: "Core markers measured" } as const;

async function SystemsContent() {
  const { repo, profileId } = await loadPageData();
  const systems = await buildSystemInsights(await repo.listBiomarkers(profileId), await getRetriever());

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {systems.map((s) => (
        <Card key={s.system.id} id={s.system.id}>
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="font-display text-2xl text-ink">{s.system.name}</h2>
              <p className="text-sm text-ink-soft">{s.system.description}</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Badge tone={STATE_TONE[s.dataState]}>{STATE_LABEL[s.dataState]}</Badge>
              {s.outsideRangeCount > 0 && <Badge tone="coral">{s.summary}</Badge>}
            </div>
          </div>

          {s.measurements.length > 0 && (
            <ul className="mb-4 divide-y divide-line text-sm">
              {s.measurements.map((m) => (
                <li key={m.code} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="text-ink">
                    {m.history.name}
                    {m.role === "supporting" && <span className="ml-1 text-xs text-ink-faint">(supporting)</span>}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="font-semibold">
                      {m.history.latest.valueText} <span className="font-normal text-ink-soft">{m.history.latest.unitAsReported}</span>
                    </span>
                    {m.history.change && (
                      <span className="text-xs text-ink-faint">
                        {m.history.change.direction === "up" ? "▲" : m.history.change.direction === "down" ? "▼" : "="} from {m.history.change.from.valueText}
                      </span>
                    )}
                    <RangeBadge status={m.history.latest.rangeStatus} />
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="grid gap-4 text-sm sm:grid-cols-2">
            <section>
              <h3 className="mb-1 font-semibold text-teal-ink">Observations</h3>
              {s.observations.length ? (
                <ul className="list-disc space-y-1 pl-5 text-ink-soft">
                  {s.observations.map((o) => (
                    <li key={o}>{o}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-ink-soft">{s.dataState === "none" ? "No measurements yet." : "Nothing outside your lab's ranges, and no changes to note."}</p>
              )}
            </section>
            <section>
              <h3 className="mb-1 font-semibold text-teal-ink">Next steps</h3>
              <ul className="list-disc space-y-1 pl-5 text-ink-soft">
                {s.nextSteps.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </section>
            <section>
              <h3 className="mb-1 font-semibold text-teal-ink">Not measured</h3>
              <p className="text-ink-soft">{s.missing.length ? s.missing.map((m) => m.name).join(", ") : "All mapped markers are measured."}</p>
            </section>
            <section>
              <h3 className="mb-1 font-semibold text-teal-ink">Limitations</h3>
              <ul className="list-disc space-y-1 pl-5 text-ink-soft">
                {s.limitations.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </section>
          </div>
          {s.evidence.length > 0 && (
            <div className="mt-4 border-t border-line pt-3">
              <EvidenceList items={retrievedToRefs(s.evidence)} title="Supporting evidence" />
            </div>
          )}
        </Card>
      ))}
      <Disclaimer className="lg:col-span-2" />
    </div>
  );
}

export default function BodyPage() {
  return (
    <div>
      <PageHeader title="Organ & system insights">
        What your results say about each body system. There are no scores and no diagnoses: only what was measured, what changed, and what&apos;s missing. The 3D overview arrives in M3.5.
      </PageHeader>
      <Suspense fallback={<p className="text-ink-soft">Loading systems…</p>}>
        <SystemsContent />
      </Suspense>
    </div>
  );
}
