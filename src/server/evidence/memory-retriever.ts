import { cosine, type Embedder } from "./embedder";
import { loadCorpus, chunkText, toRetrieved, type CorpusChunk } from "./corpus";
import { Bm25Index, rrf } from "./lexical";
import { matchesFilter, type EvidenceFilter, type RetrievalMode, type Retriever } from "./retriever";

/** Retrieval over the bundled catalogue + pre-computed vectors. Used in seed mode (no database). */
export class InMemoryRetriever implements Retriever {
  readonly id = "memory";
  private readonly chunks: CorpusChunk[];
  private readonly bm25: Bm25Index<CorpusChunk>;

  constructor(private readonly embedder: Embedder | null) {
    this.chunks = loadCorpus();
    this.bm25 = new Bm25Index(this.chunks, chunkText);
  }

  async search(query: string, opts: { k?: number; filter?: EvidenceFilter; mode?: RetrievalMode } = {}) {
    const k = opts.k ?? 5;
    const mode = opts.mode ?? "hybrid";
    const pool = this.chunks.filter((c) => matchesFilter(c, opts.filter));
    const lexical = this.bm25.search(query, (c) => matchesFilter(c, opts.filter)).map((r) => r.item.id);

    let dense: string[] | null = null;
    if (mode !== "lexical" && this.embedder) {
      try {
        const [q] = await this.embedder.embed([query]);
        dense = pool
          .filter((c) => c.embedding)
          .map((c) => ({ id: c.id, s: cosine(q, c.embedding!) }))
          .sort((a, b) => b.s - a.s)
          .map((r) => r.id);
      } catch {
        dense = null;
      }
    }

    const byId = new Map(this.chunks.map((c) => [c.id, c]));
    if (mode === "vector" && dense) {
      return { results: dense.slice(0, k).map((id, i) => toRetrieved(byId.get(id)!, 1 / (i + 1))), modeUsed: "vector" as const };
    }
    if (mode === "hybrid" && dense) {
      // Dense ranks are truncated to the top 20 so far-away chunks don't get fused in.
      return { results: rrf([dense.slice(0, 20), lexical]).slice(0, k).map((r) => toRetrieved(byId.get(r.id)!, r.score)), modeUsed: "hybrid" as const };
    }
    return { results: lexical.slice(0, k).map((id, i) => toRetrieved(byId.get(id)!, 1 / (i + 1))), modeUsed: "lexical" as const };
  }
}
