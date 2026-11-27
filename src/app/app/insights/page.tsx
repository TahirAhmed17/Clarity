import type { Metadata } from "next";
import { Suspense } from "react";
import { ButtonLink, Card, Disclaimer, EmptyState, PageHeader, ProvenanceTag, RangeBadge, SectionHeading } from "@/components/ui/primitives";
import type { Biomarker } from "@/lib/domain";
import { buildHealthContext } from "@/server/ai/context";
import { validateBiomarkers } from "@/server/biomarkers/intelligence";
import { rangeStatus } from "@/server/biomarkers/range";
import { loadPageData } from "@/server/session";

export const metadata: Metadata = { title: "Health Insights" };

const METRIC_LABEL: Record<string, string> = {
  steps: "Steps / day",
  active_energy: "Active energy / day",
  sleep_asleep: "Time asleep / night",
  resting_heart_rate: "Resting heart rate",
  heart_rate: "Average heart rate",
  hrv_sdnn: "HRV (SDNN)",
};

function provenanceOf(b: Biomarker) {
  return b.source === "synthetic_seed" ? "synthetic" : b.source === "user_provided" ? "user_provided" : b.source === "calculated" ? "calculated" : "extracted";
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
  const ctx = buildHealthContext({ profile, biomarkers, wearables, symptoms });

  // Latest row per biomarker for display (keeps the full original record).
  const latest = new Map<string, Biomarker>();
  for (const b of [...biomarkers].sort((a, b) => (a.observedOn ?? "").localeCompare(b.observedOn ?? ""))) {
    latest.set(b.code ?? b.nameAsReported.toLowerCase(), b);
  }
  const rows = [...latest.values()];
  // De-duplicate same message across repeat results; warnings first.
  const issues = [...new Map(validateBiomarkers(biomarkers).map((i) => [i.message, i])).values()].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "warning" ? -1 : 1));

  return (
    <div className="grid gap-5">
      <Card>
        <SectionHeading eyebrow="Blood results" title="Latest results">
          Each result is compared only with the reference range printed by your lab. M3 adds biomarker cards, trends and explanations.
        </SectionHeading>
        {rows.length === 0 ? (
          <EmptyState title="No lab results yet" action={<ButtonLink href="/app/upload">Upload a report</ButtonLink>}>
            Upload a digital PDF from your lab to see your results here.
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs text-ink-faint uppercase">
                <tr>
                  <th className="py-2 pr-3 font-semibold">Test</th>
                  <th className="py-2 pr-3 font-semibold">Result</th>
                  <th className="py-2 pr-3 font-semibold">Lab range</th>
                  <th className="py-2 pr-3 font-semibold">Date</th>
                  <th className="py-2 pr-3 font-semibold">Status</th>
                  <th className="py-2 font-semibold">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((b) => {
                  const prev = ctx.biomarkers.find((c) => (c.code ?? c.name) === (b.code ?? b.nameAsReported))?.previous;
                  return (
                    <tr key={b.id}>
                      <td className="py-2.5 pr-3 text-ink">{b.nameAsReported}</td>
                      <td className="py-2.5 pr-3">
                        <span className="font-semibold text-ink">{b.valueText}</span> <span className="text-ink-soft">{b.unitAsReported}</span>
                        {prev && <span className="block text-xs text-ink-faint">was {prev.valueText} on {prev.observedOn}</span>}
                      </td>
                      <td className="py-2.5 pr-3 text-ink-soft">{b.refText ?? "—"}</td>
                      <td className="py-2.5 pr-3 text-ink-soft">{b.observedOn ?? "Unknown"}</td>
                      <td className="py-2.5 pr-3">
                        <RangeBadge status={rangeStatus(b.valueNumeric, b.refLow, b.refHigh)} />
                      </td>
                      <td className="py-2.5">
                        <ProvenanceTag kind={provenanceOf(b)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <SectionHeading eyebrow="Wearables" title="Last 7 days">
          Daily aggregates. M3 adds trend charts.
        </SectionHeading>
        {ctx.wearables.length === 0 ? (
          <EmptyState title="No wearable data yet" action={<ButtonLink href="/app/upload#wearable">Upload Apple Health export</ButtonLink>} />
        ) : (
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {ctx.wearables.map((w) => (
              <div key={w.metric} className="rounded-2xl bg-mist-soft p-4">
                <dt className="text-xs text-ink-soft">{METRIC_LABEL[w.metric] ?? w.metric}</dt>
                <dd className="mt-1 font-display text-2xl text-ink">
                  {w.avg7d === null
                    ? "—"
                    : w.metric === "sleep_asleep"
                      ? `${(w.avg7d / 60).toFixed(1)} h`
                      : `${Math.round(w.avg7d).toLocaleString("en-GB")} ${w.unit === "count" ? "" : w.unit}`}
                </dd>
                <dd className="text-xs text-ink-faint">average over {w.days} days</dd>
              </div>
            ))}
          </dl>
        )}
      </Card>

      {issues.length > 0 && (
        <Card>
          <SectionHeading title="Data quality checks">Automatic checks on your records. They help catch unit, entry or extraction problems — they aren&apos;t health findings.</SectionHeading>
          <ul className="space-y-1.5 text-sm">
            {issues.map((i) => (
              <li key={`${i.biomarkerId}-${i.code}`} className="flex gap-2">
                <span aria-hidden className={i.severity === "warning" ? "text-coral-ink" : "text-ink-faint"}>
                  {i.severity === "warning" ? "!" : "i"}
                </span>
                <span className="text-ink-soft">{i.message}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {ctx.missing.length > 0 && (
        <Card>
          <SectionHeading title="What's missing" />
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-soft">
            {ctx.missing.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </Card>
      )}
      <Disclaimer />
    </div>
  );
}

export default function InsightsPage() {
  return (
    <div>
      <PageHeader title="Health Insights">Your results and wearable data, with where each number came from.</PageHeader>
      <Suspense fallback={<p className="text-ink-soft">Loading your data…</p>}>
        <InsightsContent />
      </Suspense>
    </div>
  );
}
