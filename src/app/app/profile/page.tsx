import type { Metadata } from "next";
import { Suspense } from "react";
import { DeleteDataButton } from "@/components/features/delete-data";
import { Badge, Card, PageHeader, ProvenanceTag, SectionHeading } from "@/components/ui/primitives";
import { listEngines } from "@/server/ai/factory";
import { loadPageData } from "@/server/session";

export const metadata: Metadata = { title: "Profile" };

async function ProfileContent() {
  const { repo, profileId, status, env } = await loadPageData();
  const profile = await repo.getProfile(profileId);
  if (!profile) return null;
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <SectionHeading eyebrow="About you" title={profile.displayName} />
        {profile.isSynthetic && <ProvenanceTag kind="synthetic" />}
        <h3 className="mt-5 mb-2 text-sm font-semibold text-teal-ink">Goals</h3>
        <ul className="flex flex-wrap gap-2">
          {profile.goals.map((g) => (
            <li key={g}>
              <Badge tone="lime">{g}</Badge>
            </li>
          ))}
        </ul>
        <h3 className="mt-5 mb-2 text-sm font-semibold text-teal-ink">Routine</h3>
        <dl className="space-y-1.5 text-sm">
          {Object.entries(profile.routine).map(([k, v]) => (
            <div key={k}>
              <dt className="inline font-semibold capitalize">{k}: </dt>
              <dd className="inline text-ink-soft">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-xs text-ink-faint">Editing goals and routine arrives in M3.7.</p>
      </Card>

      <Card>
        <SectionHeading eyebrow="System" title="Data & AI status" />
        <p className="text-sm">
          <span className="font-semibold">Data source:</span> {status.mode} — <span className="text-ink-soft">{status.reason}</span>
        </p>
        <ul className="mt-4 space-y-2 text-sm">
          {listEngines(env).map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{e.label}</span>
              {e.selected && <Badge tone="teal">selected</Badge>}
              {e.experimental && <Badge tone="coral">experimental</Badge>}
              <Badge tone={e.ok ? "teal" : "neutral"}>{e.ok ? "available" : "unavailable"}</Badge>
              <span className="text-ink-faint">{e.reason}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="lg:col-span-2">
        <SectionHeading eyebrow="Your data" title="Correct, export or delete">
          You can download everything Clarity holds about you, or delete it. Correcting individual values arrives in M3.7.
        </SectionHeading>
        <div className="flex flex-wrap items-start gap-3">
          <a href="/api/profile/data" className="inline-flex h-11 items-center rounded-full bg-white px-5 text-sm font-semibold ring-1 ring-line">
            Export my data (JSON)
          </a>
          <DeleteDataButton />
        </div>
      </Card>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <div>
      <PageHeader title="Profile" />
      <Suspense fallback={<p className="text-ink-soft">Loading…</p>}>
        <ProfileContent />
      </Suspense>
    </div>
  );
}
