import type {
  ActionHistoryEntry,
  ActionPlan,
  EventRequest,
  SuggestionReview,
  BiomarkerCorrectionInput,
  TimelineNote,
  Biomarker,
  ChatMessage,
  HealthDocument,
  NewBiomarker,
  NewWearableMetric,
  Profile,
  SupplementCatalogueItem,
  SupplementSuggestion,
  SymptomEntry,
  WearableMetric,
  WellnessEvent,
} from "@/lib/domain";

export type NewDocument = Omit<HealthDocument, "id" | "profileId" | "createdAt">;

/**
 * Data-access boundary. Every user-scoped method takes profileId explicitly,
 * so a query can never accidentally span profiles (defence in depth alongside RLS).
 */
export interface HealthRepository {
  readonly mode: "database" | "seed";

  getProfile(profileId: string): Promise<Profile | null>;
  /** Updates the profile and records the given timeline notes atomically. */
  updateProfile(
    profileId: string,
    patch: Partial<Pick<Profile, "displayName" | "goals" | "routine">>,
    timelineNotes?: Pick<TimelineNote, "kind" | "title" | "detail">[],
  ): Promise<Profile | null>;

  listDocuments(profileId: string): Promise<HealthDocument[]>;
  findDocumentByHash(profileId: string, sha256: string): Promise<HealthDocument | null>;
  createDocument(profileId: string, doc: NewDocument): Promise<HealthDocument>;

  listBiomarkers(profileId: string): Promise<Biomarker[]>;
  addBiomarkers(profileId: string, rows: NewBiomarker[]): Promise<Biomarker[]>;

  /** User correction: recomputes parsed numbers, marks source user_provided, keeps the original values. */
  correctBiomarker(profileId: string, biomarkerId: string, input: BiomarkerCorrectionInput): Promise<Biomarker | null>;
  /** Deletes one uploaded document and every record derived from it. */
  deleteDocument(profileId: string, documentId: string): Promise<boolean>;

  listWearableMetrics(profileId: string): Promise<WearableMetric[]>;
  /** Upserts daily aggregates (same profile/metric/day/aggregation/source replaces the old value). */
  upsertWearableMetrics(profileId: string, rows: NewWearableMetric[]): Promise<number>;

  listSymptoms(profileId: string): Promise<SymptomEntry[]>;
  addSymptom(profileId: string, entry: Pick<SymptomEntry, "description" | "severity" | "startedOn" | "tags">): Promise<SymptomEntry>;

  listSupplementCatalogue(): Promise<SupplementCatalogueItem[]>;
  listSupplementSuggestions(profileId: string): Promise<SupplementSuggestion[]>;
  listEvents(): Promise<WellnessEvent[]>;

  listMessages(profileId: string, conversationId?: string): Promise<ChatMessage[]>;
  addMessage(profileId: string, msg: Pick<ChatMessage, "role" | "content" | "structured" | "engine"> & { conversationId?: string }): Promise<ChatMessage>;

  // ---- M2: plans and action history ----
  getActivePlan(profileId: string): Promise<ActionPlan | null>;
  /** Supersedes any active plan and stores the new one. */
  savePlan(profileId: string, plan: Pick<ActionPlan, "planDate" | "primaryAction" | "supportingActions" | "rationale" | "generatedBy">): Promise<ActionPlan>;
  updatePlanActionStatus(profileId: string, planId: string, actionId: string, status: "completed" | "skipped" | "pending"): Promise<ActionPlan | null>;
  addActionHistory(profileId: string, entry: Omit<ActionHistoryEntry, "id" | "profileId" | "createdAt">): Promise<ActionHistoryEntry>;
  listActionHistory(profileId: string): Promise<ActionHistoryEntry[]>;
  listPlans(profileId: string): Promise<ActionPlan[]>;

  // ---- M2: supplements (simulated review) ----
  createSupplementSuggestion(profileId: string, s: { catalogueId: string; rationale: string }): Promise<SupplementSuggestion>;
  /** Reviewer queue across profiles. Callers must enforce the reviewer role. */
  listSuggestionsForReview(): Promise<(SupplementSuggestion & { profileDisplayName: string })[]>;
  reviewSuggestion(suggestionId: string, reviewerProfileId: string, review: SuggestionReview): Promise<SupplementSuggestion | null>;

  // ---- M2: events ----
  createEventRequest(profileId: string, eventId: string, note: string | null): Promise<EventRequest>;
  listEventRequests(profileId: string): Promise<EventRequest[]>;

  // ---- M2: timeline notes (goal / routine changes) ----
  addTimelineNote(profileId: string, note: Pick<TimelineNote, "kind" | "title" | "detail">): Promise<TimelineNote>;
  listTimelineNotes(profileId: string): Promise<TimelineNote[]>;

  /** User-data deletion pathway: removes all health records owned by the profile (keeps the profile row). */
  deleteProfileHealthData(profileId: string): Promise<void>;
}
