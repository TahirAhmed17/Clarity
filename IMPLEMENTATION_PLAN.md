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

## M3 — Premium experience ✅ (branch `feat/m3-premium-experience`, depends on M2 / PR #2)

| Phase | Delivered | Where |
| --- | --- | --- |
| M3.1 Design system | Tide panel, flatter cards, sentence-case labels, validated chart tokens; template tells removed | `globals.css`, `components/ui/primitives.tsx`, DESIGN_SYSTEM.md |
| M3.2 Signature orb | R3F shader orb with 5 eased states; lazy three.js; CSS fallback (no WebGL, 3D off, reduced motion) | `components/orb/` |
| M3.3 Home | Conversation thread restored from the DB, inline uploads that trigger an overview, `?q=` deep links, orb state machine | `components/features/companion*.tsx` |
| M3.4 Insights | Biomarker cards: range rail against the lab band, sparkline history, change, evidence, corrections; wearable charts with tooltips and table view | `components/charts/`, `server/insights/view-model.ts` |
| M3.5 Body | Stylised 3D figure with system markers (drag to rotate); 2D SVG fallback; keyboard-friendly system list | `components/body/` |
| M3.6 Plan & Discover | Next move on the tide panel, completion and skips, personal event relevance | `app/app/plan`, `app/app/discover` |
| M3.7 Timeline & profile | Goals and routine editing (logged), per-value correction keeping the original, per-file deletion, display preferences | `app/app/profile`, `/api/biomarkers/[id]`, `/api/documents/[id]` |
| M3.8 Doctor | Signed reviewer session (HMAC cookie), access code, rate limit, `proxy.ts` gate plus server-side re-checks | `server/auth/`, `src/proxy.ts`, `/doctor/sign-in` |
| M3.9 Landing | Editorial hero with the orb; one GSAP scroll moment (desktop only); features, FAQ, sample profile, CTA to `/app` | `app/page.tsx`, `components/landing/` |
| M3.10 Testing | See TESTING.md, M3 section | — |

## M4 — Production readiness (proposed by Claude; the brief defines only M1–M3)

1. **Supabase Auth**: real member sign-in; replace `getCurrentProfileId()`; reviewer role from a profile/claim instead of a shared access code.
2. **Rate limiting** on AI, upload and auth routes (shared store, not in-memory).
3. **OCR** behind the existing `OcrProvider` interface, once the provider is chosen (Gemini or tesseract.js).
4. **Apple Health `export.zip`** with streaming upload for large exports.
5. **Security headers / CSP** and a GitHub Actions CI (typecheck, lint, tests, build).

## M5 — Quality and launch preparation (proposed by Claude)

1. Accessibility audit (axe plus manual keyboard and screen-reader pass) and performance budget (three.js chunk, LCP).
2. End-to-end smoke test (Playwright) of the synthetic journey.
3. Error monitoring hooks (no health payloads), operational runbook.
4. Vercel configuration and env checklist. **No deployment without the product owner's approval.**

## Cross-cutting items before any real user data or public deploy

- **Supabase Auth**: replace `getCurrentProfileId()` (M4.1). The reviewer workspace already requires a signed session (M3.8).
- Rate limiting on AI and upload routes.
- OCR provider decision (see CONTEXT.md).
- Large Apple Health exports (>50 MB, `export.zip`).
- Live verification of Gemini and LingSante (needs keys); re-run `npm run eval:engines`.
