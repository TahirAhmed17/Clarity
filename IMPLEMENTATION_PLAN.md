# Implementation plan

Work proceeds M1 → M2 → M3, stopping for approval at each checkpoint.

## M1 — Foundation ✅ complete, awaiting approval

| Phase | Status | Delivered |
| --- | --- | --- |
| M1.1 Project setup | ✅ | Next 16.4 + TS + Tailwind 4; folder architecture; zod-validated env + `.env.example`; base components; responsive layout foundations |
| M1.2 Database | ✅ | 11 tables in Drizzle, migrations in `supabase/migrations` (incl. RLS, tested on PGlite), idempotent seed, PGlite verification, seed-data fallback with auto-detection |
| M1.3 Demo data | ✅ | Synthetic profile + reviewer, historical report, generated synthetic PDF (21 results), Apple Health XML (7 days, 2 devices), wearable series, symptoms, goals, SAMPLE catalogue and events, invalid fixtures |
| M1.4 Ingestion | ✅ | PDF upload → text-layer line rebuild → deterministic biomarker parser (originals preserved), scanned-PDF detection, Apple Health streaming parser + normalisation + dedup, validation and errors. CSV: registry only (no verified formats). |
| M1.5 AI foundation | ✅ | `AIEngine` interface; Gemini (SDK, JSON schema), LingSante (OpenRouter adapter, experimental), Mock; shared schemas; centralised errors; fallback; engine-independent safety layer |
| M1.6 App shell | ✅ | `/`, `/app` (Home + companion, Insights, Body, Plan, Discover, Timeline, Profile, Upload), `/doctor`; sidebar and bottom nav; status chip |

## M2 — Health intelligence (next, after approval)

1. **M2.1 Curated knowledge**: collect sources from NIH ODS, WHO, MedlinePlus, NICE and NKF. Record URL, publication and review dates, topic, evidence class and limitations. No fabricated sources: every entry is fetched and checked.
2. **M2.2 RAG**: ingestion → cleaning → chunking → embeddings → storage behind a `Retriever` interface. Benchmark **pgvector** vs **Qdrant** on identical documents and queries (relevance, precision/recall, filtering, hybrid search, latency, ops complexity), then record the decision.
3. **M2.3 Hybrid engines**: live-verify Gemini; LingSante via OpenRouter; evaluation mode running both on identical synthetic cases.
4. **M2.4 Biomarker intelligence**: `biomarker_definitions`, validated unit conversions, missing and inconsistent data detection, history and provenance.
5. **M2.5 Organ and system mappings**: liver, kidneys, cardiovascular risk indicators, thyroid, metabolic, blood (many-to-many). No scores, no diagnoses.
6. **M2.6–2.7 Contextual reasoning and recommendations**: evidence in context; one primary next move plus at most 3 supporting actions, ranked by relevance, evidence, safety and feasibility.
7. **M2.8 Supplement workflow**: suggestions plus a simulated doctor review (pending, approved with dose, changed, rejected).
8. **M2.9 Events**: per-user relevance plus a mock request-to-book flow.
9. **M2.10 Timeline**: actions completed and skipped, longitudinal comparison, plan adaptation.

**Checkpoint**: the full synthetic journey from upload to interpretation, evidence, organ insights and actions, with tests.

## M3 — Premium experience

Design system expansion, R3F orb (5 states, lazy, reduced-motion, CSS fallback), Home and conversation, Insights and biomarker cards with trends, 3D organ overview, Plan and Discover, Timeline and Profile (editing and correction), role-restricted doctor workspace, editorial landing page, and final testing (390px, desktop, DB failure, missing keys, invalid uploads, reduced motion, WebGL fallback).

## Cross-cutting items to schedule

- Supabase Auth + replace `getCurrentProfileId()` (**before** any real data or public deploy).
- Rate limiting on AI and upload routes.
- Decide on an OCR provider (see CONTEXT.md open questions).
- Streaming or large-file upload path for Apple Health exports over 50 MB; accept `export.zip`.
