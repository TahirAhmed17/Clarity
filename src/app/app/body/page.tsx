import type { Metadata } from "next";
import { Suspense } from "react";
import { BodyExplorer } from "@/components/body/body-explorer";
import { Disclaimer, PageHeader } from "@/components/ui/primitives";
import { getRetriever } from "@/server/evidence";
import { retrievedToRefs } from "@/server/evidence/refs";
import { loadPageData } from "@/server/session";
import { buildSystemInsights } from "@/server/systems/organ-systems";

export const metadata: Metadata = { title: "Organ & System Insights" };

async function SystemsContent() {
  const { repo, profileId } = await loadPageData();
  const insights = await buildSystemInsights(await repo.listBiomarkers(profileId), await getRetriever());
  return (
    <>
      <BodyExplorer insights={insights.map(({ evidence, ...rest }) => ({ ...rest, refs: retrievedToRefs(evidence) }))} />
      <Disclaimer className="mt-10" />
    </>
  );
}

export default function BodyPage() {
  return (
    <div>
      <PageHeader title="Your body, system by system">
        What your results say about each system: what was measured, what changed, and what&apos;s missing. No scores, and no diagnoses.
      </PageHeader>
      <Suspense fallback={<p className="text-ink-soft">Loading systems…</p>}>
        <SystemsContent />
      </Suspense>
    </div>
  );
}
