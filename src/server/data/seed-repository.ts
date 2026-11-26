import { randomUUID } from "node:crypto";
import { buildSeedDataset } from "@/data/synthetic/dataset";
import type {
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

  async updateProfile(profileId: string, patch: Partial<Pick<Profile, "displayName" | "goals" | "routine">>) {
    const p = this.profiles.find((x) => x.id === profileId);
    if (!p) return null;
    Object.assign(p, patch);
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

  async deleteProfileHealthData(profileId: string) {
    const keep = <T extends { profileId: string }>(rows: T[]) => rows.filter((r) => r.profileId !== profileId);
    this.documents = keep(this.documents);
    this.biomarkers = keep(this.biomarkers);
    this.wearables = keep(this.wearables);
    this.symptoms = keep(this.symptoms);
    this.suggestions = keep(this.suggestions);
    this.messages = keep(this.messages);
  }
}
