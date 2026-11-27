import { EVIDENCE_NOTES, EVIDENCE_SOURCES, type EvidenceNote, type EvidenceSource } from "@/data/evidence/catalogue";
import embeddings from "@/data/evidence/embeddings.json";
import type { RetrievedEvidence } from "./retriever";

export interface CorpusChunk extends EvidenceNote {
  embedding: number[] | null;
}

export const chunkText = (n: { heading: string; text: string }) => `${n.heading}. ${n.text}`;

const vectors = (embeddings as { vectors: Record<string, number[]> }).vectors;
export const EMBEDDINGS_MODEL = (embeddings as { model: string }).model;

export function loadCorpus(): CorpusChunk[] {
  return EVIDENCE_NOTES.map((n) => ({ ...n, embedding: vectors[n.id] ?? null }));
}

const sourceMap = new Map(EVIDENCE_SOURCES.map((s) => [s.id, s]));

export function toRetrieved(chunk: { id: string; heading: string; text: string; sourceId: string }, score: number): RetrievedEvidence {
  const s = sourceMap.get(chunk.sourceId) as EvidenceSource;
  return {
    chunkId: chunk.id,
    heading: chunk.heading,
    content: chunk.text,
    score,
    source: {
      id: s.id,
      publisher: s.publisher,
      title: s.title,
      url: s.url,
      publishedOn: s.publishedOn,
      lastUpdatedOn: s.lastUpdatedOn,
      lastReviewedOn: s.lastReviewedOn,
      evidenceClass: s.evidenceClass,
      limitations: s.limitations,
    },
  };
}
