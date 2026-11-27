import type { ActionPlan, PlanActionItem } from "@/lib/domain";
import type { HealthRepository } from "../data/repository";
import { loadSnapshot, recInputFrom } from "../insights/snapshot";
import { recommend, type Recommendation } from "./engine";

export const ENGINE_VERSION = "recommendation-engine-v1";

const toItem = (r: Recommendation): PlanActionItem => ({
  id: r.id,
  title: r.title,
  detail: r.detail,
  category: r.category,
  status: "pending",
  reasons: r.reasons,
  evidenceChunkIds: r.evidenceChunkIds,
});

/** Generates today's plan (one primary action + ≤3 supporting) and supersedes the previous one. */
export async function generatePlan(repo: HealthRepository, profileId: string, today = new Date().toISOString().slice(0, 10)): Promise<ActionPlan> {
  const snap = await loadSnapshot(repo, profileId);
  const rec = recommend(recInputFrom(snap, null));
  return repo.savePlan(profileId, {
    planDate: today,
    primaryAction: toItem(rec.primary),
    supportingActions: rec.supporting.map(toItem),
    rationale: rec.primary.reasons.join("; ") || "General guidance",
    generatedBy: ENGINE_VERSION,
  });
}

/** Records complete/skip on a plan action and in action history (used to adapt future plans). */
export async function recordActionOutcome(
  repo: HealthRepository,
  profileId: string,
  planId: string,
  actionId: string,
  outcome: "completed" | "skipped",
) {
  const plan = await repo.updatePlanActionStatus(profileId, planId, actionId, outcome);
  if (!plan) return null;
  const action = [plan.primaryAction, ...plan.supportingActions].find((a) => a.id === actionId);
  if (!action) return null;
  await repo.addActionHistory(profileId, { planId, actionId, actionTitle: action.title, category: action.category, outcome, note: null });
  return plan;
}
