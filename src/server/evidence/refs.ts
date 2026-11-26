import { sourceById } from "@/data/evidence/catalogue";
import type { EvidenceRef } from "@/components/features/evidence-list";
import { loadCorpus } from "./corpus";
import type { RetrievedEvidence } from "./retriever";

const CORPUS = new Map(loadCorpus().map((c) => [c.id, c]));

/** Resolves evidence chunk ids to displayable source references (unknown ids are dropped). */
export function evidenceRefs(ids: string[] | undefined): EvidenceRef[] {
  return (ids ?? []).flatMap((id) => {
    const c = CORPUS.get(id);
    const s = c ? sourceById(c.sourceId) : null;
    return c && s ? [{ chunkId: id, heading: c.heading, publisher: s.publisher, title: s.title, url: s.url, date: s.lastReviewedOn ?? s.lastUpdatedOn ?? s.publishedOn }] : [];
  });
}

export function retrievedToRefs(items: RetrievedEvidence[]): EvidenceRef[] {
  return items.map((e) => ({
    chunkId: e.chunkId,
    heading: e.heading,
    publisher: e.source.publisher,
    title: e.source.title,
    url: e.source.url,
    date: e.source.lastReviewedOn ?? e.source.lastUpdatedOn ?? e.source.publishedOn,
  }));
}
