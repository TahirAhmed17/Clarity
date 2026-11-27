import { randomUUID } from "node:crypto";
import { buildSeedDataset } from "@/data/synthetic/dataset";
import type {
  ActionHistoryEntry,
  ActionPlan,
  EventRequest,
  SuggestionReview,
  TimelineNote,
  Biomarker,
  ChatMessage,
  HealthDocument,
  Profile,
  SupplementSuggestion,
  SymptomEntry,
  WearableMetric,
} from "@/lib/domain";
import type { HealthRepository, NewDocument } from "./repository";

/**
 * In-memory repository backed by the bundled synthetic dataset.
 * Used when Supabase is unreachable or DATA_MODE=seed.
 * Writes live only for the lifetime of the server process — NOT persistent.
 */
export class SeedRepository implements HealthRepository {
  readonly mode = "seed" as const;

  private profiles: Profile[];
  private documents: HealthDocument[];
  private biomarkers: Biomarker[];
  private wearables: WearableMetric[];
  private symptoms: SymptomEntry[];
  private suggestions: SupplementSuggestion[] = [];
  private messages: ChatMessage[] = [];
  private plans: ActionPlan[] = [];
  private history: ActionHistoryEntry[] = [];
  private eventRequests: EventRequest[] = [];
  private timeline: TimelineNote[] = [];
  private readonly data = buildSeedDataset();

  constructor() {
    const d = this.data;
    this.profiles = structuredClone(d.profiles);
    this.biomarkers = structuredClone(d.biomarkers);
    this.wearables = structuredClone(d.wearableMetrics);
    this.symptoms = structuredClone(d.symptoms);
    this.documents = [
      {
        id: d.historicalReport.documentId!,
        profileId: d.profiles[0].id,
        kind: "blood_report_pdf",
        originalFilename: "synthetic-history-2026-04.pdf",
        mimeType: "application/pdf",
        sizeBytes: 0,
        sha256: "synthetic-historical-report",
        status: "processed",
        extractionMethod: "synthetic_seed",
        collectedOn: d.historicalReport.collectedOn,
        errorMessage: null,
        isSynthetic: true,
        createdAt: "2026-04-10T10:00:00.000Z",
      },
    ];
  }

  async getProfile(profileId: string) {
    return this.profiles.find((p) => p.id === profileId) ?? null;
  }

  async updateProfile(
    profileId: string,
    patch: Partial<Pick<Profile, "displayName" | "goals" | "routine">>,
    timelineNotes: Pick<TimelineNote, "kind" | "title" | "detail">[] = [],
  ) {
    const p = this.profiles.find((x) => x.id === profileId);
    if (!p) return null;
    Object.assign(p, patch);
    for (const n of timelineNotes) await this.addTimelineNote(profileId, n);
    return p;
  }

  async listDocuments(profileId: string) {
    return this.documents.filter((d) => d.profileId === profileId);
  }

  async findDocumentByHash(profileId: string, sha256: string) {
    return this.documents.find((d) => d.profileId === profileId && d.sha256 === sha256) ?? null;
  }

  async createDocument(profileId: string, doc: NewDocument) {
    const row: HealthDocument = { ...doc, id: randomUUID(), profileId, createdAt: new Date().toISOString() };
    this.documents.push(row);
    return row;
  }

  async listBiomarkers(profileId: string) {
    return this.biomarkers.filter((b) => b.profileId === profileId);
  }

  async addBiomarkers(profileId: string, rows: Omit<Biomarker, "id" | "profileId">[]) {
    const created = rows.map((r) => ({ ...r, id: randomUUID(), profileId }));
    this.biomarkers.push(...created);
    return created;
  }

  async listWearableMetrics(profileId: string) {
    return this.wearables.filter((w) => w.profileId === profileId);
  }

  async upsertWearableMetrics(profileId: string, rows: Omit<WearableMetric, "id" | "profileId">[]) {
    for (const r of rows) {
      const i = this.wearables.findIndex(
        (w) =>
          w.profileId === profileId &&
          w.metricType === r.metricType &&
          w.day === r.day &&
          w.aggregation === r.aggregation &&
          w.sourceFormat === r.sourceFormat,
      );
      const row = { ...r, id: i >= 0 ? this.wearables[i].id : randomUUID(), profileId };
      if (i >= 0) this.wearables[i] = row;
      else this.wearables.push(row);
    }
    return rows.length;
  }

  async listSymptoms(profileId: string) {
    return this.symptoms.filter((s) => s.profileId === profileId);
  }

  async addSymptom(profileId: string, entry: Pick<SymptomEntry, "description" | "severity" | "startedOn" | "tags">) {
    const row: SymptomEntry = {
      ...entry,
      id: randomUUID(),
      profileId,
      resolvedOn: null,
      source: "user_provided",
      createdAt: new Date().toISOString(),
    };
    this.symptoms.push(row);
    return row;
  }

  async listSupplementCatalogue() {
    return this.data.supplementCatalogue;
  }

  async listSupplementSuggestions(profileId: string) {
    return this.suggestions.filter((s) => s.profileId === profileId);
  }

  async listEvents() {
    return this.data.events;
  }

  async listMessages(profileId: string, conversationId = "default") {
    return this.messages.filter((m) => m.profileId === profileId && m.conversationId === conversationId);
  }

  async addMessage(
    profileId: string,
    msg: Pick<ChatMessage, "role" | "content" | "structured" | "engine"> & { conversationId?: string },
  ) {
    const row: ChatMessage = {
      id: randomUUID(),
      profileId,
      conversationId: msg.conversationId ?? "default",
      role: msg.role,
      content: msg.content,
      structured: msg.structured ?? null,
      engine: msg.engine ?? null,
      createdAt: new Date().toISOString(),
    };
    this.messages.push(row);
    return row;
  }

  // ---- M2 ----

  async getActivePlan(profileId: string) {
    return [...this.plans].reverse().find((p) => p.profileId === profileId && p.status === "active") ?? null;
  }

  async savePlan(profileId: string, plan: Pick<ActionPlan, "planDate" | "primaryAction" | "supportingActions" | "rationale" | "generatedBy">) {
    for (const p of this.plans) if (p.profileId === profileId && p.status === "active") p.status = "superseded";
    const row: ActionPlan = { ...structuredClone(plan), id: randomUUID(), profileId, status: "active", createdAt: new Date().toISOString() };
    this.plans.push(row);
    return row;
  }

  async updatePlanActionStatus(profileId: string, planId: string, actionId: string, status: "completed" | "skipped" | "pending") {
    const plan = this.plans.find((p) => p.id === planId && p.profileId === profileId);
    if (!plan) return null;
    for (const a of [plan.primaryAction, ...plan.supportingActions]) if (a.id === actionId) a.status = status;
    return plan;
  }

  async addActionHistory(profileId: string, entry: Omit<ActionHistoryEntry, "id" | "profileId" | "createdAt">) {
    const row: ActionHistoryEntry = { ...entry, id: randomUUID(), profileId, createdAt: new Date().toISOString() };
    this.history.push(row);
    return row;
  }

  async listActionHistory(profileId: string) {
    return this.history.filter((h) => h.profileId === profileId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async listPlans(profileId: string) {
    return this.plans.filter((p) => p.profileId === profileId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async createSupplementSuggestion(profileId: string, s: { catalogueId: string; rationale: string }) {
    const row: SupplementSuggestion = {
      id: randomUUID(),
      profileId,
      catalogueId: s.catalogueId,
      rationale: s.rationale,
      status: "pending",
      reviewerDose: null,
      reviewerNote: null,
      reviewedAt: null,
      isSimulatedReview: true,
      createdAt: new Date().toISOString(),
    };
    this.suggestions.push(row);
    return row;
  }

  async listSuggestionsForReview() {
    return this.suggestions.map((s) => ({ ...s, profileDisplayName: this.profiles.find((p) => p.id === s.profileId)?.displayName ?? "Unknown" }));
  }

  async reviewSuggestion(suggestionId: string, _reviewerProfileId: string, review: SuggestionReview) {
    const s = this.suggestions.find((x) => x.id === suggestionId);
    if (!s) return null;
    s.status = review.status;
    s.reviewerNote = review.reviewerNote ?? null;
    s.reviewerDose = review.status === "rejected" ? null : (review.reviewerDose ?? null);
    if (review.status === "changed") s.catalogueId = review.catalogueId;
    s.reviewedAt = new Date().toISOString();
    return s;
  }

  async createEventRequest(profileId: string, eventId: string, note: string | null) {
    const row: EventRequest = { id: randomUUID(), profileId, eventId, status: "requested", note, isMock: true, createdAt: new Date().toISOString() };
    this.eventRequests.push(row);
    return row;
  }

  async listEventRequests(profileId: string) {
    return this.eventRequests.filter((r) => r.profileId === profileId);
  }

  async addTimelineNote(profileId: string, note: Pick<TimelineNote, "kind" | "title" | "detail">) {
    const row: TimelineNote = { ...note, id: randomUUID(), profileId, occurredAt: new Date().toISOString() };
    this.timeline.push(row);
    return row;
  }

  async listTimelineNotes(profileId: string) {
    return this.timeline.filter((t) => t.profileId === profileId);
  }

  async deleteProfileHealthData(profileId: string) {
    const keep = <T extends { profileId: string }>(rows: T[]) => rows.filter((r) => r.profileId !== profileId);
    this.documents = keep(this.documents);
    this.biomarkers = keep(this.biomarkers);
    this.wearables = keep(this.wearables);
    this.symptoms = keep(this.symptoms);
    this.suggestions = keep(this.suggestions);
    this.messages = keep(this.messages);
    this.plans = keep(this.plans);
    this.history = keep(this.history);
    this.eventRequests = keep(this.eventRequests);
    this.timeline = keep(this.timeline);
  }
}
