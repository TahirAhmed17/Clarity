import type { Metadata } from "next";
import { Suspense } from "react";
import { Badge, Card, PageHeader } from "@/components/ui/primitives";
import { loadPageData } from "@/server/session";

export const metadata: Metadata = { title: "Discover" };

async function DiscoverContent() {
  const { repo } = await loadPageData();
  const [events, catalogue] = await Promise.all([repo.listEvents(), repo.listSupplementCatalogue()]);
  return (
    <div className="grid gap-8">
      <section>
        <h2 className="mb-3 font-display text-2xl">Experiences</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {events.map((e) => (
            <Card key={e.id}>
              <div className="mb-2 flex flex-wrap gap-2">
                <Badge tone="coral">SAMPLE</Badge>
                <Badge tone="neutral">{e.category}</Badge>
              </div>
              <h3 className="font-semibold text-ink">{e.title}</h3>
              <p className="mt-1 text-sm text-ink-soft">{e.description}</p>
              <dl className="mt-3 space-y-1.5 text-sm">
                <div>
                  <dt className="inline font-semibold text-ink">How it may help: </dt>
                  <dd className="inline text-ink-soft">{e.howItMayHelp}</dd>
                </div>
                <div>
                  <dt className="inline font-semibold text-ink">What to expect: </dt>
                  <dd className="inline text-ink-soft">{e.expectedOutcome}</dd>
                </div>
              </dl>
              <p className="mt-3 text-xs text-ink-faint">Personal relevance and the mock “Request to book” flow arrive in M2.9.</p>
            </Card>
          ))}
        </div>
      </section>
      <section>
        <h2 className="mb-1 font-display text-2xl">Supplement information</h2>
        <p className="mb-3 text-sm text-ink-soft">Sample catalogue. Clarity never sets a dose — only a professional can.</p>
        <div className="grid gap-3 md:grid-cols-2">
          {catalogue.map((s) => (
            <Card key={s.id} className="p-5">
              <div className="mb-1 flex gap-2">
                <Badge tone="coral">SAMPLE</Badge>
                <Badge tone="neutral">{s.category}</Badge>
              </div>
              <h3 className="font-semibold text-ink">{s.name}</h3>
              <p className="text-sm text-ink-soft">{s.description}</p>
              <p className="mt-2 text-xs text-ink-faint">Caution: {s.cautionNotes}</p>
            </Card>
          ))}
        </div>
      </section>
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
