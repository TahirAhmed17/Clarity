import type { Profile } from "@/lib/domain";
import { buildHealthContext } from "../ai/context";
import type { HealthContext } from "../ai/schemas";
import type { HealthRepository } from "../data/repository";

/** Everything the intelligence layer needs about one profile, loaded once per request. */
export async function loadSnapshot(repo: HealthRepository, profileId: string) {
  const profile = await repo.getProfile(profileId);
  if (!profile) throw new Error("Profile not found");
  const [biomarkers, wearables, symptoms, history] = await Promise.all([
    repo.listBiomarkers(profileId),
    repo.listWearableMetrics(profileId),
    repo.listSymptoms(profileId),
    repo.listActionHistory(profileId),
  ]);
  const context = buildHealthContext({ profile, biomarkers, wearables, symptoms });
  return { profile, biomarkers, wearables, symptoms, history, context };
}

export type Snapshot = Awaited<ReturnType<typeof loadSnapshot>>;

export function flaggedFrom(context: HealthContext) {
  return context.biomarkers
    .filter((b): b is typeof b & { rangeStatus: "above" | "below" } => b.rangeStatus === "above" || b.rangeStatus === "below")
    .map((b) => ({ code: b.code, name: b.name, status: b.rangeStatus }));
}

export function recInputFrom(snap: { profile: Profile; symptoms: Snapshot["symptoms"]; history: Snapshot["history"]; context: HealthContext }, question: string | null) {
  const since = Date.now() - 14 * 86_400_000;
  return {
    flagged: flaggedFrom(snap.context),
    symptoms: snap.symptoms.filter((s) => !s.resolvedOn).map((s) => ({ description: s.description, tags: s.tags })),
    goals: snap.profile.goals,
    question,
    wearables: snap.context.wearables.map((w) => ({ metric: w.metric, avg7d: w.avg7d })),
    history: snap.history
      .filter((h) => Date.parse(h.createdAt) >= since)
      .map((h) => ({ actionId: h.actionId, category: h.category, outcome: h.outcome, at: h.createdAt })),
  };
}
