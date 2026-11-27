/**
 * Pre-computes embeddings for every evidence note → src/data/evidence/embeddings.json.
 * Committed so the DB seed, the in-memory retriever and the benchmark all use identical vectors.
 * Re-run after editing src/data/evidence/catalogue.ts:  npm run evidence:embed
 */
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { EVIDENCE_NOTES } from "../src/data/evidence/catalogue";
import { chunkText } from "../src/server/evidence/corpus";
import { EMBEDDING_MODEL_ID, MiniLmEmbedder } from "../src/server/evidence/embedder";

async function main() {
  const started = Date.now();
  const embedder = new MiniLmEmbedder();
  const vectors = await embedder.embed(EVIDENCE_NOTES.map(chunkText));
  const out = {
    model: EMBEDDING_MODEL_ID,
    dimensions: embedder.dimensions,
    // Lets tests detect when catalogue text changed without re-embedding.
    catalogueHash: createHash("sha256").update(JSON.stringify(EVIDENCE_NOTES.map((n) => [n.id, chunkText(n)]))).digest("hex"),
    vectors: Object.fromEntries(EVIDENCE_NOTES.map((n, i) => [n.id, vectors[i]])),
  };
  writeFileSync("src/data/evidence/embeddings.json", JSON.stringify(out));
  console.log(`Embedded ${EVIDENCE_NOTES.length} notes with ${EMBEDDING_MODEL_ID} in ${Date.now() - started}ms`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
