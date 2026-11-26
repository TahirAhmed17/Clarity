import type { Embedder } from "./embedder";
import { chunkText, loadCorpus, toRetrieved } from "./corpus";
import { tokenize } from "./lexical";
import type { EvidenceFilter, RetrievalMode, Retriever } from "./retriever";

/**
 * Qdrant retriever (REST API, no SDK dependency). Dense cosine vectors + sparse term vectors with
 * Qdrant's server-side IDF modifier (BM25-style), fused with Qdrant's built-in RRF.
 * Used for the M2.2 benchmark; see RETRIEVAL_BENCHMARK.md for the decision.
 */

function fnv1a(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function sparseVector(text: string) {
  const tf = new Map<number, number>();
  for (const t of tokenize(text)) {
    const idx = fnv1a(t);
    tf.set(idx, (tf.get(idx) ?? 0) + 1);
  }
  const indices = [...tf.keys()].sort((a, b) => a - b);
  return { indices, values: indices.map((i) => tf.get(i)!) };
}

function qdrantFilter(f?: EvidenceFilter) {
  const must: unknown[] = [];
  if (f?.biomarkers?.length) must.push({ key: "biomarkers", match: { any: f.biomarkers } });
  if (f?.systems?.length) must.push({ key: "systems", match: { any: f.systems } });
  if (f?.themes?.length) must.push({ key: "themes", match: { any: f.themes } });
  return must.length ? { must } : undefined;
}

/** Qdrant point ids must be uint or UUID; derive a stable uint from the chunk id. */
const pointId = (id: string) => fnv1a(id);

export class QdrantRetriever implements Retriever {
  readonly id = "qdrant";
  private readonly byPoint = new Map(loadCorpus().map((c) => [pointId(c.id), c]));

  constructor(
    private readonly baseUrl: string,
    private readonly collection: string,
    private readonly embedder: Embedder | null,
  ) {}

  private async req(path: string, method: string, body?: unknown) {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Qdrant ${method} ${path} → ${res.status}: ${JSON.stringify(json).slice(0, 200)}`);
    return json as { result: unknown };
  }

  /** (Re)creates the collection and uploads the corpus with identical vectors to pgvector. */
  async index() {
    await this.req(`/collections/${this.collection}`, "DELETE").catch(() => {});
    await this.req(`/collections/${this.collection}`, "PUT", {
      vectors: { dense: { size: 384, distance: "Cosine" } },
      sparse_vectors: { lexical: { modifier: "idf" } },
    });
    for (const field of ["biomarkers", "systems", "themes"]) {
      await this.req(`/collections/${this.collection}/index`, "PUT", { field_name: field, field_schema: "keyword" });
    }
    const points = loadCorpus().map((c) => ({
      id: pointId(c.id),
      vector: { dense: c.embedding!, lexical: sparseVector(chunkText(c)) },
      payload: { chunkId: c.id, biomarkers: c.biomarkers, systems: c.systems, themes: c.themes },
    }));
    await this.req(`/collections/${this.collection}/points?wait=true`, "PUT", { points });
    return points.length;
  }

  async search(query: string, opts: { k?: number; filter?: EvidenceFilter; mode?: RetrievalMode } = {}) {
    const k = opts.k ?? 5;
    const mode = opts.mode ?? "hybrid";
    const filter = qdrantFilter(opts.filter);
    let qv: number[] | null = null;
    if (mode !== "lexical" && this.embedder) {
      try {
        [qv] = await this.embedder.embed([query]);
      } catch {
        qv = null;
      }
    }
    const sparse = sparseVector(query);
    let body: unknown;
    let modeUsed: RetrievalMode;
    if (mode === "vector" && qv) {
      body = { query: qv, using: "dense", limit: k, filter };
      modeUsed = "vector";
    } else if (mode === "hybrid" && qv) {
      body = {
        prefetch: [
          { query: qv, using: "dense", limit: 20, filter },
          { query: sparse, using: "lexical", limit: 20, filter },
        ],
        query: { fusion: "rrf" },
        limit: k,
      };
      modeUsed = "hybrid";
    } else {
      body = { query: sparse, using: "lexical", limit: k, filter };
      modeUsed = "lexical";
    }
    const res = (await this.req(`/collections/${this.collection}/points/query`, "POST", body)) as {
      result: { points: { id: number; score: number }[] };
    };
    const results = res.result.points.map((p) => toRetrieved(this.byPoint.get(p.id)!, p.score));
    return { results, modeUsed };
  }
}
