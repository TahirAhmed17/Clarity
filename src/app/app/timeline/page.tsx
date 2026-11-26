import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, EmptyState, PageHeader, ProvenanceTag, RangeBadge } from "@/components/ui/primitives";
import { buildTimeline, longitudinalChanges } from "@/server/timeline/service";
import { loadPageData } from "@/server/session";

export const metadata: Metadata = { title: "Timeline" };

async function TimelineContent() {
  const { repo, profileId } = await loadPageData();
  const [items, biomarkers] = await Promise.all([buildTimeline(repo, profileId), repo.listBiomarkers(profileId)]);
  const changes = longitudinalChanges(biomarkers);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      <Card>
        <h2 className="mb-1 font-display text-xl">Changes between reports</h2>
        <p className="mb-3 text-xs text-ink-faint">Converted to the same unit when that&apos;s safe. Small changes can be normal lab or day-to-day variation.</p>
        {changes.length === 0 ? (
          <p className="text-sm text-ink-soft">Upload a second report to see how results change over time.</p>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {changes.map((h) => (
              <li key={h.key} className="py-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{h.name}</span>
                  <RangeBadge status={h.latest.rangeStatus} />
                </div>
                <p className="text-ink-soft">
                  {h.points.map((p) => `${p.valueText} (${p.observedOn ?? "undated"})`).join(" → ")} {h.latest.unitAsReported}
                </p>
                <p className="text-xs text-ink-faint">
                  {h.change
                    ? `${h.change.absolute > 0 ? "+" : ""}${h.change.absolute} ${h.change.unit}${h.change.percent !== null ? ` (${h.change.percent > 0 ? "+" : ""}${h.change.percent}%)` : ""}`
                    : h.changeUnavailableReason}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 font-display text-xl">Everything, newest first</h2>
        {items.length === 0 ? (
          <EmptyState title="Nothing on your timeline yet" />
        ) : (
          <ol className="relative space-y-5 border-l border-mist pl-6">
            {items.map((i) => (
              <li key={i.id} className="relative">
                <span className="absolute top-1.5 -left-[31px] size-3 rounded-full bg-teal ring-4 ring-white" aria-hidden />
                <p className="text-xs text-ink-faint">{i.at.slice(0, 10)}</p>
                <p className="font-semibold text-ink">{i.title}</p>
                {i.detail && <p className="text-sm text-ink-soft">{i.detail}</p>}
                <div className="mt-1">
                  <ProvenanceTag kind={i.provenance} />
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}

export default function TimelinePage() {
  return (
    <div>
      <PageHeader title="Timeline">Reports, wearable imports, symptoms, goal changes, plans, actions and reviews, with where each came from.</PageHeader>
      <Suspense fallback={<p className="text-ink-soft">Loading…</p>}>
        <TimelineContent />
      </Suspense>
    </div>
  );
}
