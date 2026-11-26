import type {
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
  updateProfile(profileId: string, patch: Partial<Pick<Profile, "displayName" | "goals" | "routine">>): Promise<Profile | null>;

  listDocuments(profileId: string): Promise<HealthDocument[]>;
  findDocumentByHash(profileId: string, sha256: string): Promise<HealthDocument | null>;
  createDocument(profileId: string, doc: NewDocument): Promise<HealthDocument>;

  listBiomarkers(profileId: string): Promise<Biomarker[]>;
  addBiomarkers(profileId: string, rows: NewBiomarker[]): Promise<Biomarker[]>;

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

  /** User-data deletion pathway: removes all health records owned by the profile (keeps the profile row). */
  deleteProfileHealthData(profileId: string): Promise<void>;
}
