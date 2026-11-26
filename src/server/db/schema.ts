import {
  customType,
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  real,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Clarity M1 schema. See DATA_MODEL.md for rationale.
 * Rules:
 *  - Every user-owned row carries profile_id (profile isolation + RLS).
 *  - Lab values keep the ORIGINAL value, unit and reference range exactly as reported.
 *  - Provenance (`source`) is explicit on health records.
 *  - Demo rows carry is_synthetic / is_sample flags.
 */

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export const profileRole = pgEnum("profile_role", ["member", "reviewer"]);
export const documentKind = pgEnum("document_kind", ["blood_report_pdf", "apple_health_xml", "wearable_csv"]);
export const documentStatus = pgEnum("document_status", ["uploaded", "processing", "processed", "failed"]);
export const recordSource = pgEnum("record_source", ["extracted", "user_provided", "calculated", "synthetic_seed"]);
export const suggestionStatus = pgEnum("suggestion_status", ["pending", "approved", "changed", "rejected"]);
export const eventRequestStatus = pgEnum("event_request_status", ["requested", "mock_confirmed", "cancelled"]);
export const messageRole = pgEnum("message_role", ["user", "assistant"]);
export const planStatus = pgEnum("plan_status", ["active", "superseded"]);

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Links to Supabase auth.users.id when auth is enabled. Null for the local demo profile. */
  authUserId: uuid("auth_user_id").unique(),
  role: profileRole("role").notNull().default("member"),
  displayName: text("display_name").notNull(),
  birthYear: smallint("birth_year"),
  sexAtBirth: text("sex_at_birth"),
  /** User-stated goals, e.g. ["Improve energy"]. */
  goals: jsonb("goals").$type<string[]>().notNull().default([]),
  /** Free-form routine context collected progressively (sleep window, activity, diet pattern). */
  routine: jsonb("routine").$type<Record<string, string>>().notNull().default({}),
  preferences: jsonb("preferences").$type<Record<string, unknown>>().notNull().default({}),
  isSynthetic: boolean("is_synthetic").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    kind: documentKind("kind").notNull(),
    originalFilename: text("original_filename").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    sha256: text("sha256").notNull(),
    status: documentStatus("status").notNull().default("uploaded"),
    /** text_layer | ocr | xml_stream | csv */
    extractionMethod: text("extraction_method"),
    /** Date the sample was collected, as stated on the report. */
    collectedOn: date("collected_on"),
    errorMessage: text("error_message"),
    isSynthetic: boolean("is_synthetic").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("documents_profile_idx").on(t.profileId), uniqueIndex("documents_profile_sha_idx").on(t.profileId, t.sha256)],
);

export interface BiomarkerCorrection {
  original: { valueText: string; unitAsReported: string | null; refText: string | null; source: string };
  correctedAt: string;
}

export const biomarkers = pgTable(
  "biomarkers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    documentId: uuid("document_id").references(() => documents.id, { onDelete: "set null" }),
    /** Canonical key (e.g. "ALT") when recognised. Null = unrecognised, original name still kept. */
    code: text("code"),
    nameAsReported: text("name_as_reported").notNull(),
    /** numeric keeps exact decimal precision of the lab value. */
    valueNumeric: numeric("value_numeric"),
    /** Original value text, e.g. "<5" or "5.2". Always preserved. */
    valueText: text("value_text").notNull(),
    unitAsReported: text("unit_as_reported"),
    refLow: numeric("ref_low"),
    refHigh: numeric("ref_high"),
    /** Reference range exactly as printed by the lab. */
    refText: text("ref_text"),
    flagAsReported: text("flag_as_reported"),
    observedOn: date("observed_on"),
    source: recordSource("source").notNull(),
    /** 0..1 parser confidence for extracted rows. */
    confidence: real("confidence"),
    pageNumber: smallint("page_number"),
    /** Set when the user corrected the record: keeps the original extracted values for provenance. */
    correction: jsonb("correction").$type<BiomarkerCorrection | null>(),
    createdAt: createdAt(),
  },
  (t) => [index("biomarkers_profile_code_idx").on(t.profileId, t.code, t.observedOn)],
);

export const wearableMetrics = pgTable(
  "wearable_metrics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    documentId: uuid("document_id").references(() => documents.id, { onDelete: "set null" }),
    /** steps | active_energy | resting_heart_rate | heart_rate | hrv_sdnn | sleep_asleep */
    metricType: text("metric_type").notNull(),
    value: numeric("value").notNull(),
    /** Normalised unit: count | kcal | bpm | ms | min */
    unit: text("unit").notNull(),
    /** sum | avg | min | max */
    aggregation: text("aggregation").notNull(),
    /** Calendar day (YYYY-MM-DD) the daily aggregate covers. */
    day: date("day").notNull(),
    sampleCount: integer("sample_count").notNull().default(1),
    /** apple_health_xml | synthetic_seed | <verified csv adapter id> */
    sourceFormat: text("source_format").notNull(),
    /** Device/app name as reported in the export. */
    sourceName: text("source_name"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("wearable_metrics_daily_idx").on(t.profileId, t.metricType, t.day, t.aggregation, t.sourceFormat),
  ],
);

export const symptomEntries = pgTable(
  "symptom_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    /** 1 (mild) .. 5 (severe), optional. */
    severity: smallint("severity"),
    startedOn: date("started_on"),
    resolvedOn: date("resolved_on"),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    source: recordSource("source").notNull().default("user_provided"),
    createdAt: createdAt(),
  },
  (t) => [index("symptom_entries_profile_idx").on(t.profileId)],
);

export const supplementCatalogue = pgTable("supplement_catalogue", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  /** When this category may be worth discussing with a professional. Never a dose. */
  relevanceNotes: text("relevance_notes").notNull(),
  cautionNotes: text("caution_notes").notNull(),
  /** Linked to curated evidence in M2; null until a real source is attached. */
  sourceUrl: text("source_url"),
  isSample: boolean("is_sample").notNull().default(true),
  createdAt: createdAt(),
});

export const supplementSuggestions = pgTable(
  "supplement_suggestions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    catalogueId: uuid("catalogue_id").notNull().references(() => supplementCatalogue.id, { onDelete: "restrict" }),
    rationale: text("rationale").notNull(),
    status: suggestionStatus("status").notNull().default("pending"),
    /** Only a reviewer may set a dose. AI never writes this column. */
    reviewerDose: text("reviewer_dose"),
    reviewerNote: text("reviewer_note"),
    reviewerProfileId: uuid("reviewer_profile_id").references(() => profiles.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    /** True for the demo Doctor view. UI must show "Simulated review". */
    isSimulatedReview: boolean("is_simulated_review").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index("supplement_suggestions_profile_idx").on(t.profileId)],
);

export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  howItMayHelp: text("how_it_may_help").notNull(),
  expectedOutcome: text("expected_outcome").notNull(),
  /** Tags used to compute per-user relevance ("why it is relevant to you"). */
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  location: text("location"),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  priceText: text("price_text"),
  isSample: boolean("is_sample").notNull().default(true),
  createdAt: createdAt(),
});

export const eventRequests = pgTable(
  "event_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    status: eventRequestStatus("status").notNull().default("requested"),
    note: text("note"),
    isMock: boolean("is_mock").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index("event_requests_profile_idx").on(t.profileId)],
);

export type PlanAction = {
  id: string;
  title: string;
  detail: string;
  category: "movement" | "nutrition" | "sleep" | "supplement" | "professional" | "other";
  status: "pending" | "completed" | "skipped";
  /** Why the recommendation engine chose this action. */
  reasons?: string[];
  /** Curated evidence chunk ids supporting the action. */
  evidenceChunkIds?: string[];
};

export const actionPlans = pgTable(
  "action_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    planDate: date("plan_date").notNull(),
    primaryAction: jsonb("primary_action").$type<PlanAction>().notNull(),
    supportingActions: jsonb("supporting_actions").$type<PlanAction[]>().notNull().default([]),
    rationale: text("rationale").notNull(),
    /** Engine that produced the plan, e.g. "mock", "gemini". */
    generatedBy: text("generated_by").notNull(),
    status: planStatus("status").notNull().default("active"),
    createdAt: createdAt(),
  },
  (t) => [index("action_plans_profile_date_idx").on(t.profileId, t.planDate)],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    conversationId: text("conversation_id").notNull().default("default"),
    role: messageRole("role").notNull(),
    content: text("content").notNull(),
    /** Validated structured AI response (CompanionResponse) for assistant messages. */
    structured: jsonb("structured"),
    engine: text("engine"),
    createdAt: createdAt(),
  },
  (t) => [index("messages_profile_conv_idx").on(t.profileId, t.conversationId, t.createdAt)],
);

/* ---------------- M2: curated evidence (shared, read-only reference data) ---------------- */

const tsvector = customType<{ data: string }>({ dataType: () => "tsvector" });

export const EMBEDDING_DIMENSIONS = 384;

export const evidenceSources = pgTable("evidence_sources", {
  id: text("id").primaryKey(),
  publisher: text("publisher").notNull(),
  title: text("title").notNull(),
  url: text("url").notNull(),
  publishedOn: date("published_on"),
  lastUpdatedOn: date("last_updated_on"),
  lastReviewedOn: date("last_reviewed_on"),
  nextReviewDue: date("next_review_due"),
  retrievedOn: date("retrieved_on").notNull(),
  dateNote: text("date_note"),
  topic: text("topic").notNull(),
  evidenceClass: text("evidence_class").notNull(),
  limitations: jsonb("limitations").$type<string[]>().notNull().default([]),
});

export const evidenceChunks = pgTable(
  "evidence_chunks",
  {
    id: text("id").primaryKey(),
    sourceId: text("source_id")
      .notNull()
      .references(() => evidenceSources.id, { onDelete: "cascade" }),
    heading: text("heading").notNull(),
    content: text("content").notNull(),
    biomarkers: text("biomarkers").array().notNull().default([]),
    systems: text("systems").array().notNull().default([]),
    themes: text("themes").array().notNull().default([]),
    /** all-MiniLM-L6-v2 sentence embedding (normalised). */
    embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }),
    embeddingModel: text("embedding_model"),
    /** Full-text search vector for hybrid retrieval. */
    tsv: tsvector("tsv").generatedAlwaysAs(sql`to_tsvector('english', heading || ' ' || content)`),
  },
  (t) => [
    index("evidence_chunks_embedding_idx").using("hnsw", t.embedding.op("vector_cosine_ops")),
    index("evidence_chunks_tsv_idx").using("gin", t.tsv),
    index("evidence_chunks_systems_idx").using("gin", t.systems),
    index("evidence_chunks_biomarkers_idx").using("gin", t.biomarkers),
  ],
);

/* ---------------- M2: action history (completed / skipped plan actions) ---------------- */

export const actionOutcome = pgEnum("action_outcome", ["completed", "skipped"]);

export const actionHistory = pgTable(
  "action_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    planId: uuid("plan_id").references(() => actionPlans.id, { onDelete: "set null" }),
    actionId: text("action_id").notNull(),
    actionTitle: text("action_title").notNull(),
    category: text("category").notNull(),
    outcome: actionOutcome("outcome").notNull(),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [index("action_history_profile_idx").on(t.profileId, t.createdAt)],
);

/* ---------------- M2: user-authored timeline events (goal / routine changes) ---------------- */

export const healthTimelineEvents = pgTable(
  "health_timeline_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    /** goal_added | goal_removed | routine_changed */
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    detail: jsonb("detail").$type<Record<string, unknown>>().notNull().default({}),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("health_timeline_events_profile_idx").on(t.profileId, t.occurredAt)],
);

export type ProfileRow = typeof profiles.$inferSelect;
export type DocumentRow = typeof documents.$inferSelect;
export type BiomarkerRow = typeof biomarkers.$inferSelect;
export type WearableMetricRow = typeof wearableMetrics.$inferSelect;
export type SymptomRow = typeof symptomEntries.$inferSelect;
export type SupplementCatalogueRow = typeof supplementCatalogue.$inferSelect;
export type SupplementSuggestionRow = typeof supplementSuggestions.$inferSelect;
export type EventRow = typeof events.$inferSelect;
export type EventRequestRow = typeof eventRequests.$inferSelect;
export type ActionPlanRow = typeof actionPlans.$inferSelect;
export type MessageRow = typeof messages.$inferSelect;
export type ActionHistoryRow = typeof actionHistory.$inferSelect;
