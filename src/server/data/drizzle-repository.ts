import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type {
  ActionHistoryEntry,
  ActionPlan,
  SuggestionReview,
  TimelineNote,
  Biomarker,
  ChatMessage,
  HealthDocument,
  NewBiomarker,
  NewWearableMetric,
  Profile,
  SupplementSuggestion,
  SymptomEntry,
  WearableMetric,
} from "@/lib/domain";
import * as s from "../db/schema";
import type { HealthRepository, NewDocument } from "./repository";

export type ClarityDb = PgDatabase<PgQueryResultHKT, typeof s>;

const num = (v: string | null): number | null => (v === null ? null : Number(v));
const numStr = (v: number | null): string | null => (v === null ? null : String(v));
const iso = (d: Date | null) => (d ? d.toISOString() : null);

const toProfile = (r: s.ProfileRow): Profile => ({
  id: r.id,
  role: r.role,
  displayName: r.displayName,
  birthYear: r.birthYear,
  sexAtBirth: r.sexAtBirth,
  goals: r.goals,
  routine: r.routine,
  isSynthetic: r.isSynthetic,
});

const toDocument = (r: s.DocumentRow): HealthDocument => ({ ...r, createdAt: r.createdAt.toISOString() });

const toBiomarker = (r: s.BiomarkerRow): Biomarker => ({
  id: r.id,
  profileId: r.profileId,
  documentId: r.documentId,
  code: r.code,
  nameAsReported: r.nameAsReported,
  valueNumeric: num(r.valueNumeric),
  valueText: r.valueText,
  unitAsReported: r.unitAsReported,
  refLow: num(r.refLow),
  refHigh: num(r.refHigh),
  refText: r.refText,
  flagAsReported: r.flagAsReported,
  observedOn: r.observedOn,
  source: r.source,
  confidence: r.confidence,
  pageNumber: r.pageNumber,
});

const toWearable = (r: s.WearableMetricRow): WearableMetric => ({
  id: r.id,
  profileId: r.profileId,
  documentId: r.documentId,
  metricType: r.metricType as WearableMetric["metricType"],
  value: Number(r.value),
  unit: r.unit as WearableMetric["unit"],
  aggregation: r.aggregation as WearableMetric["aggregation"],
  day: r.day,
  sampleCount: r.sampleCount,
  sourceFormat: r.sourceFormat,
  sourceName: r.sourceName,
});

const toSymptom = (r: s.SymptomRow): SymptomEntry => ({ ...r, createdAt: r.createdAt.toISOString() });

const toSuggestion = (r: s.SupplementSuggestionRow): SupplementSuggestion => ({
  id: r.id,
  profileId: r.profileId,
  catalogueId: r.catalogueId,
  rationale: r.rationale,
  status: r.status,
  reviewerDose: r.reviewerDose,
  reviewerNote: r.reviewerNote,
  reviewedAt: iso(r.reviewedAt),
  isSimulatedReview: r.isSimulatedReview,
  createdAt: r.createdAt.toISOString(),
});

const toPlan = (r: s.ActionPlanRow): ActionPlan => ({ ...r, createdAt: r.createdAt.toISOString() });

const toMessage = (r: s.MessageRow): ChatMessage => ({ ...r, createdAt: r.createdAt.toISOString() });

export class DrizzleRepository implements HealthRepository {
  readonly mode = "database" as const;
  constructor(private readonly db: ClarityDb) {}

  async getProfile(profileId: string) {
    const [r] = await this.db.select().from(s.profiles).where(eq(s.profiles.id, profileId)).limit(1);
    return r ? toProfile(r) : null;
  }

  async updateProfile(
    profileId: string,
    patch: Partial<Pick<Profile, "displayName" | "goals" | "routine">>,
    timelineNotes: Pick<TimelineNote, "kind" | "title" | "detail">[] = [],
  ) {
    // Profile change and its timeline entries commit together or not at all.
    return this.db.transaction(async (tx) => {
      const [r] = await tx
        .update(s.profiles)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(s.profiles.id, profileId))
        .returning();
      if (!r) return null;
      if (timelineNotes.length) await tx.insert(s.healthTimelineEvents).values(timelineNotes.map((n) => ({ ...n, profileId })));
      return toProfile(r);
    });
  }

  async listDocuments(profileId: string) {
    const rows = await this.db.select().from(s.documents).where(eq(s.documents.profileId, profileId)).orderBy(asc(s.documents.createdAt));
    return rows.map(toDocument);
  }

  async findDocumentByHash(profileId: string, sha256: string) {
    const [r] = await this.db
      .select()
      .from(s.documents)
      .where(and(eq(s.documents.profileId, profileId), eq(s.documents.sha256, sha256)))
      .limit(1);
    return r ? toDocument(r) : null;
  }

  async createDocument(profileId: string, doc: NewDocument) {
    const [r] = await this.db.insert(s.documents).values({ ...doc, profileId }).returning();
    return toDocument(r);
  }

  async listBiomarkers(profileId: string) {
    const rows = await this.db
      .select()
      .from(s.biomarkers)
      .where(eq(s.biomarkers.profileId, profileId))
      .orderBy(asc(s.biomarkers.observedOn));
    return rows.map(toBiomarker);
  }

  async addBiomarkers(profileId: string, rows: NewBiomarker[]) {
    if (rows.length === 0) return [];
    const inserted = await this.db
      .insert(s.biomarkers)
      .values(
        rows.map((b) => ({
          ...b,
          profileId,
          valueNumeric: numStr(b.valueNumeric),
          refLow: numStr(b.refLow),
          refHigh: numStr(b.refHigh),
        })),
      )
      .returning();
    return inserted.map(toBiomarker);
  }

  async listWearableMetrics(profileId: string) {
    const rows = await this.db
      .select()
      .from(s.wearableMetrics)
      .where(eq(s.wearableMetrics.profileId, profileId))
      .orderBy(asc(s.wearableMetrics.day));
    return rows.map(toWearable);
  }

  async upsertWearableMetrics(profileId: string, rows: NewWearableMetric[]) {
    if (rows.length === 0) return 0;
    const chunk = 500;
    for (let i = 0; i < rows.length; i += chunk) {
      await this.db
        .insert(s.wearableMetrics)
        .values(rows.slice(i, i + chunk).map((w) => ({ ...w, profileId, value: String(w.value) })))
        .onConflictDoUpdate({
          target: [s.wearableMetrics.profileId, s.wearableMetrics.metricType, s.wearableMetrics.day, s.wearableMetrics.aggregation, s.wearableMetrics.sourceFormat],
          set: {
            value: sql`excluded.value`,
            sampleCount: sql`excluded.sample_count`,
            unit: sql`excluded.unit`,
            sourceName: sql`excluded.source_name`,
            documentId: sql`excluded.document_id`,
          },
        });
    }
    return rows.length;
  }

  async listSymptoms(profileId: string) {
    const rows = await this.db.select().from(s.symptomEntries).where(eq(s.symptomEntries.profileId, profileId)).orderBy(asc(s.symptomEntries.createdAt));
    return rows.map(toSymptom);
  }

  async addSymptom(profileId: string, entry: Pick<SymptomEntry, "description" | "severity" | "startedOn" | "tags">) {
    const [r] = await this.db.insert(s.symptomEntries).values({ ...entry, profileId, source: "user_provided" }).returning();
    return toSymptom(r);
  }

  async listSupplementCatalogue() {
    const rows = await this.db.select().from(s.supplementCatalogue).orderBy(asc(s.supplementCatalogue.name));
    return rows.map(({ createdAt: _c, ...rest }) => rest);
  }

  async listSupplementSuggestions(profileId: string) {
    const rows = await this.db.select().from(s.supplementSuggestions).where(eq(s.supplementSuggestions.profileId, profileId));
    return rows.map(toSuggestion);
  }

  async listEvents() {
    const rows = await this.db.select().from(s.events).orderBy(asc(s.events.startsAt));
    return rows.map(({ createdAt: _c, startsAt, ...rest }) => ({ ...rest, startsAt: iso(startsAt) }));
  }

  async listMessages(profileId: string, conversationId = "default") {
    const rows = await this.db
      .select()
      .from(s.messages)
      .where(and(eq(s.messages.profileId, profileId), eq(s.messages.conversationId, conversationId)))
      .orderBy(asc(s.messages.createdAt));
    return rows.map(toMessage);
  }

  async addMessage(
    profileId: string,
    msg: Pick<ChatMessage, "role" | "content" | "structured" | "engine"> & { conversationId?: string },
  ) {
    const [r] = await this.db
      .insert(s.messages)
      .values({
        profileId,
        conversationId: msg.conversationId ?? "default",
        role: msg.role,
        content: msg.content,
        structured: msg.structured ?? null,
        engine: msg.engine ?? null,
      })
      .returning();
    return toMessage(r);
  }

  // ---- M2 ----

  async getActivePlan(profileId: string) {
    const [r] = await this.db
      .select()
      .from(s.actionPlans)
      .where(and(eq(s.actionPlans.profileId, profileId), eq(s.actionPlans.status, "active")))
      .orderBy(desc(s.actionPlans.createdAt))
      .limit(1);
    return r ? toPlan(r) : null;
  }

  async savePlan(profileId: string, plan: Pick<ActionPlan, "planDate" | "primaryAction" | "supportingActions" | "rationale" | "generatedBy">) {
    return this.db.transaction(async (tx) => {
      await tx
        .update(s.actionPlans)
        .set({ status: "superseded" })
        .where(and(eq(s.actionPlans.profileId, profileId), eq(s.actionPlans.status, "active")));
      const [r] = await tx.insert(s.actionPlans).values({ ...plan, profileId, status: "active" }).returning();
      return toPlan(r);
    });
  }

  async updatePlanActionStatus(profileId: string, planId: string, actionId: string, status: "completed" | "skipped" | "pending") {
    const [r] = await this.db
      .select()
      .from(s.actionPlans)
      .where(and(eq(s.actionPlans.id, planId), eq(s.actionPlans.profileId, profileId)))
      .limit(1);
    if (!r) return null;
    const primaryAction = r.primaryAction.id === actionId ? { ...r.primaryAction, status } : r.primaryAction;
    const supportingActions = r.supportingActions.map((a) => (a.id === actionId ? { ...a, status } : a));
    const [u] = await this.db.update(s.actionPlans).set({ primaryAction, supportingActions }).where(eq(s.actionPlans.id, planId)).returning();
    return toPlan(u);
  }

  async addActionHistory(profileId: string, entry: Omit<ActionHistoryEntry, "id" | "profileId" | "createdAt">) {
    const [r] = await this.db.insert(s.actionHistory).values({ ...entry, profileId }).returning();
    return { ...r, createdAt: r.createdAt.toISOString() };
  }

  async listActionHistory(profileId: string) {
    const rows = await this.db.select().from(s.actionHistory).where(eq(s.actionHistory.profileId, profileId)).orderBy(desc(s.actionHistory.createdAt));
    return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
  }

  async listPlans(profileId: string) {
    const rows = await this.db.select().from(s.actionPlans).where(eq(s.actionPlans.profileId, profileId)).orderBy(desc(s.actionPlans.createdAt));
    return rows.map(toPlan);
  }

  async createSupplementSuggestion(profileId: string, sug: { catalogueId: string; rationale: string }) {
    const [r] = await this.db.insert(s.supplementSuggestions).values({ ...sug, profileId }).returning();
    return toSuggestion(r);
  }

  async listSuggestionsForReview() {
    const rows = await this.db
      .select({ sug: s.supplementSuggestions, name: s.profiles.displayName })
      .from(s.supplementSuggestions)
      .innerJoin(s.profiles, eq(s.profiles.id, s.supplementSuggestions.profileId))
      .orderBy(desc(s.supplementSuggestions.createdAt));
    return rows.map((r) => ({ ...toSuggestion(r.sug), profileDisplayName: r.name }));
  }

  async reviewSuggestion(suggestionId: string, reviewerProfileId: string, review: SuggestionReview) {
    const [r] = await this.db
      .update(s.supplementSuggestions)
      .set({
        status: review.status,
        reviewerNote: review.reviewerNote ?? null,
        reviewerDose: review.status === "rejected" ? null : (review.reviewerDose ?? null),
        ...(review.status === "changed" ? { catalogueId: review.catalogueId } : {}),
        reviewerProfileId,
        reviewedAt: new Date(),
      })
      .where(eq(s.supplementSuggestions.id, suggestionId))
      .returning();
    return r ? toSuggestion(r) : null;
  }

  async createEventRequest(profileId: string, eventId: string, note: string | null) {
    const [r] = await this.db.insert(s.eventRequests).values({ profileId, eventId, note }).returning();
    return { ...r, createdAt: r.createdAt.toISOString() };
  }

  async listEventRequests(profileId: string) {
    const rows = await this.db.select().from(s.eventRequests).where(eq(s.eventRequests.profileId, profileId));
    return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
  }

  async addTimelineNote(profileId: string, note: Pick<TimelineNote, "kind" | "title" | "detail">) {
    const [r] = await this.db.insert(s.healthTimelineEvents).values({ ...note, profileId }).returning();
    return { ...r, occurredAt: r.occurredAt.toISOString() };
  }

  async listTimelineNotes(profileId: string) {
    const rows = await this.db.select().from(s.healthTimelineEvents).where(eq(s.healthTimelineEvents.profileId, profileId));
    return rows.map((r) => ({ ...r, occurredAt: r.occurredAt.toISOString() }));
  }

  async deleteProfileHealthData(profileId: string) {
    await this.db.transaction(async (tx) => {
      // Order respects FKs; documents last because biomarkers/wearables reference them.
      await tx.delete(s.healthTimelineEvents).where(eq(s.healthTimelineEvents.profileId, profileId));
      await tx.delete(s.actionHistory).where(eq(s.actionHistory.profileId, profileId));
      await tx.delete(s.messages).where(eq(s.messages.profileId, profileId));
      await tx.delete(s.actionPlans).where(eq(s.actionPlans.profileId, profileId));
      await tx.delete(s.eventRequests).where(eq(s.eventRequests.profileId, profileId));
      await tx.delete(s.supplementSuggestions).where(eq(s.supplementSuggestions.profileId, profileId));
      await tx.delete(s.symptomEntries).where(eq(s.symptomEntries.profileId, profileId));
      await tx.delete(s.wearableMetrics).where(eq(s.wearableMetrics.profileId, profileId));
      await tx.delete(s.biomarkers).where(eq(s.biomarkers.profileId, profileId));
      await tx.delete(s.documents).where(eq(s.documents.profileId, profileId));
    });
  }
}
