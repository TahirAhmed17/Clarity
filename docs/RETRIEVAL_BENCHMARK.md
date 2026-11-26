# Retrieval benchmark: Supabase pgvector vs Qdrant (M2.2)

Run: 2026-11-27, Windows 11 local machine. Local Supabase Postgres 17 (`supabase/postgres:17.12.0.002`, pgvector, HNSW index) vs Qdrant 1.15.4 (Docker), both on localhost. Raw output: [`benchmarks/retrieval-2026-11-26.json`](benchmarks/retrieval-2026-11-26.json) (file is named by UTC date). Reproduce with `npm run bench:retrieval`.

## Setup (identical for every system)

- **Corpus**: 41 curated evidence chunks from 22 verified sources (`src/data/evidence/catalogue.ts`).
- **Vectors**: `Xenova/all-MiniLM-L6-v2` (384-d, normalised), pre-computed once and loaded into both stores.
- **Queries**: 20 natural-language questions with relevance labels written **before** the run. One query uses a metadata filter (`systems = kidneys`).
- **Metrics**: P@5, R@5, MRR, nDCG@5, filter violations, and store latency p50/p95 over 5 timed repetitions per query after warm-up. Query-embedding time is measured separately and excluded from store latency.
- **Hybrid**: both stores fuse a dense list and a lexical list with reciprocal-rank fusion (k = 60). pgvector uses Postgres full-text search (`tsvector`, OR-of-terms); Qdrant uses sparse term vectors with its server-side IDF modifier.

## Results

| System | P@5 | R@5 | MRR | nDCG@5 | Filter violations | p50 ms | p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- |
| In-memory BM25 (baseline) | 0.31 | 0.813 | 0.875 | 0.793 | 0 | 0.04 | 0.13 |
| pgvector · vector | 0.40 | 0.971 | **0.975** | **0.936** | 0 | 2.68 | 4.14 |
| pgvector · full-text | 0.33 | 0.838 | 0.867 | 0.801 | 0 | 2.01 | 2.78 |
| pgvector · hybrid (RRF) | 0.40 | 0.967 | 0.917 | 0.914 | 0 | 4.10 | 5.72 |
| Qdrant · vector | 0.40 | 0.971 | **0.975** | **0.936** | 0 | 2.40 | 4.21 |
| Qdrant · sparse/IDF | 0.35 | 0.879 | 0.800 | 0.788 | 0 | 2.15 | 2.84 |
| Qdrant · hybrid (RRF) | 0.41 | **0.983** | 0.875 | 0.895 | 0 | 2.82 | 4.44 |

Query embedding (MiniLM, local CPU): ~4 ms per single warm query, ~50 ms/query on the first cold batch.

P@5 is capped because most queries have only one to four relevant chunks.

## Reading the results

- **Vector quality is identical.** At 41 chunks both engines effectively return exact nearest neighbours, so with identical vectors they return identical rankings. Quality differences at this scale come from the embedding model and fusion strategy, not the store.
- **Hybrid didn't help ranking here.** Hybrid raised recall slightly (Qdrant 0.983) but lowered MRR and nDCG in both stores, because lexical matches on common words pushed down semantically better chunks. Dense retrieval with metadata filters was the best default.
- **Metadata filtering** worked correctly in both stores (0 violations).
- **Latency** is a few milliseconds for both stores locally, which is negligible next to an LLM call. Network latency to a hosted service would dominate in production; this local test doesn't measure that.

## Operational complexity

| | Supabase pgvector | Qdrant |
| --- | --- | --- |
| New infrastructure | None: same Supabase project, same migrations, same backups | Separate service (Qdrant Cloud or self-hosted) plus API key |
| Data consistency | Evidence sits next to user data; joins and RLS in SQL | Separate store to keep in sync with the catalogue |
| Access control | RLS policies (evidence is public read) | API-key level |
| Hybrid search | Full-text search built in | Sparse vectors plus built-in fusion (cleaner API) |
| Scale headroom | Fine for thousands to low millions of chunks with HNSW | Built for much larger vector workloads |

## Decision

**Use Supabase pgvector, dense retrieval with metadata filters by default** (`mode: "vector"`). Lexical retrieval remains the automatic fallback when the embedder can't load, and hybrid stays available behind the same `Retriever` interface.

Revisit Qdrant if the corpus grows by orders of magnitude, or if retrieval quality on a larger labelled set shows a store-dependent difference.

## Limitations of this benchmark

- Small corpus (41 chunks) and 20 queries labelled by the same team that wrote the corpus, so there's a risk of labelling bias.
- Local-only latency: no network or cloud measurements.
- A single embedding model. A larger or medical-domain model could change the ranking comparisons, but not the store comparison.
