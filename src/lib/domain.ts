/**
 * Isomorphic domain types used by UI, API routes and services.
 * Numeric DB columns are converted to numbers here; the original text is kept alongside.
 */

export type RecordSource = "extracted" | "user_provided" | "calculated" | "synthetic_seed";

export interface Profile {
  id: string;
  role: "member" | "reviewer";
  displayName: string;
  birthYear: number | null;
  sexAtBirth: string | null;
  goals: string[];
  routine: Record<string, string>;
  isSynthetic: boolean;
}

export interface HealthDocument {
  id: string;
  profileId: string;
  kind: "blood_report_pdf" | "apple_health_xml" | "wearable_csv";
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  status: "uploaded" | "processing" | "processed" | "failed";
  extractionMethod: string | null;
  collectedOn: string | null;
  errorMessage: string | null;
  isSynthetic: boolean;
  createdAt: string;
}

export interface Biomarker {
  id: string;
  profileId: string;
  documentId: string | null;
  code: string | null;
  nameAsReported: string;
  valueNumeric: number | null;
  valueText: string;
  unitAsReported: string | null;
  refLow: number | null;
  refHigh: number | null;
  refText: string | null;
  flagAsReported: string | null;
  observedOn: string | null;
  source: RecordSource;
  confidence: number | null;
  pageNumber: number | null;
}

export type NewBiomarker = Omit<Biomarker, "id" | "profileId">;

export type WearableMetricType =
  | "steps"
  | "active_energy"
  | "resting_heart_rate"
  | "heart_rate"
  | "hrv_sdnn"
  | "sleep_asleep";

export interface WearableMetric {
  id: string;
  profileId: string;
  documentId: string | null;
  metricType: WearableMetricType;
  value: number;
  unit: "count" | "kcal" | "bpm" | "ms" | "min";
  aggregation: "sum" | "avg" | "min" | "max";
  day: string;
  sampleCount: number;
  sourceFormat: string;
  sourceName: string | null;
}

export type NewWearableMetric = Omit<WearableMetric, "id" | "profileId">;

export interface SymptomEntry {
  id: string;
  profileId: string;
  description: string;
  severity: number | null;
  startedOn: string | null;
  resolvedOn: string | null;
  tags: string[];
  source: RecordSource;
  createdAt: string;
}

export interface SupplementCatalogueItem {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  relevanceNotes: string;
  cautionNotes: string;
  sourceUrl: string | null;
  isSample: boolean;
}

export interface SupplementSuggestion {
  id: string;
  profileId: string;
  catalogueId: string;
  rationale: string;
  status: "pending" | "approved" | "changed" | "rejected";
  reviewerDose: string | null;
  reviewerNote: string | null;
  reviewedAt: string | null;
  isSimulatedReview: boolean;
  createdAt: string;
}

export interface WellnessEvent {
  id: string;
  slug: string;
  title: string;
  category: string;
  description: string;
  howItMayHelp: string;
  expectedOutcome: string;
  tags: string[];
  location: string | null;
  startsAt: string | null;
  priceText: string | null;
  isSample: boolean;
}

export interface ChatMessage {
  id: string;
  profileId: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  structured: unknown | null;
  engine: string | null;
  createdAt: string;
}

export type RangeStatus = "below" | "within" | "above" | "no_range" | "not_numeric";
