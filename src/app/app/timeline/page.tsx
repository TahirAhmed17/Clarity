import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, EmptyState, PageHeader, ProvenanceTag } from "@/components/ui/primitives";
import { loadPageData } from "@/server/session";

export const metadata: Metadata = { title: "Timeline" };

async function TimelineContent() {
  const { repo, profileId } = await loadPageData();
  const [documents, symptoms] = await Promise.all([repo.listDocuments(profileId), repo.listSymptoms(profileId)]);
  const items = [
    ...documents.map((d) => ({
      key: d.id,
      date: d.collectedOn ?? d.createdAt.slice(0, 10),
      title: d.kind === "blood_report_pdf" ? "Blood report" : "Wearable export",
      detail: d.originalFilename,
      prov: d.isSynthetic ? ("synthetic" as const) : ("extracted" as const),
    })),
    ...symptoms.map((s) => ({
      key: s.id,
      date: s.startedOn ?? s.createdAt.slice(0, 10),
      title: "Symptom noted",
      detail: s.description,
      prov: "user_provided" as const,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  if (items.length === 0) return <EmptyState title="Nothing on your timeline yet" />;
  return (
    <Card>
      <ol className="relative space-y-5 border-l border-mist pl-6">
        {items.map((i) => (
          <li key={i.key} className="relative">
            <span className="absolute top-1.5 -left-[31px] size-3 rounded-full bg-teal ring-4 ring-white" aria-hidden />
            <p className="text-xs text-ink-faint">{i.date}</p>
            <p className="font-semibold text-ink">{i.title}</p>
            <p className="text-sm text-ink-soft">{i.detail}</p>
            <div className="mt-1">
              <ProvenanceTag kind={i.prov} />
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

export default function TimelinePage() {
  return (
    <div>
      <PageHeader title="Timeline">Reports, wearable imports and things you&apos;ve told Clarity, newest first. Recommendations and actions join in M2.</PageHeader>
      <Suspense fallback={<p className="text-ink-soft">Loading…</p>}>
        <TimelineContent />
      </Suspense>
    </div>
  );
}
