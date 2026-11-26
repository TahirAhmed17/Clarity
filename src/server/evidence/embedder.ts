/**
 * Sentence embeddings for evidence retrieval.
 * Default: all-MiniLM-L6-v2 (384-d) via transformers.js, loaded lazily on first use and cached
 * under .cache/models. If it cannot load (offline first run, unsupported platform), callers fall
 * back to lexical retrieval — retrieval never hard-fails because of the embedder.
 */
export const EMBEDDING_MODEL_ID = "Xenova/all-MiniLM-L6-v2";

export interface Embedder {
  readonly id: string;
  readonly dimensions: number;
  embed(texts: string[]): Promise<number[][]>;
}

type FeatureExtractor = (texts: string[], opts: { pooling: "mean"; normalize: boolean }) => Promise<{ tolist(): number[][] }>;

const store = globalThis as typeof globalThis & { __clarityEmbedder?: Promise<FeatureExtractor> };

async function loadExtractor(): Promise<FeatureExtractor> {
  const t = await import("@huggingface/transformers");
  t.env.cacheDir = ".cache/models";
  t.env.allowLocalModels = true;
  return (await t.pipeline("feature-extraction", EMBEDDING_MODEL_ID, { dtype: "q8" })) as unknown as FeatureExtractor;
}

export class MiniLmEmbedder implements Embedder {
  readonly id = EMBEDDING_MODEL_ID;
  readonly dimensions = 384;

  async embed(texts: string[]): Promise<number[][]> {
    store.__clarityEmbedder ??= loadExtractor().catch((e) => {
      store.__clarityEmbedder = undefined; // allow a later retry
      throw e;
    });
    const extractor = await store.__clarityEmbedder;
    const out = await extractor(texts, { pooling: "mean", normalize: true });
    return out.tolist().map((v) => v.map((x) => Math.round(x * 1e6) / 1e6));
  }
}

export function cosine(a: number[], b: number[]) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}
