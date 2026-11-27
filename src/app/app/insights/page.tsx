import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { DailyChart, type ValueFormat } from "@/components/charts/daily-chart";
import { BiomarkerCard } from "@/components/features/biomarker-card";
import { ButtonLink, Disclaimer, EmptyState, PageHeader } from "@/components/ui/primitives";
import { buildHealthContext } from "@/server/ai/context";
import { biomarkerCards, GROUP_ORDER, wearableSeries } from "@/server/insights/view-model";
import { loadPageData } from "@/server/session";

export const metadata: Metadata = { title: "Health Insights" };

const WEARABLES: { metric: string; title: string; kind: "bar" | "line"; format: ValueFormat; unit: string }[] = [
  { metric: "steps", title: "Steps", kind: "bar", format: "integer", unit: "steps a day" },
  { metric: "sleep_asleep", title: "Time asleep", kind: "bar", format: "hours", unit: "hours a night" },
  { metric: "resting_heart_rate", title: "Resting heart rate", kind: "line", format: "integer", unit: "bpm" },
  { metric: "hrv_sdnn", title: "Heart rate variability (SDNN)", kind: "line", format: "integer", unit: "ms" },
  { metric: "active_energy", title: "Active energy", kind: "bar", format: "integer", unit: "kcal a day" },
];

function formatDate(d: string | null) {
  return d ? new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : "an unknown date";
}

async function InsightsContent() {
  const { repo, profileId } = await loadPageData();
  const [profile, biomarkers, wearables, symptoms] = await Promise.all([
    repo.getProfile(profileId),
    repo.listBiomarkers(profileId),
    repo.listWearableMetrics(profileId),
    repo.listSymptoms(profileId),
  ]);
  if (!profile) return <EmptyState title="Profile not found" />;
  const cards = biomarkerCards(biomarkers);
  const ctx = buildHealthContext({ profile, biomarkers, wearables, symptoms });
  const series = wearableSeries(wearables);
  const flagged = cards.filter((c) => c.status === "above" || c.status === "below");
  const latestDate = cards.map((c) => c.observedOn).filter(Boolean).sort().pop() ?? null;

  return (
    <div className="space-y-12">
      {cards.length === 0 ? (
        <EmptyState title="No lab results yet" action={<ButtonLink href="/app/upload">Upload a report</ButtonLink>}>
          Upload a digital PDF from your lab and your results will appear here, compared with your lab&apos;s own ranges.
        </EmptyState>
      ) : (
        <>
          <p className="max-w-2xl font-display text-2xl leading-snug text-ink sm:text-3xl">
            {cards.length} results, most recently from {formatDate(latestDate)}.{" "}
            {flagged.length ? `${flagged.length} sit outside your lab's range.` : "None sit outside your lab's range."}
          </p>

          {flagged.length > 0 && (
            <section aria-labelledby="attention">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <h2 id="attention" className="font-display text-2xl">
                  Worth a closer look
                </h2>
                <Link href={`/app?q=${encodeURIComponent("Explain the results that are outside my lab's range")}`} className="text-sm font-semibold text-teal-ink underline decoration-teal/40 underline-offset-4">
                  Ask Clarity to explain these
                </Link>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {flagged.map((b) => (
                  <BiomarkerCard key={b.key} b={b} />
                ))}
              </div>
            </section>
          )}

          {GROUP_ORDER.map((group) => {
            const rows = cards.filter((c) => c.group === group && !(c.status === "above" || c.status === "below"));
            if (rows.length === 0) return null;
            return (
              <section key={group} aria-label={group}>
                <h2 className="mb-4 font-display text-2xl">{group}</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {rows.map((b) => (
                    <BiomarkerCard key={b.key} b={b} />
                  ))}
                </div>
              </section>
            );
          })}
        </>
      )}

      <section aria-labelledby="wearables">
        <h2 id="wearables" className="mb-1 font-display text-2xl">
          From your wearable
        </h2>
        <p className="mb-4 text-sm text-ink-soft">The last 14 days, one value per day. Where two devices overlap, the imported export is used.</p>
        {Object.keys(series).length === 0 ? (
          <EmptyState title="No wearable data yet" action={<ButtonLink href="/app/upload#wearable">Import Apple Health data</ButtonLink>} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {WEARABLES.filter((w) => series[w.metric]?.length).map((w) => (
              <DailyChart key={w.metric} title={w.title} points={series[w.metric]} kind={w.kind} format={w.format} unitLabel={w.unit} />
            ))}
          </div>
        )}
      </section>

      {ctx.missing.length > 0 && (
        <section>
          <h2 className="mb-2 font-display text-2xl">What&apos;s missing</h2>
          <ul className="max-w-2xl list-disc space-y-1 pl-5 text-ink-soft">
            {ctx.missing.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </section>
      )}
      <Disclaimer />
    </div>
  );
}

export default function InsightsPage() {
  return (
    <div>
      <PageHeader title="Health insights">Every result is compared only with the range your lab printed. Tap a card for what it measures and the evidence behind it.</PageHeader>
      <Suspense fallback={<p className="text-ink-soft">Loading your results…</p>}>
        <InsightsContent />
      </Suspense>
    </div>
  );
}
