import type { Metadata } from "next";
import { Suspense } from "react";
import { PostButton } from "@/components/features/post-button";
import { Badge, Card, Disclaimer, PageHeader, ProvenanceTag } from "@/components/ui/primitives";
import { rankEvents } from "@/server/events/relevance";
import { loadSnapshot } from "@/server/insights/snapshot";
import { loadPageData } from "@/server/session";

export const metadata: Metadata = { title: "Discover" };

const STATUS: Record<string, { tone: "neutral" | "teal" | "coral" | "mist"; label: string }> = {
  pending: { tone: "mist", label: "Awaiting review" },
  approved: { tone: "teal", label: "Approved (simulated)" },
  changed: { tone: "mist", label: "Changed by reviewer (simulated)" },
  rejected: { tone: "neutral", label: "Not recommended (simulated)" },
};

async function DiscoverContent() {
  const { repo, profileId } = await loadPageData();
  const [snap, events, requests, suggestions, catalogue] = await Promise.all([
    loadSnapshot(repo, profileId),
    repo.listEvents(),
    repo.listEventRequests(profileId),
    repo.listSupplementSuggestions(profileId),
    repo.listSupplementCatalogue(),
  ]);
  const ranked = rankEvents(events, snap.context);

  return (
    <div className="grid gap-10">
      <section>
        <h2 className="mb-1 font-display text-2xl">Experiences</h2>
        <p className="mb-4 text-sm text-ink-soft">SAMPLE listings, ordered by how they relate to your goals and results. Booking is a mock request.</p>
        <div className="grid gap-4 md:grid-cols-2">
          {ranked.map((e) => {
            const requested = requests.some((r) => r.eventId === e.id && r.status !== "cancelled");
            return (
              <Card key={e.id}>
                <div className="mb-2 flex flex-wrap gap-2">
                  <Badge tone="coral">SAMPLE</Badge>
                  <Badge tone="neutral">{e.category}</Badge>
                  {e.relevanceScore > 0 && <Badge tone="teal">Relevant to you</Badge>}
                </div>
                <h3 className="font-semibold text-ink">{e.title}</h3>
                <p className="mt-1 text-sm text-ink-soft">{e.description}</p>
                <dl className="mt-3 space-y-1.5 text-sm">
                  <div>
                    <dt className="inline font-semibold text-ink">Why you: </dt>
                    <dd className="inline text-ink-soft">{e.whyRelevant}</dd>
                  </div>
                  <div>
                    <dt className="inline font-semibold text-ink">How it may help: </dt>
                    <dd className="inline text-ink-soft">{e.howItMayHelp}</dd>
                  </div>
                  <div>
                    <dt className="inline font-semibold text-ink">What to expect: </dt>
                    <dd className="inline text-ink-soft">{e.expectedOutcome}</dd>
                  </div>
                </dl>
                <p className="mt-2 text-xs text-ink-faint">
                  {[e.location, e.startsAt?.slice(0, 10), e.priceText].filter(Boolean).join(" · ")}
                </p>
                <div className="mt-3">
                  {requested ? (
                    <Badge tone="lime">Requested (mock — no real booking)</Badge>
                  ) : (
                    <PostButton url={`/api/events/${e.id}/request`} label="Request to book" variant="soft" pendingLabel="Requesting…" />
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="mb-1 font-display text-2xl">Supplement information</h2>
            <p className="text-sm text-ink-soft">Clarity can point out a category worth discussing. It never sets a dose: only a reviewer can, and here that review is simulated.</p>
          </div>
          <PostButton url="/api/supplements" label="Check what may be relevant" variant="secondary" pendingLabel="Checking…" />
        </div>
        {suggestions.length > 0 && (
          <div className="mb-5 grid gap-3 md:grid-cols-2">
            {suggestions.map((s) => {
              const item = catalogue.find((c) => c.id === s.catalogueId);
              const st = STATUS[s.status];
              return (
                <Card key={s.id} className="p-5">
                  <div className="mb-1 flex flex-wrap gap-2">
                    <Badge tone={st.tone}>{st.label}</Badge>
                    <ProvenanceTag kind={s.status === "pending" ? "ai_interpretation" : "simulated_review"} />
                  </div>
                  <h3 className="font-semibold">{item?.name}</h3>
                  <p className="text-sm text-ink-soft">{s.rationale}</p>
                  {s.reviewerDose && <p className="mt-2 text-sm"><span className="font-semibold">Reviewer dose (simulated):</span> {s.reviewerDose}</p>}
                  {s.reviewerNote && <p className="mt-1 text-sm text-ink-soft">Reviewer note: {s.reviewerNote}</p>}
                </Card>
              );
            })}
          </div>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          {catalogue.map((s) => (
            <Card key={s.id} className="p-5">
              <div className="mb-1 flex gap-2">
                <Badge tone="coral">SAMPLE</Badge>
                <Badge tone="neutral">{s.category}</Badge>
              </div>
              <h3 className="font-semibold text-ink">{s.name}</h3>
              <p className="text-sm text-ink-soft">{s.description}</p>
              <p className="mt-2 text-xs text-ink-faint">When it&apos;s discussed: {s.relevanceNotes}</p>
              <p className="mt-1 text-xs text-ink-faint">Caution: {s.cautionNotes}</p>
            </Card>
          ))}
        </div>
      </section>
      <Disclaimer />
    </div>
  );
}

export default function DiscoverPage() {
  return (
    <div>
      <PageHeader title="Discover">Experiences and supplement information related to your goals.</PageHeader>
      <Suspense fallback={<p className="text-ink-soft">Loading…</p>}>
        <DiscoverContent />
      </Suspense>
    </div>
  );
}
