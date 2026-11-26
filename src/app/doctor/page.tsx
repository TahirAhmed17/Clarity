import type { Metadata } from "next";
import { Suspense } from "react";
import { ReviewForm } from "@/components/features/review-form";
import { Badge, ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { getSimulatedReviewer, loadPageData } from "@/server/session";

export const metadata: Metadata = { title: "Reviewer workspace (simulated)" };

const STATUS_TONE = { pending: "mist", approved: "teal", changed: "lime", rejected: "neutral" } as const;

async function Queue() {
  const { repo } = await loadPageData();
  const reviewer = await getSimulatedReviewer(repo);
  if (!reviewer) return <EmptyState title="Reviewer role required" />;
  const [queue, catalogue] = await Promise.all([repo.listSuggestionsForReview(), repo.listSupplementCatalogue()]);
  if (queue.length === 0) {
    return (
      <EmptyState title="No suggestions to review" action={<ButtonLink href="/app/discover" variant="secondary">Go to Discover</ButtonLink>}>
        On the member side, use “Check what may be relevant” in Discover to create suggestions from the synthetic results.
      </EmptyState>
    );
  }
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {queue.map((s) => {
        const item = catalogue.find((c) => c.id === s.catalogueId);
        return (
          <Card key={s.id}>
            <div className="mb-2 flex flex-wrap gap-2">
              <Badge tone={STATUS_TONE[s.status]}>{s.status}</Badge>
              <Badge tone="coral">Simulated</Badge>
            </div>
            <h2 className="font-semibold">
              {item?.name} <span className="font-normal text-ink-soft">for {s.profileDisplayName}</span>
            </h2>
            <p className="mt-1 text-sm text-ink-soft">{s.rationale}</p>
            {item && <p className="mt-1 text-xs text-ink-faint">Caution: {item.cautionNotes}</p>}
            {s.status === "pending" ? (
              <ReviewForm suggestionId={s.id} catalogue={catalogue.map((c) => ({ id: c.id, name: c.name }))} />
            ) : (
              <p className="mt-3 text-sm">
                {s.reviewerDose && <span className="block"><span className="font-semibold">Dose:</span> {s.reviewerDose}</span>}
                {s.reviewerNote && <span className="block text-ink-soft">Note: {s.reviewerNote}</span>}
              </p>
            )}
          </Card>
        );
      })}
    </div>
  );
}

export default function DoctorPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-8">
      <Badge tone="coral" className="mb-4">
        SIMULATED: not a real clinician, not real medical review
      </Badge>
      <PageHeader title="Reviewer workspace">
        Supplement categories suggested by Clarity wait here for a (simulated) professional decision. Only a reviewer can set a dose.
      </PageHeader>
      <Suspense fallback={<p className="text-ink-soft">Loading queue…</p>}>
        <Queue />
      </Suspense>
    </main>
  );
}
