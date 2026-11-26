/** Minimal BM25 index (Okapi, k1=1.2, b=0.75) for the offline lexical retriever and hybrid fusion. */

const STOP = new Set(
  "a an and are as at be but by can do does for from has have how i if in into is it its may me my of on or our so than that the their them then there these this to was were what when where which who why will with you your".split(" "),
);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/[\s-]+/)
    .filter((t) => t.length > 1 && !STOP.has(t))
    .map((t) => (t.length > 4 && t.endsWith("s") && !t.endsWith("ss") ? t.slice(0, -1) : t));
}

export class Bm25Index<T extends { id: string }> {
  private docs: { item: T; tf: Map<string, number>; len: number }[] = [];
  private df = new Map<string, number>();
  private avgLen = 0;

  constructor(items: T[], text: (item: T) => string) {
    for (const item of items) {
      const toks = tokenize(text(item));
      const tf = new Map<string, number>();
      for (const t of toks) tf.set(t, (tf.get(t) ?? 0) + 1);
      for (const t of tf.keys()) this.df.set(t, (this.df.get(t) ?? 0) + 1);
      this.docs.push({ item, tf, len: toks.length });
    }
    this.avgLen = this.docs.reduce((n, d) => n + d.len, 0) / Math.max(1, this.docs.length);
  }

  search(query: string, filter: (item: T) => boolean = () => true): { item: T; score: number }[] {
    const q = [...new Set(tokenize(query))];
    const N = this.docs.length;
    const out: { item: T; score: number }[] = [];
    for (const d of this.docs) {
      if (!filter(d.item)) continue;
      let score = 0;
      for (const t of q) {
        const f = d.tf.get(t);
        if (!f) continue;
        const df = this.df.get(t) ?? 0;
        const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
        score += idf * ((f * 2.2) / (f + 1.2 * (1 - 0.75 + (0.75 * d.len) / this.avgLen)));
      }
      if (score > 0) out.push({ item: d.item, score });
    }
    return out.sort((a, b) => b.score - a.score);
  }
}

/** Reciprocal-rank fusion of several ranked id lists (k=60, the standard constant). */
export function rrf(lists: string[][], k = 60): { id: string; score: number }[] {
  const scores = new Map<string, number>();
  for (const list of lists) list.forEach((id, rank) => scores.set(id, (scores.get(id) ?? 0) + 1 / (k + rank + 1)));
  return [...scores.entries()].map(([id, score]) => ({ id, score })).sort((a, b) => b.score - a.score);
}
