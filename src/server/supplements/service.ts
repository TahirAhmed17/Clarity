import { z } from "zod";
import type { SupplementSuggestion } from "@/lib/domain";
import type { HealthRepository } from "../data/repository";
import { flaggedFrom, loadSnapshot } from "../insights/snapshot";

/**
 * Supplement workflow (M2.8). Clarity may suggest an ELIGIBLE CATEGORY from the curated catalogue,
 * with a reason; it never sets a dose. Every suggestion starts "pending" and only a (simulated)
 * reviewer can approve it with a dose, change it, or reject it.
 */

const RULES: { slug: string; code: string; status: "above" | "below"; rationale: string }[] = [
  { slug: "vitamin-d", code: "VITD25OH", status: "below", rationale: "Your vitamin D (25-OH) result is below your lab's range." },
  { slug: "iron", code: "FERRITIN", status: "below", rationale: "Your ferritin is below your lab's range. The cause of low iron stores should be assessed before any supplement." },
  { slug: "vitamin-b12", code: "B12", status: "below", rationale: "Your vitamin B12 result is below your lab's range." },
  { slug: "omega-3", code: "TRIG", status: "above", rationale: "Your triglycerides are above your lab's range; omega-3s are sometimes discussed alongside triglycerides." },
  { slug: "soluble-fibre", code: "LDL", status: "above", rationale: "Your LDL cholesterol is above your lab's range; soluble fibre is sometimes discussed alongside diet changes." },
];

export async function suggestSupplements(repo: HealthRepository, profileId: string) {
  const snap = await loadSnapshot(repo, profileId);
  const flagged = flaggedFrom(snap.context);
  const [catalogue, existing] = await Promise.all([repo.listSupplementCatalogue(), repo.listSupplementSuggestions(profileId)]);
  const created: SupplementSuggestion[] = [];
  for (const rule of RULES) {
    if (!flagged.some((f) => f.code === rule.code && f.status === rule.status)) continue;
    const item = catalogue.find((c) => c.slug === rule.slug);
    // Don't re-suggest something already suggested (whatever its review outcome).
    if (!item || existing.some((e) => e.catalogueId === item.id)) continue;
    created.push(await repo.createSupplementSuggestion(profileId, { catalogueId: item.id, rationale: rule.rationale }));
  }
  return created;
}

export const ReviewSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("approved"), reviewerDose: z.string().trim().min(2).max(200), reviewerNote: z.string().trim().max(500).nullable().optional() }),
  z.object({ status: z.literal("changed"), catalogueId: z.string().uuid(), reviewerDose: z.string().trim().max(200).nullable().optional(), reviewerNote: z.string().trim().min(2).max(500) }),
  z.object({ status: z.literal("rejected"), reviewerNote: z.string().trim().min(2).max(500) }),
]);
