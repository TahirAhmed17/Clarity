# CONTEXT — project brain

Read this first when resuming work. Keep it current.

## What Clarity is

A hybrid AI companion and health intelligence dashboard. You talk to a conversational orb and get structured results. Philosophy: do the complexity behind the scenes and show **one clear next move**, with understandable evidence and room to explore.

## Where we are (2026-11-27)

- Repo: `TahirAhmed17/Clarity`. M1 is merged ([PR #1](https://github.com/TahirAhmed17/Clarity/pull/1)). M2 is open as [PR #2](https://github.com/TahirAhmed17/Clarity/pull/2) (not merged). M3 is on `feat/m3-premium-experience`, stacked on M2.
- **Supabase GitHub integration** is connected to project `tothtmanjqtfgfzpginm`. *Preview branches are disabled*, so migrations only run against that project when a PR merges into `main`. Only M1's migrations are live there; M2 and M3 migrations are verified locally (Supabase PG17 image and PGlite).
- The product owner builds continuously but **merges and deployments need their explicit approval**.
- **Next:** M4 and M5 are proposed in IMPLEMENTATION_PLAN.md. The brief defines only M1–M3, so confirm their scope with the product owner.
- **Local data caution:** the local Docker database contains a real lab report the product owner uploaded while testing. Never reset that database, and never display or copy its values. Test with `DATA_MODE=seed` (synthetic only).

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

## M3 decisions

| Decision | Why |
| --- | --- |
| WebGL detection runs after mount (`useState` + `useEffect`), not via `useSyncExternalStore` with a server snapshot | The external-store version didn't reliably re-check after hydration; the orb stayed on the CSS fallback |
| Orb shader includes `<colorspace_fragment>` and the Canvas uses `flat` | Without them the colours rendered muddy (linear output, tone mapping) |
| Evidence references are resolved on the server for client components | Stops the corpus and its 150 KB of embeddings being bundled into the browser |
| Number parsing distinguishes thousands from decimal commas | A real report showed `11,860` stored as 11.86 |
| The reviewer gate uses a signed cookie plus an access code (not Supabase Auth yet) | Restricts the simulated workspace now; real clinician identity is M4.1 |
| One shared PGlite per test file, reset between tests | Fixes the intermittent memory-exhaustion failures |
