/**
 * M2.2 retrieval benchmark: Supabase pgvector vs Qdrant (+ in-memory BM25 baseline).
 * Identical chunks, identical vectors (all-MiniLM-L6-v2), identical queries and relevance labels.
 *
 * Needs: DATABASE_URL (local Supabase: `npx supabase db start`, then db:migrate + db:seed)
 *        QDRANT_URL (default http://localhost:6333; `docker run -p 6333:6333 qdrant/qdrant`)
 * Usage: npm run bench:retrieval   → prints a table and writes docs/benchmarks/retrieval-<date>.json
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { ClarityDb } from "../src/server/data/drizzle-repository";
import * as schema from "../src/server/db/schema";
import { MiniLmEmbedder, type Embedder } from "../src/server/evidence/embedder";
import { InMemoryRetriever } from "../src/server/evidence/memory-retriever";
import { PgvectorRetriever } from "../src/server/evidence/pgvector-retriever";
import { QdrantRetriever } from "../src/server/evidence/qdrant-retriever";
import type { EvidenceFilter, RetrievalMode, Retriever } from "../src/server/evidence/retriever";

config({ path: ".env.local" });

/** Hand-labelled relevance judgements (chunk ids). Written before running the benchmark. */
const QUERIES: { q: string; relevant: string[]; filter?: EvidenceFilter }[] = [
  { q: "What does low ferritin mean?", relevant: ["mp-ferritin-1", "mp-ferritin-2", "mp-ferritin-3", "mp-iron-2"] },
  { q: "I feel exhausted all the time, could it be my iron?", relevant: ["mp-ferritin-3", "mp-iron-1", "mp-iron-2", "mp-ferritin-1"] },
  { q: "foods that are rich in iron", relevant: ["mp-iron-1"] },
  { q: "my ALT liver enzyme is slightly raised", relevant: ["mp-liver-1", "mp-liver-2", "mp-liver-3"] },
  { q: "how to bring down LDL cholesterol with diet", relevant: ["nhs-lower-cholesterol-1", "mp-cholesterol-2", "who-healthy-diet-1"] },
  { q: "does exercise help cholesterol", relevant: ["nhs-lower-cholesterol-2", "mp-cholesterol-2"] },
  { q: "is fish oil worth taking", relevant: ["nccih-omega3-2", "nccih-omega3-1"] },
  { q: "vitamin D below the lab range in winter", relevant: ["nhs-vitamin-d-1", "mp-vitd-test-1", "mp-vitamin-d-1"] },
  { q: "can you take too much vitamin D", relevant: ["nhs-vitamin-d-1", "mp-vitd-test-1"] },
  { q: "how many hours of sleep should an adult get", relevant: ["mp-healthy-sleep-1", "nhlbi-sleep-1"] },
  { q: "I struggle to fall asleep, any habits that help?", relevant: ["mp-healthy-sleep-2"] },
  { q: "does catching up on sleep at weekends work", relevant: ["nhlbi-sleep-1"] },
  { q: "what is eGFR and why does it drop with age", relevant: ["nkf-egfr-1", "mp-creatinine-1"] },
  { q: "high creatinine after a heavy gym session", relevant: ["mp-creatinine-2"] },
  { q: "underactive thyroid blood test", relevant: ["mp-tsh-1", "mp-tsh-2"] },
  { q: "average blood sugar over three months", relevant: ["mp-hba1c-1"] },
  { q: "my result is just outside the normal range, should I worry", relevant: ["mp-lab-results-2", "mp-lab-results-1"] },
  { q: "markers of inflammation in blood", relevant: ["mp-crp-1"] },
  { q: "how much physical activity per week is recommended", relevant: ["who-physical-activity-1"] },
  // Filtered queries (metadata filtering).
  { q: "what should I know about these results", relevant: ["nkf-egfr-1", "nkf-egfr-2", "mp-creatinine-1", "mp-creatinine-2"], filter: { systems: ["kidneys"] } },
];

const K = 5;
const REPS = 5;

function metrics(ids: string[], relevant: string[]) {
  const rel = new Set(relevant);
  const hits = ids.slice(0, K).filter((id) => rel.has(id)).length;
  const firstHit = ids.findIndex((id) => rel.has(id));
  const dcg = ids.slice(0, K).reduce((n, id, i) => n + (rel.has(id) ? 1 / Math.log2(i + 2) : 0), 0);
  const idcg = [...Array(Math.min(K, relevant.length))].reduce((n, _, i) => n + 1 / Math.log2(i + 2), 0);
  return {
    precision: hits / K,
    recall: hits / relevant.length,
    mrr: firstHit >= 0 ? 1 / (firstHit + 1) : 0,
    ndcg: idcg ? dcg / idcg : 0,
    filterViolations: 0,
  };
}

const pct = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor((p / 100) * xs.length))];
const r3 = (x: number) => Math.round(x * 1000) / 1000;

/** Embedder wrapper that serves pre-computed query vectors, so store latency excludes model time. */
class CachedEmbedder implements Embedder {
  readonly id = "cached";
  readonly dimensions = 384;
  constructor(private readonly cache: Map<string, number[]>) {}
  async embed(texts: string[]) {
    return texts.map((t) => this.cache.get(t)!);
  }
}

async function main() {
  const real = new MiniLmEmbedder();
  const t0 = performance.now();
  const qVecs = await real.embed(QUERIES.map((x) => x.q));
  const embedMs = (performance.now() - t0) / QUERIES.length;
  const singleT = performance.now();
  await real.embed(["warm single query timing"]);
  const singleEmbedMs = performance.now() - singleT;
  const embedder = new CachedEmbedder(new Map(QUERIES.map((x, i) => [x.q, qVecs[i]])));

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL required (local Supabase)");
  const pg = postgres(url, { prepare: false, max: 2, onnotice: () => {} });
  const db = drizzle(pg, { schema }) as unknown as ClarityDb;

  const qdrant = new QdrantRetriever(process.env.QDRANT_URL ?? "http://localhost:6333", "clarity_evidence_bench", embedder);
  const indexed = await qdrant.index();

  const systems: { name: string; r: Retriever; mode: RetrievalMode }[] = [
    { name: "memory BM25 (baseline)", r: new InMemoryRetriever(null), mode: "lexical" },
    { name: "pgvector · vector", r: new PgvectorRetriever(db, embedder), mode: "vector" },
    { name: "pgvector · full-text", r: new PgvectorRetriever(db, embedder), mode: "lexical" },
    { name: "pgvector · hybrid (RRF)", r: new PgvectorRetriever(db, embedder), mode: "hybrid" },
    { name: "qdrant · vector", r: qdrant, mode: "vector" },
    { name: "qdrant · sparse/idf", r: qdrant, mode: "lexical" },
    { name: "qdrant · hybrid (RRF)", r: qdrant, mode: "hybrid" },
  ];

  const results: Record<string, unknown>[] = [];
  for (const s of systems) {
    const agg = { precision: 0, recall: 0, mrr: 0, ndcg: 0, filterViolations: 0 };
    const lat: number[] = [];
    for (const item of QUERIES) {
      // Warm-up, then timed repetitions.
      const first = await s.r.search(item.q, { k: K, filter: item.filter, mode: s.mode });
      for (let i = 0; i < REPS; i++) {
        const t = performance.now();
        await s.r.search(item.q, { k: K, filter: item.filter, mode: s.mode });
        lat.push(performance.now() - t);
      }
      const ids = first.results.map((x) => x.chunkId);
      const m = metrics(ids, item.relevant);
      if (item.filter?.systems) {
        const { EVIDENCE_NOTES } = await import("../src/data/evidence/catalogue");
        m.filterViolations = ids.filter((id) => !EVIDENCE_NOTES.find((n) => n.id === id)!.systems.some((x) => item.filter!.systems!.includes(x))).length;
      }
      for (const key of Object.keys(agg) as (keyof typeof agg)[]) agg[key] += m[key];
    }
    const n = QUERIES.length;
    results.push({
      system: s.name,
      [`P@${K}`]: r3(agg.precision / n),
      [`R@${K}`]: r3(agg.recall / n),
      MRR: r3(agg.mrr / n),
      [`nDCG@${K}`]: r3(agg.ndcg / n),
      filterViolations: agg.filterViolations,
      p50ms: r3(pct(lat, 50)),
      p95ms: r3(pct(lat, 95)),
    });
  }
  await pg.end();

  console.table(results);
  console.log(`Query embedding (MiniLM, local CPU): ${r3(embedMs)} ms/query in batch, ${r3(singleEmbedMs)} ms single (excluded from store latency).`);
  console.log(`Corpus: ${indexed} chunks. Queries: ${QUERIES.length}. Repetitions: ${REPS}.`);

  mkdirSync("docs/benchmarks", { recursive: true });
  const file = `docs/benchmarks/retrieval-${new Date().toISOString().slice(0, 10)}.json`;
  writeFileSync(file, JSON.stringify({ ranAt: new Date().toISOString(), k: K, reps: REPS, corpus: indexed, queries: QUERIES.length, embedMsBatch: r3(embedMs), embedMsSingle: r3(singleEmbedMs), results }, null, 2));
  console.log(`Saved ${file}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
