import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BLOCKED_SOURCES, EVIDENCE_NOTES, EVIDENCE_SOURCES } from "@/data/evidence/catalogue";
import embeddings from "@/data/evidence/embeddings.json";
import { DEMO_PROFILE_ID, DEMO_REVIEWER_ID } from "@/data/synthetic/dataset";
import type { Biomarker } from "@/lib/domain";
import { parseEnv } from "@/server/config/env";
import { respond } from "@/server/ai/service";
import { toCanonical } from "@/server/biomarkers/definitions";
import { biomarkerHistories, validateBiomarkers } from "@/server/biomarkers/intelligence";
import { SeedRepository } from "@/server/data/seed-repository";
import { DrizzleRepository } from "@/server/data/drizzle-repository";
import { createMigratedPglite } from "@/server/db/pglite";
import { seedDatabase } from "@/server/db/seed";
import { chunkText, loadCorpus } from "@/server/evidence/corpus";
import { MiniLmEmbedder, type Embedder } from "@/server/evidence/embedder";
import { InMemoryRetriever } from "@/server/evidence/memory-retriever";
import { PgvectorRetriever } from "@/server/evidence/pgvector-retriever";
import { rankEvents } from "@/server/events/relevance";
import { ingestBloodReport } from "@/server/ingestion/service";
import { loadSnapshot } from "@/server/insights/snapshot";
import { recommend, type RecInput } from "@/server/recommendations/engine";
import { generatePlan, recordActionOutcome } from "@/server/recommendations/service";
import { ReviewSchema, suggestSupplements } from "@/server/supplements/service";
import { buildSystemInsights } from "@/server/systems/organ-systems";
import { buildTimeline } from "@/server/timeline/service";

const env = parseEnv({ NODE_ENV: "test", DATA_MODE: "seed", AI_ENGINE: "mock" });
const MB = 1024 * 1024;

async function repoWithLatestReport() {
  const repo = new SeedRepository();
  await ingestBloodReport(
    DEMO_PROFILE_ID,
    { name: "r.pdf", type: "application/pdf", bytes: new Uint8Array(readFileSync("samples/synthetic-blood-report.pdf")) },
    { repo, maxBytes: 10 * MB },
  );
  return repo;
}

const bm = (over: Partial<Biomarker>): Biomarker => ({
  id: crypto.randomUUID(),
  profileId: DEMO_PROFILE_ID,
  documentId: null,
  code: "LDL",
  nameAsReported: "LDL",
  valueNumeric: 3,
  valueText: "3",
  unitAsReported: "mmol/L",
  refLow: null,
  refHigh: 3,
  refText: "< 3.0",
  flagAsReported: null,
  observedOn: "2026-01-01",
  source: "extracted",
  confidence: 1,
  pageNumber: 1,
  ...over,
});

describe("M2.1 evidence catalogue integrity", () => {
  it("every note cites a recorded source; every source is https with a date or an explicit date note", () => {
    const ids = new Set(EVIDENCE_SOURCES.map((s) => s.id));
    for (const n of EVIDENCE_NOTES) expect(ids.has(n.sourceId), n.id).toBe(true);
    for (const s of EVIDENCE_SOURCES) {
      expect(s.url).toMatch(/^https:\/\//);
      expect(s.publishedOn ?? s.lastUpdatedOn ?? s.lastReviewedOn ?? s.dateNote, s.id).toBeTruthy();
      expect(s.limitations.length, s.id).toBeGreaterThan(0);
    }
    // Blocked sources are recorded but never cited.
    const used = new Set(EVIDENCE_SOURCES.map((s) => new URL(s.url).host));
    for (const b of BLOCKED_SOURCES) expect(used.has(new URL(b.url).host)).toBe(false);
  });

  it("pre-computed embeddings are present and up to date with the catalogue text", () => {
    const e = embeddings as { catalogueHash: string; dimensions: number; vectors: Record<string, number[]> };
    const hash = createHash("sha256").update(JSON.stringify(EVIDENCE_NOTES.map((n) => [n.id, chunkText(n)]))).digest("hex");
    expect(e.catalogueHash, "run `npm run evidence:embed` after editing the catalogue").toBe(hash);
    for (const n of EVIDENCE_NOTES) expect(e.vectors[n.id]?.length).toBe(e.dimensions);
  });

  it("notes contain no dose instructions", () => {
    for (const n of EVIDENCE_NOTES) expect(n.text, n.id).not.toMatch(/\b\d+\s?(mg|mcg|µg|iu)\b/i);
  });
});

describe("M2.2 retrieval", () => {
  it("in-memory lexical retrieval finds relevant chunks and respects filters", async () => {
    const r = new InMemoryRetriever(null);
    const { results, modeUsed } = await r.search("foods rich in iron", { k: 3 });
    expect(modeUsed).toBe("lexical");
    expect(results.map((x) => x.chunkId)).toContain("mp-iron-1");
    const filtered = await r.search("what do my results mean", { k: 5, filter: { systems: ["kidneys"] } });
    expect(filtered.results.every((x) => EVIDENCE_NOTES.find((n) => n.id === x.chunkId)!.systems.includes("kidneys"))).toBe(true);
  });

  it("semantic retrieval with the real MiniLM model ranks a paraphrased question correctly", async () => {
    const r = new InMemoryRetriever(new MiniLmEmbedder());
    const { results, modeUsed } = await r.search("I feel exhausted all the time, could it be my iron?", { k: 3, mode: "vector" });
    expect(modeUsed).toBe("vector");
    expect(results.some((x) => x.chunkId.startsWith("mp-ferritin") || x.chunkId.startsWith("mp-iron"))).toBe(true);
  }, 120_000);

  describe("pgvector retriever on Postgres (PGlite + pgvector)", () => {
    let pg: Awaited<ReturnType<typeof createMigratedPglite>>;
    beforeAll(async () => {
      pg = await createMigratedPglite();
      await seedDatabase(pg.db);
    });
    afterAll(async () => pg.client.close());

    it("vector search returns the nearest chunk, full-text works, and filters apply", async () => {
      const corpus = loadCorpus();
      const target = corpus.find((c) => c.id === "mp-tsh-1")!;
      const stub: Embedder = { id: "stub", dimensions: 384, embed: async () => [target.embedding!] };
      const r = new PgvectorRetriever(pg.db, stub);
      expect((await r.search("anything", { k: 1, mode: "vector" })).results[0].chunkId).toBe("mp-tsh-1");
      const lex = await r.search("creatinine muscle", { k: 3, mode: "lexical" });
      expect(lex.results.map((x) => x.chunkId)).toContain("mp-creatinine-2");
      const filtered = await r.search("anything", { k: 5, mode: "hybrid", filter: { systems: ["liver"] } });
      expect(filtered.results.length).toBeGreaterThan(0);
      expect(filtered.results.every((x) => EVIDENCE_NOTES.find((n) => n.id === x.chunkId)!.systems.includes("liver"))).toBe(true);
    });
  });
});

describe("M2.4 biomarker intelligence", () => {
  it("converts units with standard factors and refuses ambiguous or unknown units", () => {
    expect(toCanonical("CREATININE", 1, "mg/dL")).toMatchObject({ ok: true, value: 88.4, unit: "umol/L", converted: true });
    expect(toCanonical("GLUCOSE_FASTING", 90, "mg/dL")).toMatchObject({ ok: true, value: 4.996 });
    expect(toCanonical("HBA1C", 6, "%")).toMatchObject({ ok: true, value: 42.077 });
    expect(toCanonical("VITD25OH", 20, "ng/mL")).toMatchObject({ ok: true, value: 49.92 });
    expect(toCanonical("FERRITIN", 13, "µg/L")).toMatchObject({ ok: true, value: 13, converted: false });
    expect(toCanonical("UREA", 14, "mg/dL")).toMatchObject({ ok: false, reason: "ambiguous_unit" });
    expect(toCanonical("LDL", 3, "furlongs")).toMatchObject({ ok: false, reason: "unknown_unit" });
    expect(toCanonical(null, 3, "mmol/L")).toMatchObject({ ok: false, reason: "no_definition" });
  });

  it("flags implausible values, conflicts, qualified values and missing ranges", () => {
    const issues = validateBiomarkers([
      bm({ valueNumeric: 135, valueText: "135" }), // LDL 135 mmol/L → probably mg/dL entered as mmol/L
      bm({ code: "HDL", nameAsReported: "HDL", valueNumeric: 1.4, valueText: "1.4" }),
      bm({ code: "HDL", nameAsReported: "HDL", valueNumeric: 1.6, valueText: "1.6" }),
      bm({ code: "EGFR", nameAsReported: "eGFR", valueNumeric: null, valueText: ">90", unitAsReported: "mL/min/1.73m2" }),
      bm({ code: "TSH", nameAsReported: "TSH", refText: null, refHigh: null }),
    ]);
    const codes = issues.map((i) => i.code);
    expect(codes).toEqual(expect.arrayContaining(["implausible_value", "conflicting_same_day", "qualified_value", "missing_range"]));
  });

  it("warns when the printed flag contradicts the range, but not after the user corrects the value", () => {
    const asRead = bm({ code: "FERRITIN", nameAsReported: "Ferritin", valueNumeric: 16, valueText: "16", unitAsReported: "ug/L", refText: "15 - 150", refLow: 15, refHigh: 150, flagAsReported: "L" });
    expect(validateBiomarkers([asRead]).map((i) => i.code)).toContain("flag_range_mismatch");
    const corrected = { ...asRead, source: "user_provided" as const, correction: { original: { valueText: "13", unitAsReported: "ug/L", refText: "15 - 150", source: "extracted" as const }, correctedAt: "2026-11-27T00:00:00Z" } };
    expect(validateBiomarkers([corrected]).map((i) => i.code)).not.toContain("flag_range_mismatch");
  });

  it("computes history across different units, with provenance, and refuses unsafe comparisons", () => {
    const h = biomarkerHistories([
      bm({ code: "CREATININE", nameAsReported: "Creatinine", valueNumeric: 0.8, valueText: "0.8", unitAsReported: "mg/dL", observedOn: "2025-01-01", documentId: "doc-a" }),
      bm({ code: "CREATININE", nameAsReported: "Creatinine", valueNumeric: 74, valueText: "74", unitAsReported: "umol/L", observedOn: "2026-01-01", documentId: "doc-b" }),
      bm({ code: "UREA", nameAsReported: "Urea", valueNumeric: 14, valueText: "14", unitAsReported: "mg/dL", observedOn: "2025-01-01" }),
      bm({ code: "UREA", nameAsReported: "Urea", valueNumeric: 5, valueText: "5", unitAsReported: "mmol/L", observedOn: "2026-01-01" }),
    ]);
    const cre = h.find((x) => x.code === "CREATININE")!;
    expect(cre.points[0]).toMatchObject({ canonicalValue: 70.72, convertedFromOtherUnit: true, documentId: "doc-a", valueText: "0.8" });
    expect(cre.change).toMatchObject({ direction: "up", unit: "umol/L", absolute: 3.28 });
    const urea = h.find((x) => x.code === "UREA")!;
    expect(urea.change).toBeNull();
    expect(urea.changeUnavailableReason).toMatch(/can't be compared/);
  });
});

describe("M2.5 organ & system insights", () => {
  it("summarises each system without scores, lists missing markers and next steps", async () => {
    const repo = await repoWithLatestReport();
    const systems = await buildSystemInsights(await repo.listBiomarkers(DEMO_PROFILE_ID), new InMemoryRetriever(null));
    const liver = systems.find((s) => s.system.id === "liver")!;
    expect(liver.outsideRangeCount).toBe(2); // ALT (primary) + ferritin (supporting)
    expect(liver.dataState).toBe("partial"); // ALP, bilirubin not measured
    expect(liver.missing.map((m) => m.code)).toEqual(expect.arrayContaining(["ALP", "BILIRUBIN"]));
    expect(liver.nextSteps[0]).toMatch(/Discuss ALT with a healthcare professional/);
    expect(liver.evidence.length).toBeGreaterThan(0);
    const kidneys = systems.find((s) => s.system.id === "kidneys")!;
    expect(kidneys.summary).toBe("No results outside your lab's ranges");
    expect(kidneys.missing.map((m) => m.code)).toContain("UACR");
    const thyroid = systems.find((s) => s.system.id === "thyroid")!;
    expect(thyroid.dataState).toBe("complete");
    for (const s of systems) expect(Object.keys(s)).not.toContain("score");
    expect(JSON.stringify(systems)).not.toMatch(/disease is|you have/i);
  });

  it("reports 'Not enough data' rather than normal when a system has no results", async () => {
    const systems = await buildSystemInsights([], null);
    expect(systems.every((s) => s.dataState === "none" && s.summary === "Not enough data")).toBe(true);
  });
});

describe("M2.7 recommendation engine", () => {
  const base: RecInput = { flagged: [], symptoms: [], goals: [], question: null, wearables: [], history: [] };

  it("puts one consolidated professional action first when results are outside range", () => {
    const r = recommend({ ...base, flagged: [{ code: "FERRITIN", name: "Ferritin", status: "below" }, { code: "LDL", name: "LDL", status: "above" }] });
    expect(r.primary).toMatchObject({ id: "professional-review", category: "professional" });
    expect(r.primary.detail).toMatch(/Ferritin and LDL/);
    expect(r.supporting.length).toBeLessThanOrEqual(3);
    expect(new Set(r.supporting.map((s) => s.category)).size).toBe(r.supporting.length);
    const ids = new Set(EVIDENCE_NOTES.map((n) => n.id));
    for (const x of [r.primary, ...r.supporting]) for (const e of x.evidenceChunkIds) expect(ids.has(e)).toBe(true);
  });

  it("keeps safety first: the professional action stays primary even when lifestyle actions score highly, until done", () => {
    const input: RecInput = { ...base, flagged: [{ code: "LDL", name: "LDL", status: "above" }], goals: ["energy", "cholesterol"], symptoms: [{ description: "tired", tags: [] }], question: "why am I tired" };
    expect(recommend(input).primary.id).toBe("professional-review");
    const done = recommend({ ...input, history: [{ actionId: "professional-review", category: "professional", outcome: "completed", at: "2026-11-20" }] });
    expect(done.primary.id).not.toBe("professional-review");
  });

  it("uses goals, symptoms and wearables when nothing is flagged", () => {
    const r = recommend({ ...base, goals: ["Sleep more consistently"], wearables: [{ metric: "sleep_asleep", avg7d: 380 }] });
    expect(r.primary.category).toBe("sleep");
    expect(r.primary.reasons.join(" ")).toMatch(/goal|wearable/);
  });

  it("falls back to a gentle default with no signals", () => {
    expect(recommend(base).primary.id).toBe("general-maintain");
  });

  it("adapts: an action skipped twice drops in the ranking", () => {
    const input: RecInput = { ...base, goals: ["Sleep more consistently"], wearables: [{ metric: "sleep_asleep", avg7d: 380 }] };
    const before = recommend(input).primary.id;
    const skipped = recommend({
      ...input,
      history: [
        { actionId: before, category: "sleep", outcome: "skipped", at: "2026-11-20" },
        { actionId: before, category: "sleep", outcome: "skipped", at: "2026-11-21" },
      ],
    });
    expect(skipped.primary.id).not.toBe(before);
    expect(skipped.all.find((x) => x.id === before)!.reasons.join(" ")).toMatch(/skipped/);
  });

  it("adapts a little after a single skip, and says so", () => {
    const input: RecInput = { ...base, goals: ["Sleep more consistently"], wearables: [{ metric: "sleep_asleep", avg7d: 380 }] };
    const first = recommend(input).all[0];
    const once = recommend({ ...input, history: [{ actionId: first.id, category: first.category, outcome: "skipped", at: "2026-11-20" }] });
    const after = once.all.find((x) => x.id === first.id)!;
    expect(after.score).toBe(Math.round((first.score - 1) * 100) / 100);
    expect(after.reasons.join(" ")).toMatch(/skipped it last time/);
  });
});

describe("M2.6 contextual AI turn", () => {
  it("grounds the answer in supplied evidence and the deterministic next move", async () => {
    const repo = await repoWithLatestReport();
    const res = await respond(DEMO_PROFILE_ID, "Why am I tired in the afternoons?", { repo, env, retriever: new InMemoryRetriever(null) });
    expect(res.nextMove.category).toBe("professional");
    expect(res.nextMoveReasons.length).toBeGreaterThan(0);
    expect(res.sources.length).toBeGreaterThan(0);
    const supplied = new Set(res.sources.map((s) => s.chunkId));
    for (const e of res.evidence) expect(supplied.has(e.evidenceId)).toBe(true);
    expect(res.evidence.length).toBeGreaterThan(0);
    expect(res.supportingActions.length).toBeLessThanOrEqual(3);
  });
});

describe("M2.8 supplement workflow (simulated review)", () => {
  it("suggests eligible categories once, never with a dose, and requires the reviewer to set doses", async () => {
    const repo = await repoWithLatestReport();
    const created = await suggestSupplements(repo, DEMO_PROFILE_ID);
    const catalogue = await repo.listSupplementCatalogue();
    const slugs = created.map((c) => catalogue.find((x) => x.id === c.catalogueId)!.slug).sort();
    expect(slugs).toEqual(["iron", "soluble-fibre", "vitamin-d"]);
    expect(created.every((c) => c.status === "pending" && c.reviewerDose === null && c.isSimulatedReview)).toBe(true);
    expect(await suggestSupplements(repo, DEMO_PROFILE_ID)).toEqual([]);

    expect(ReviewSchema.safeParse({ status: "approved" }).success).toBe(false); // dose required
    const approve = ReviewSchema.parse({ status: "approved", reviewerDose: "As directed by your GP (simulated)" });
    const approved = await repo.reviewSuggestion(created[0].id, DEMO_REVIEWER_ID, approve);
    expect(approved).toMatchObject({ status: "approved", reviewerDose: "As directed by your GP (simulated)", isSimulatedReview: true });
    const rejected = await repo.reviewSuggestion(created[1].id, DEMO_REVIEWER_ID, ReviewSchema.parse({ status: "rejected", reviewerNote: "Diet first" }));
    expect(rejected).toMatchObject({ status: "rejected", reviewerDose: null });
    const queue = await repo.listSuggestionsForReview();
    expect(queue[0].profileDisplayName).toMatch(/synthetic/);
  });
});

describe("M2.9 events", () => {
  it("ranks SAMPLE events by personal relevance and explains why", async () => {
    const repo = await repoWithLatestReport();
    const snap = await loadSnapshot(repo, DEMO_PROFILE_ID);
    const ranked = rankEvents(await repo.listEvents(), snap.context);
    expect(ranked[0].relevanceScore).toBeGreaterThan(0);
    expect(ranked[0].whyRelevant).toMatch(/^Suggested because of/);
    expect(ranked.every((e) => e.isSample)).toBe(true);
    const req = await repo.createEventRequest(DEMO_PROFILE_ID, ranked[0].id, null);
    expect(req).toMatchObject({ isMock: true, status: "requested" });
  });
});

describe("M2.10 plans, adaptation and timeline", () => {
  it("generates a plan, supersedes the old one, records outcomes and shows them on the timeline", async () => {
    const repo = await repoWithLatestReport();
    const p1 = await generatePlan(repo, DEMO_PROFILE_ID, "2026-11-27");
    expect(p1.supportingActions.length).toBeLessThanOrEqual(3);
    const p2 = await generatePlan(repo, DEMO_PROFILE_ID, "2026-11-27");
    expect((await repo.listPlans(DEMO_PROFILE_ID)).find((p) => p.id === p1.id)!.status).toBe("superseded");
    const target = p2.supportingActions[0];
    const updated = await recordActionOutcome(repo, DEMO_PROFILE_ID, p2.id, target.id, "skipped");
    expect(updated!.supportingActions[0].status).toBe("skipped");
    expect((await repo.listActionHistory(DEMO_PROFILE_ID))[0]).toMatchObject({ actionId: target.id, outcome: "skipped" });
    await recordActionOutcome(repo, DEMO_PROFILE_ID, p2.id, target.id, "skipped");
    const p3 = await generatePlan(repo, DEMO_PROFILE_ID, "2026-11-28");
    expect([p3.primaryAction, ...p3.supportingActions].find((a) => a.id === target.id)?.reasons?.join(" ") ?? "dropped").toMatch(/skipped|dropped/);

    await suggestSupplements(repo, DEMO_PROFILE_ID);
    const timeline = await buildTimeline(repo, DEMO_PROFILE_ID);
    const kinds = new Set(timeline.map((t) => t.kind));
    for (const k of ["report", "symptom", "plan", "action", "supplement"]) expect(kinds.has(k as never), k).toBe(true);
    expect(timeline.find((t) => t.kind === "report" && t.at === "2026-10-14")!.detail).toMatch(/outside the lab's range/);
  });

  it("Drizzle repository supports the M2 operations on Postgres", async () => {
    const pg = await createMigratedPglite();
    await seedDatabase(pg.db);
    const repo = new DrizzleRepository(pg.db);
    const plan = await generatePlan(repo, DEMO_PROFILE_ID, "2026-11-27");
    await recordActionOutcome(repo, DEMO_PROFILE_ID, plan.id, plan.primaryAction.id, "completed");
    expect((await repo.getActivePlan(DEMO_PROFILE_ID))!.primaryAction.status).toBe("completed");
    const created = await suggestSupplements(repo, DEMO_PROFILE_ID);
    expect(created.length).toBeGreaterThan(0); // vitamin D below range in the seeded history
    const reviewed = await repo.reviewSuggestion(created[0].id, DEMO_REVIEWER_ID, { status: "approved", reviewerDose: "Simulated dose text" });
    expect(reviewed).toMatchObject({ status: "approved", isSimulatedReview: true });
    // Atomicity: if the timeline note can't be written, the profile change must roll back too.
    const goalsBefore = (await repo.getProfile(DEMO_PROFILE_ID))!.goals;
    await expect(
      repo.updateProfile(DEMO_PROFILE_ID, { goals: [...goalsBefore, "Broken"] }, [{ kind: "goal_added", title: null as unknown as string, detail: {} }]),
    ).rejects.toThrow();
    expect((await repo.getProfile(DEMO_PROFILE_ID))!.goals).toEqual(goalsBefore);
    await repo.updateProfile(DEMO_PROFILE_ID, { goals: [...goalsBefore, "Run 5k"] }, [{ kind: "goal_added", title: "Goal added", detail: { summary: "Run 5k" } }]);
    const timeline = await buildTimeline(repo, DEMO_PROFILE_ID);
    expect(timeline.some((t) => t.kind === "profile_change")).toBe(true);
    await repo.deleteProfileHealthData(DEMO_PROFILE_ID);
    expect(await repo.listActionHistory(DEMO_PROFILE_ID)).toEqual([]);
    expect(await repo.listTimelineNotes(DEMO_PROFILE_ID)).toEqual([]);
    await pg.client.close();
  });
});
