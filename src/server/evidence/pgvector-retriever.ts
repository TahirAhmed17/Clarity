import { sql, type SQL } from "drizzle-orm";
import type { ClarityDb } from "../data/drizzle-repository";
import type { Embedder } from "./embedder";
import { toRetrieved } from "./corpus";
import { tokenize, rrf } from "./lexical";
import type { EvidenceFilter, RetrievalMode, Retriever } from "./retriever";

type Row = { id: string; heading: string; content: string; source_id: string };

function rowsOf(res: unknown): Row[] {
  return (Array.isArray(res) ? res : (res as { rows: Row[] }).rows) as Row[];
}

function filterSql(f?: EvidenceFilter): SQL {
  const parts: SQL[] = [sql`true`];
  // `&&` = array overlap: chunk tagged with ANY of the requested values.
  if (f?.biomarkers?.length) parts.push(sql`biomarkers && ${`{${f.biomarkers.join(",")}}`}::text[]`);
  if (f?.systems?.length) parts.push(sql`systems && ${`{${f.systems.join(",")}}`}::text[]`);
  if (f?.themes?.length) parts.push(sql`themes && ${`{${f.themes.join(",")}}`}::text[]`);
  return sql.join(parts, sql` and `);
}

/** Supabase Postgres retriever: pgvector cosine (HNSW) + Postgres full-text, fused with RRF. */
export class PgvectorRetriever implements Retriever {
  readonly id = "pgvector";
  constructor(
    private readonly db: ClarityDb,
    private readonly embedder: Embedder | null,
  ) {}

  async denseIds(queryVec: number[], k: number, f?: EvidenceFilter) {
    const v = `[${queryVec.join(",")}]`;
    const res = await this.db.execute(
      sql`select id, heading, content, source_id from evidence_chunks
          where embedding is not null and ${filterSql(f)}
          order by embedding <=> ${v}::vector limit ${k}`,
    );
    return rowsOf(res);
  }

  async lexicalIds(query: string, k: number, f?: EvidenceFilter) {
    // OR-of-terms tsquery: natural-language questions rarely contain every term of a chunk.
    const terms = [...new Set(tokenize(query))].filter((t) => /^[a-z0-9]+$/.test(t));
    if (terms.length === 0) return [];
    const tsq = terms.join(" | ");
    const res = await this.db.execute(
      sql`select id, heading, content, source_id from evidence_chunks
          where tsv @@ to_tsquery('english', ${tsq}) and ${filterSql(f)}
          order by ts_rank(tsv, to_tsquery('english', ${tsq})) desc limit ${k}`,
    );
    return rowsOf(res);
  }

  async search(query: string, opts: { k?: number; filter?: EvidenceFilter; mode?: RetrievalMode } = {}) {
    const k = opts.k ?? 5;
    const mode = opts.mode ?? "hybrid";
    let qv: number[] | null = null;
    if (mode !== "lexical" && this.embedder) {
      try {
        [qv] = await this.embedder.embed([query]);
      } catch {
        qv = null;
      }
    }
    const toR = (r: Row, score: number) => toRetrieved({ id: r.id, heading: r.heading, text: r.content, sourceId: r.source_id }, score);

    if (mode === "vector" && qv) {
      const rows = await this.denseIds(qv, k, opts.filter);
      return { results: rows.map((r, i) => toR(r, 1 / (i + 1))), modeUsed: "vector" as const };
    }
    const lexical = await this.lexicalIds(query, 20, opts.filter);
    if (mode === "hybrid" && qv) {
      const dense = await this.denseIds(qv, 20, opts.filter);
      const byId = new Map([...dense, ...lexical].map((r) => [r.id, r]));
      const fused = rrf([dense.map((r) => r.id), lexical.map((r) => r.id)]);
      return { results: fused.slice(0, k).map((f) => toR(byId.get(f.id)!, f.score)), modeUsed: "hybrid" as const };
    }
    return { results: lexical.slice(0, k).map((r, i) => toR(r, 1 / (i + 1))), modeUsed: "lexical" as const };
  }
}
