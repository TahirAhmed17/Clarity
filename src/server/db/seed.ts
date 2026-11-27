import { sql } from "drizzle-orm";
import { EVIDENCE_SOURCES } from "@/data/evidence/catalogue";
import { buildSeedDataset } from "@/data/synthetic/dataset";
import { EMBEDDINGS_MODEL, loadCorpus } from "../evidence/corpus";
import type { ClarityDb } from "../data/drizzle-repository";
import * as s from "./schema";

/**
 * Idempotent seed of the SYNTHETIC demo dataset.
 * Safe to run repeatedly: uses fixed ids + ON CONFLICT DO NOTHING / upsert.
 */
export async function seedDatabase(db: ClarityDb) {
  const d = buildSeedDataset();
  const counts: Record<string, number> = {};

  await db.transaction(async (tx) => {
    const p = await tx
      .insert(s.profiles)
      .values(d.profiles.map((x) => ({ ...x, preferences: {} })))
      .onConflictDoNothing()
      .returning({ id: s.profiles.id });
    counts.profiles = p.length;

    const doc = await tx
      .insert(s.documents)
      .values({
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
        isSynthetic: true,
      })
      .onConflictDoNothing()
      .returning({ id: s.documents.id });
    counts.documents = doc.length;

    const b = await tx
      .insert(s.biomarkers)
      .values(
        d.biomarkers.map((x) => ({
          ...x,
          valueNumeric: x.valueNumeric === null ? null : String(x.valueNumeric),
          refLow: x.refLow === null ? null : String(x.refLow),
          refHigh: x.refHigh === null ? null : String(x.refHigh),
        })),
      )
      .onConflictDoNothing()
      .returning({ id: s.biomarkers.id });
    counts.biomarkers = b.length;

    const w = await tx
      .insert(s.wearableMetrics)
      .values(d.wearableMetrics.map((x) => ({ ...x, value: String(x.value) })))
      .onConflictDoNothing()
      .returning({ id: s.wearableMetrics.id });
    counts.wearable_metrics = w.length;

    const sy = await tx
      .insert(s.symptomEntries)
      .values(d.symptoms.map((x) => ({ ...x, createdAt: new Date(x.createdAt) })))
      .onConflictDoNothing()
      .returning({ id: s.symptomEntries.id });
    counts.symptom_entries = sy.length;

    const sc = await tx.insert(s.supplementCatalogue).values(d.supplementCatalogue).onConflictDoNothing().returning({ id: s.supplementCatalogue.id });
    counts.supplement_catalogue = sc.length;

    const ev = await tx
      .insert(s.events)
      .values(d.events.map((x) => ({ ...x, startsAt: x.startsAt ? new Date(x.startsAt) : null })))
      .onConflictDoNothing()
      .returning({ id: s.events.id });
    counts.events = ev.length;
  });

  counts.evidence_chunks = await seedEvidence(db);

  return counts;
}

/** Upserts the curated evidence library (reference data, not synthetic user data). */
export async function seedEvidence(db: ClarityDb) {
  return db.transaction(async (tx) => {
    for (const src of EVIDENCE_SOURCES) {
      await tx.insert(s.evidenceSources).values(src).onConflictDoUpdate({ target: s.evidenceSources.id, set: { ...src } });
    }
    const chunks = loadCorpus();
    for (const c of chunks) {
      const row = { id: c.id, sourceId: c.sourceId, heading: c.heading, content: c.text, biomarkers: c.biomarkers, systems: c.systems, themes: c.themes, embedding: c.embedding, embeddingModel: c.embedding ? EMBEDDINGS_MODEL : null };
      await tx.insert(s.evidenceChunks).values(row).onConflictDoUpdate({ target: s.evidenceChunks.id, set: row });
    }
    return chunks.length;
  });
}

export async function tableCounts(db: ClarityDb) {
  const tables = [
    "profiles",
    "documents",
    "biomarkers",
    "wearable_metrics",
    "symptom_entries",
    "supplement_catalogue",
    "supplement_suggestions",
    "events",
    "event_requests",
    "action_plans",
    "messages",
    "evidence_sources",
    "evidence_chunks",
    "action_history",
  ];
  const out: Record<string, number> = {};
  for (const t of tables) {
    const res = await db.execute(sql.raw(`select count(*)::int as n from "${t}"`));
    const rows = (Array.isArray(res) ? res : (res as unknown as { rows: { n: number }[] }).rows) as { n: number }[];
    out[t] = Number(rows[0].n);
  }
  return out;
}
