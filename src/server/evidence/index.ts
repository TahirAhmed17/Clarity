import { getDatabase } from "../data";
import { MiniLmEmbedder } from "./embedder";
import { InMemoryRetriever } from "./memory-retriever";
import { PgvectorRetriever } from "./pgvector-retriever";
import type { Retriever } from "./retriever";

/**
 * Production retriever choice (see docs/RETRIEVAL_BENCHMARK.md):
 * database mode → Supabase pgvector; seed mode → in-memory over the same bundled vectors.
 * Default search mode is "vector" (best MRR/nDCG in the benchmark); lexical is the automatic fallback.
 * Built per call (cheap); the expensive embedding model is cached separately in embedder.ts.
 */
export async function getRetriever(): Promise<Retriever> {
  const embedder = process.env.EVIDENCE_EMBEDDINGS === "off" ? null : new MiniLmEmbedder();
  const db = await getDatabase();
  return db ? new PgvectorRetriever(db, embedder) : new InMemoryRetriever(embedder);
}

export const DEFAULT_RETRIEVAL_MODE = "vector" as const;
