import type { EvidenceSource, SystemId, ThemeId } from "@/data/evidence/catalogue";

export interface EvidenceFilter {
  /** Match chunks tagged with ANY of these biomarker codes / systems / themes. */
  biomarkers?: string[];
  systems?: SystemId[];
  themes?: ThemeId[];
}

export interface RetrievedEvidence {
  chunkId: string;
  heading: string;
  content: string;
  score: number;
  source: Pick<EvidenceSource, "id" | "publisher" | "title" | "url" | "lastUpdatedOn" | "lastReviewedOn" | "publishedOn" | "evidenceClass" | "limitations">;
}

export type RetrievalMode = "hybrid" | "vector" | "lexical";

/** Replaceable retrieval boundary (pgvector, in-memory, Qdrant). */
export interface Retriever {
  readonly id: string;
  search(query: string, opts?: { k?: number; filter?: EvidenceFilter; mode?: RetrievalMode }): Promise<{ results: RetrievedEvidence[]; modeUsed: RetrievalMode }>;
}

export function matchesFilter(chunk: { biomarkers: string[]; systems: string[]; themes: string[] }, f?: EvidenceFilter) {
  if (!f) return true;
  const any = (have: string[], want?: string[]) => !want || want.length === 0 || want.some((w) => have.includes(w));
  // A chunk matches if it satisfies every provided dimension.
  return any(chunk.biomarkers, f.biomarkers) && any(chunk.systems, f.systems) && any(chunk.themes, f.themes);
}
