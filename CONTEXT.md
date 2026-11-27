# CONTEXT — project brain

Read this first when resuming work. Keep it current.

## What Clarity is

A hybrid AI companion and health intelligence dashboard. You talk to a conversational orb and get structured results. Philosophy: do the complexity behind the scenes and show **one clear next move**, with understandable evidence and room to explore.

## Where we are (2026-11-27)

- Repo: `TahirAhmed17/Clarity`. M1 is in [PR #1](https://github.com/TahirAhmed17/Clarity/pull/1) (`feat/m1-foundation` → `main`). M2 is on `feat/m2-health-intelligence`.
- **Supabase GitHub integration** is connected to project `tothtmanjqtfgfzpginm`. *Preview branches are disabled*, so migrations only run against that project when a PR merges into `main`. They have been verified locally on Supabase's own Postgres 17 image.
- The product owner asked for continuous building without per-milestone approval; stop only for blockers.
- **Next: M3** (premium experience).

## Confirmed product decisions (from the brief)

Hybrid companion + dashboard · orb + structured results · contextual interpretation with curated evidence retrieval · minimal progressive onboarding · concise overview with expandable detail · 3D organ overview + cards (M3) · longitudinal timeline · premium, bright, editorial UI · Clarity independent, Tafasa configurable.

## Engineering decisions

| Decision | Why |
| --- | --- |
| Next 16.4 with Cache Components | Data reads `await connection()` and sit inside `<Suspense>` (`loadPageData()`). Bundled docs in `node_modules/next/dist/docs/` are authoritative. |
| Migrations live in `supabase/migrations/` (drizzle-kit `prefix: "supabase"`) | The Supabase GitHub integration and `supabase db push` apply exactly what tests run. `npm run db:migrate` uses the Supabase CLI so there is **one** migration tracker. |
| PGlite + pgvector + a stub `auth.uid()` for tests | Runs real migrations and RLS policies on Postgres with no credentials |
| Local Supabase uses ports 553xx (`supabase/config.jsonc`) | Another local Supabase project on this machine uses the defaults |
| Only the DB connection and seed store are cached on `globalThis`; repositories and retrievers are built per call | Caching instances kept stale methods across dev hot reload (found during M2 testing) |
| Evidence = curated, verified, paraphrased notes (not scraped text) | No fabricated sources and no copyright problems; see docs/EVIDENCE.md |
| Embeddings: all-MiniLM-L6-v2 via transformers.js, pre-computed for chunks, loaded lazily for queries; lexical fallback | Works offline after the first model download; no API key needed |
| Retrieval store: **Supabase pgvector, dense mode** | The benchmark showed quality identical to Qdrant with less infrastructure, and hybrid lowered top-rank quality; see docs/RETRIEVAL_BENCHMARK.md |
| Recommendations are deterministic; the LLM explains them | Testable, explainable and safe. Engine `nextMove` is overridden by the engine's ranked primary. |
| Safety-first: a single consolidated "see a GP" action stays primary while results are flagged, until marked done | Results outside range should never be outranked by lifestyle tips |
| Dose filter excludes concentrations (`13 ug/L` is not a dose) | Earlier regex redacted lab values (found by the engine evaluation) |
| Biomarker definitions and system mappings are versioned code, not DB tables | Reference data that must be reviewed like code; avoids tables nothing writes to |
| New tables only where users or the system write data: `evidence_*`, `action_history`, `health_timeline_events` | The brief asks to avoid unnecessary tables |
| Profile update + timeline notes in one transaction | A failed note write previously left the goal changed but unlogged |
| Reviewer actions use `getSimulatedReviewer()` (role-checked synthetic reviewer) | M2 is simulated; M3.8 adds real role-restricted access |

## Open questions for the product owner

1. **Merge PR #1** (and later M2) to `main`. That applies the migrations to the Supabase project through the GitHub integration.
2. **Keys**: Gemini (key + model ID) and the OpenRouter LingSante slug, so the engine evaluation can run live.
3. **OCR provider**: Gemini document understanding or offline tesseract.js?
4. **Visual references**: the three palette references weren't in the repo; tokens use the brief's hex values.
5. **Apple Health `export.zip`** support?
6. NIH ODS and NICE block automated access. Should someone review those pages manually and add them?

## Known limitations

- The seed fallback is in-memory (lost on restart). Uploads are buffered in memory (≤50 MB).
- The first evidence query in a fresh process loads the MiniLM model (~6 s cold, ~4 ms per query afterwards).
- `drizzle-kit` brings in a dev-only `esbuild` advisory.
- The biomarker parser has only been validated on synthetic layouts.
