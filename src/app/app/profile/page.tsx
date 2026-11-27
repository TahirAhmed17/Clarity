import type { Metadata } from "next";
import { Suspense } from "react";
import { DeleteDataButton } from "@/components/features/delete-data";
import { DisplayPreferences } from "@/components/features/display-preferences";
import { GoalsEditor } from "@/components/features/goals-editor";
import { PostButton } from "@/components/features/post-button";
import { RoutineEditor } from "@/components/features/routine-editor";
import { Badge, Card, PageHeader, ProvenanceTag, SectionHeading } from "@/components/ui/primitives";
import { listEngines } from "@/server/ai/factory";
import { loadPageData } from "@/server/session";

export const metadata: Metadata = { title: "Profile" };

const KIND = { blood_report_pdf: "Blood report", apple_health_xml: "Apple Health export", wearable_csv: "Wearable file" } as const;

async function ProfileContent() {
  const { repo, profileId, status, env } = await loadPageData();
  const [profile, documents, biomarkers] = await Promise.all([repo.getProfile(profileId), repo.listDocuments(profileId), repo.listBiomarkers(profileId)]);
  if (!profile) return null;
  const corrected = biomarkers.filter((b) => b.correction);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <SectionHeading eyebrow="About you" title={profile.displayName} />
        {profile.isSynthetic && <ProvenanceTag kind="synthetic" />}
        <h3 className="mt-6 mb-2 font-display text-lg">Goals</h3>
        <GoalsEditor initial={profile.goals} />
        <h3 className="mt-8 mb-3 font-display text-lg">Routine</h3>
        <RoutineEditor initial={profile.routine} />
        <p className="mt-3 text-xs text-ink-faint">Goal and routine changes are saved to your timeline.</p>
      </Card>

      <div className="space-y-6">
        <Card>
          <SectionHeading title="Your records">Each file you added, and what Clarity read from it. Deleting a file removes everything read from it.</SectionHeading>
          {documents.length === 0 ? (
            <p className="text-sm text-ink-soft">Nothing added yet.</p>
          ) : (
            <ul className="hairline">
              {documents.map((d) => {
                const count = biomarkers.filter((b) => b.documentId === d.id).length;
                return (
                  <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-ink">{d.originalFilename}</span>
                      <span className="block text-sm text-ink-soft">
                        {KIND[d.kind]}
                        {d.collectedOn ? `, ${d.collectedOn}` : ", no collection date found"}
                        {d.kind === "blood_report_pdf" ? `, ${count} results` : ""}
                      </span>
                      <span className="mt-1 inline-block">{d.isSynthetic ? <ProvenanceTag kind="synthetic" /> : <ProvenanceTag kind="extracted" />}</span>
                    </span>
                    <PostButton url={`/api/documents/${d.id}`} method="DELETE" label="Delete" variant="secondary" confirm="Delete this file and everything read from it?" pendingLabel="Deleting…" className="h-9" />
                  </li>
                );
              })}
            </ul>
          )}
          {corrected.length > 0 && <p className="mt-3 text-sm text-ink-soft">You&apos;ve corrected {corrected.length} value{corrected.length > 1 ? "s" : ""}. Originals are kept alongside your corrections.</p>}
        </Card>

        <Card>
          <SectionHeading title="Display">Settings for this device.</SectionHeading>
          <DisplayPreferences />
        </Card>

        <Card>
          <SectionHeading title="Data and AI">Where your data lives and which AI engine answers.</SectionHeading>
          <p className="text-sm">
            <span className="font-semibold">Data source:</span> {status.mode === "database" ? "your database" : "built-in synthetic demo data"}. <span className="text-ink-soft">{status.reason}</span>
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            {listEngines(env).map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{e.label}</span>
                {e.selected && <Badge tone="teal">in use</Badge>}
                {e.experimental && <Badge tone="coral">experimental</Badge>}
                <Badge tone={e.ok ? "teal" : "neutral"}>{e.ok ? "available" : "not set up"}</Badge>
                <span className="text-ink-faint">{e.reason}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <SectionHeading title="Export or delete everything">Download all your data as a file, or remove every health record Clarity holds.</SectionHeading>
          <div className="flex flex-wrap items-start gap-3">
            <a href="/api/profile/data" className="inline-flex h-11 items-center rounded-full bg-white px-5 text-sm font-semibold ring-1 ring-line">
              Download my data
            </a>
            <DeleteDataButton />
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <div>
      <PageHeader title="Profile">What Clarity knows about you, where it came from, and how to change it.</PageHeader>
      <Suspense fallback={<p className="text-ink-soft">Loading…</p>}>
        <ProfileContent />
      </Suspense>
    </div>
  );
}
