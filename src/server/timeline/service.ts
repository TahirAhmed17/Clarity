import type { Provenance } from "@/lib/constants";
import { biomarkerHistories } from "../biomarkers/intelligence";
import type { HealthRepository } from "../data/repository";

/**
 * Longitudinal timeline (M2.10). Built from the source tables so nothing is duplicated:
 * reports + their results, wearable imports, symptoms, goal/routine changes, plans,
 * completed/skipped actions, supplement reviews and event requests.
 */
export type TimelineKind = "report" | "wearable_import" | "symptom" | "profile_change" | "plan" | "action" | "supplement" | "event_request";

export interface TimelineItem {
  id: string;
  kind: TimelineKind;
  at: string;
  title: string;
  detail: string;
  provenance: Provenance;
}

export async function buildTimeline(repo: HealthRepository, profileId: string): Promise<TimelineItem[]> {
  const [documents, biomarkers, symptoms, notes, plans, history, suggestions, catalogue, requests, events] = await Promise.all([
    repo.listDocuments(profileId),
    repo.listBiomarkers(profileId),
    repo.listSymptoms(profileId),
    repo.listTimelineNotes(profileId),
    repo.listPlans(profileId),
    repo.listActionHistory(profileId),
    repo.listSupplementSuggestions(profileId),
    repo.listSupplementCatalogue(),
    repo.listEventRequests(profileId),
    repo.listEvents(),
  ]);
  const items: TimelineItem[] = [];

  for (const d of documents) {
    if (d.kind === "blood_report_pdf") {
      const rows = biomarkers.filter((b) => b.documentId === d.id);
      const outside = rows.filter((b) => (b.refLow !== null && b.valueNumeric !== null && b.valueNumeric < b.refLow) || (b.refHigh !== null && b.valueNumeric !== null && b.valueNumeric > b.refHigh));
      items.push({
        id: `doc-${d.id}`,
        kind: "report",
        at: d.collectedOn ?? d.createdAt.slice(0, 10),
        title: "Blood report",
        detail: `${rows.length} results${outside.length ? `, ${outside.length} outside the lab's range (${outside.map((b) => b.nameAsReported).join(", ")})` : ""}.`,
        provenance: d.isSynthetic ? "synthetic" : "extracted",
      });
    } else {
      items.push({ id: `doc-${d.id}`, kind: "wearable_import", at: d.collectedOn ?? d.createdAt.slice(0, 10), title: "Wearable data imported", detail: d.originalFilename, provenance: d.isSynthetic ? "synthetic" : "extracted" });
    }
  }
  for (const s of symptoms) items.push({ id: `sym-${s.id}`, kind: "symptom", at: s.startedOn ?? s.createdAt.slice(0, 10), title: "Symptom noted", detail: s.description, provenance: "user_provided" });
  for (const n of notes) items.push({ id: `note-${n.id}`, kind: "profile_change", at: n.occurredAt, title: n.title, detail: typeof n.detail.summary === "string" ? n.detail.summary : "", provenance: "user_provided" });
  for (const p of plans) items.push({ id: `plan-${p.id}`, kind: "plan", at: p.createdAt, title: "Plan created", detail: `Next move: ${p.primaryAction.title}`, provenance: "calculated" });
  for (const h of history) items.push({ id: `act-${h.id}`, kind: "action", at: h.createdAt, title: h.outcome === "completed" ? "Action completed" : "Action skipped", detail: h.actionTitle, provenance: "user_provided" });
  for (const s of suggestions) {
    const item = catalogue.find((c) => c.id === s.catalogueId);
    items.push({
      id: `sup-${s.id}`,
      kind: "supplement",
      at: s.reviewedAt ?? s.createdAt,
      title: s.status === "pending" ? "Supplement category suggested (awaiting review)" : `Supplement suggestion ${s.status}`,
      detail: `${item?.name ?? "Supplement"}${s.reviewerDose ? ` — reviewer dose: ${s.reviewerDose}` : ""}`,
      provenance: s.status === "pending" ? "ai_interpretation" : "simulated_review",
    });
  }
  for (const r of requests) {
    const ev = events.find((e) => e.id === r.eventId);
    items.push({ id: `evr-${r.id}`, kind: "event_request", at: r.createdAt, title: "Booking requested (mock)", detail: ev?.title ?? "Event", provenance: "user_provided" });
  }
  return items.sort((a, b) => b.at.localeCompare(a.at));
}

/** Report-to-report comparison for every biomarker measured more than once. */
export function longitudinalChanges(biomarkers: Parameters<typeof biomarkerHistories>[0]) {
  return biomarkerHistories(biomarkers).filter((h) => h.points.length > 1);
}
