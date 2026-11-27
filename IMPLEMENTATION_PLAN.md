# Implementation plan

Work proceeds M1 → M2 → M3. The product owner asked (2026-11-27) to continue without waiting for approval at each checkpoint, stopping only for blockers.

## M1 — Foundation ✅ ([PR #1](https://github.com/TahirAhmed17/Clarity/pull/1))

| Phase | Delivered |
| --- | --- |
| M1.1 Setup | Next 16.4, TypeScript, Tailwind 4, folder architecture, validated env, base components |
| M1.2 Database | Drizzle schema; migrations in `supabase/migrations` (with RLS); idempotent seed; seed-data fallback |
| M1.3 Demo data | Synthetic profile and reviewer, reports, generated PDF, Apple Health XML, wearables, catalogue, events |
| M1.4 Ingestion | PDF → biomarkers (originals preserved), scanned-PDF detection, Apple Health streaming parser, validation |
| M1.5 AI foundation | `AIEngine` with Gemini, LingSante (experimental) and Mock; shared schemas; safety layer |
| M1.6 Shell | `/`, `/app/*`, `/doctor` |

## M2 — Health intelligence ✅ (branch `feat/m2-health-intelligence`)

| Phase | Delivered | Where |
| --- | --- | --- |
| M2.1 Curated knowledge | 22 verified sources, 41 paraphrased notes; blocked sources recorded | `src/data/evidence/`, [docs/EVIDENCE.md](docs/EVIDENCE.md) |
| M2.2 RAG + benchmark | MiniLM embeddings; `Retriever` interface; pgvector, in-memory and Qdrant implementations; benchmark found **pgvector, vector mode** best | `src/server/evidence/`, [docs/RETRIEVAL_BENCHMARK.md](docs/RETRIEVAL_BENCHMARK.md) |
| M2.3 Hybrid engines | Gemini and LingSante share one prompt, schema, evidence and safety; evaluation mode on identical synthetic cases | `src/server/ai/evaluation.ts`, `npm run eval:engines` |
| M2.4 Biomarker intelligence | Definitions with validated unit conversions, ambiguity refusal, plausibility checks, conflict and missing-data detection, unit-safe history with provenance | `src/server/biomarkers/` |
| M2.5 Organ & systems | 6 systems, many-to-many mappings, measurements, observations, trends, evidence, missing markers, limitations, next steps. No scores. | `src/server/systems/` |
| M2.6 Contextual reasoning | Engine gets goals, symptoms, routine, current and previous values, wearables, systems, the recommendation and retrieved evidence. Output in 6 sections plus sources. | `src/server/ai/service.ts` |
| M2.7 Recommendations | Deterministic ranking (relevance, evidence, safety, feasibility), safety-first professional action, adaptation to skips, 1 primary + ≤3 supporting | `src/server/recommendations/` |
| M2.8 Supplements | Eligible category only, never a dose; simulated reviewer (pending, approved with dose, changed, rejected) | `src/server/supplements/`, `/doctor` |
| M2.9 Events | Per-user relevance with explanations; SAMPLE listings; mock request-to-book with duplicate guard | `src/server/events/`, `/app/discover` |
| M2.10 Timeline | Unified timeline across all sources; report-to-report changes; goal and routine change log (atomic); plan adaptation | `src/server/timeline/`, `/app/timeline` |

## M3 — Premium experience (next)

Design system expansion, R3F orb (5 states, lazy, reduced motion, CSS fallback), Home conversation, Insights biomarker cards with trend charts, 3D organ overview, Plan and Discover polish, Timeline and Profile editing (routine, value correction), role-restricted doctor workspace, editorial landing page, and final testing.

## Cross-cutting items before any real user data or public deploy

- **Supabase Auth**: replace `getCurrentProfileId()` and `getSimulatedReviewer()`.
- Rate limiting on AI and upload routes.
- OCR provider decision (see CONTEXT.md).
- Large Apple Health exports (>50 MB, `export.zip`).
- Live verification of Gemini and LingSante (needs keys); re-run `npm run eval:engines`.
