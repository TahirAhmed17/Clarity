# Architecture

## Folder structure

```
src/
  app/                         Next.js App Router
    page.tsx                   "/" landing (interim; full editorial page in M3.9)
    app/                       "/app" product shell (layout + Home, Insights, Body, Plan, Discover, Timeline, Profile, Upload)
    doctor/                    "/doctor" simulated reviewer workspace (M2.8/M3.8)
    api/                       Route handlers — thin: parse → call service → map errors
      health/                  GET system status (no secrets)
      ingest/report/           POST blood report PDF
      ingest/apple-health/     POST Apple Health export.xml
      ai/respond/              POST companion turn
      profile/data/            GET export · DELETE (requires confirm)
  components/
    ui/primitives.tsx          Design-system primitives (Button, Card, Badge, RangeBadge, ProvenanceTag, Disclaimer, Orb…)
    shell/                     Navigation + status chip
    features/                  Companion, upload forms, delete-data
  lib/                         Isomorphic: domain types, constants (disclaimer, provenance), cn()
  data/synthetic/dataset.ts    SINGLE source of truth for all synthetic demo data
  server/                      Server-only modules
    config/env.ts              zod-validated env; secrets never logged
    db/                        Drizzle schema, postgres-js client, seed, PGlite helper
    data/                      HealthRepository interface, Drizzle + Seed implementations, resolver w/ fallback
    ingestion/                 validation, pdf/, apple-health/, wearables/ (CSV registry), ocr boundary, service
    biomarkers/                aliases (name → code), range comparison + reference parsing
    ai/                        schemas, AIEngine interface, engines/{mock,gemini,lingsante}, prompt, context, safety, service
    session.ts                 current profile + request-time data loading for Server Components
    http.ts / log.ts           safe JSON errors, allow-listed logger
supabase/
  migrations/                  Drizzle-generated SQL (timestamped) + RLS migration — applied by the Supabase GitHub integration
  config.jsonc                 Supabase CLI config
samples/                       Generated synthetic files + invalid fixtures
scripts/                       migrate, seed, verify (PGlite), generate samples
tests/                         Vitest
```

## Service boundaries

```
UI (Server Components / client components)
   │  fetch /api/*            │ loadPageData()
   ▼                          ▼
Route handlers ──────────► Services ──────────► HealthRepository ──► Postgres (Supabase)
 (validation of HTTP        ingestion/service      (interface)        └─ fallback: SeedRepository (in-memory)
  shape, error mapping)     ai/service
                              │
                              ├─► AIEngine (Gemini | LingSante | Mock) — identical input/output schema
                              └─► Safety validator (engine-independent, deterministic)
```

Rules:
- Route handlers contain no business logic.
- Services never import Next.js APIs. That keeps them unit-testable.
- Every user-scoped repository method takes `profileId`, which provides isolation in code as well as RLS in the DB.
- Retrieval (M2) goes behind a `Retriever` interface so the pgvector/Qdrant choice stays swappable.

## Data ingestion workflow

**Blood report PDF**
1. `readUploadedFile`: rejects bodies over the limit via Content-Length, then reads the multipart `file`.
2. `validateUpload`: checks extension, declared MIME (hint only), size, **magic bytes** (`%PDF-`) and SHA-256. Filenames are sanitised.
3. Duplicate check by hash, per profile (HTTP 409).
4. `extractPdfLines` (unpdf/pdf.js): uses text-layer items with coordinates. Lines are rebuilt by y-position and large x-gaps become column breaks.
5. Text below 40 characters is treated as a scan. With no OCR provider available this returns `pdf_no_text_layer` (clear message).
6. `parseLabReport`: deterministic. Keeps name, value text, unit, reference text and flag exactly as printed. It parses numeric value and range where unambiguous, maps the name to a canonical code when known (otherwise `null`), extracts an ISO collection date (ambiguous dates are not guessed), and emits warnings: missing range or unit, duplicates, flag vs range disagreement.
7. Persists the document plus biomarkers (`source = extracted`, confidence, page number), and returns them with the computed `rangeStatus`.

**Apple Health export.xml**
1. Same validation (XML sniffing) and a separate size limit.
2. `parseAppleHealthXml`: a strict sax stream parser with no DOM and no external entities. It checks the root is `HealthData`. It whitelists steps, active energy (kJ→kcal), resting HR, HR (avg/min/max), HRV SDNN and sleep (asleep stages only; InBed/Awake excluded). Days come from the device's local date. Unsupported types and units are counted, not failed.
3. Per-day aggregation per source, then multi-device dedup (highest daily total for sums).
4. Upsert of daily aggregates, so re-uploading or overlapping exports is safe.

**Wearable CSV**: the adapter registry exists but is intentionally empty until a vendor format is verified.

## AI flow

`respond(profileId, question)`:
1. Loads profile, biomarkers, wearables and symptoms. `buildHealthContext` keeps the latest value plus the previous value in the same unit, the 7-day averages (one source per day), and explicit `missing` items. No names or IDs are sent.
2. Validates the request with zod.
3. Runs the selected engine with a timeout. If it is unavailable or fails and `AI_FALLBACK_TO_MOCK=true`, the mock engine answers and the response carries a visible `engineNotice`.
4. `applySafety`: removes doses and diagnostic sentences, drops evidence IDs that weren't supplied, raises the professional flag deterministically from out-of-range results or severe symptoms (it never lowers it), and adds limitations for missing data and missing evidence. It also attaches the mandatory disclaimer.
5. Persists the user and assistant messages.

Output sections map to the brief: noticed → whyItMatters → nextMove (exactly one) → supportingActions (≤3) → evidence → limitations → followUps.

## M2 additions

```
src/data/evidence/            catalogue.ts (verified sources + paraphrased notes), embeddings.json (pre-computed)
src/server/evidence/          embedder (MiniLM, lazy), lexical (BM25 + RRF), Retriever interface,
                              memory / pgvector / qdrant retrievers, refs (display), index (production choice)
src/server/biomarkers/        definitions (units, conversions, plausibility, system mappings), intelligence (validation, history)
src/server/systems/           organ-systems (6 systems, deterministic insights)
src/server/recommendations/   engine (ranking, safety-first, adaptation), service (plans, outcomes)
src/server/supplements/       eligibility rules + review schema
src/server/events/            relevance ranking with explanations
src/server/timeline/          unified timeline + longitudinal changes
src/server/insights/          snapshot (one load of profile/biomarkers/wearables/symptoms/history)
src/server/ai/evaluation.ts   engine evaluation on identical synthetic cases
```

### Companion turn (M2)

```
snapshot ─► recommend() ─────────────────────────────┐ (authoritative next move + reasons + evidence ids)
        ├─► buildSystemInsights() ─► system summaries │
        └─► retriever.search(question) ─► evidence ◄──┘ (slot budget: 3 next-move, 3 retrieved, rest supporting)
                         │
                  context ─► engine (Gemini | LingSante | Mock) ─► applySafety() ─► override nextMove/supporting
                                                                                 └► response + sources
```

The engine explains; it does not choose. Deterministic layers (validation, ranges, systems, recommendations, safety) are unit-tested independently of any model.

### API routes added

| Route | Purpose |
| --- | --- |
| `GET/POST /api/plan` | Active plan / generate a new one |
| `POST /api/plan/actions` | Mark an action completed or skipped (logged to `action_history`) |
| `GET/POST /api/supplements` | Suggestions / run eligibility |
| `POST /api/doctor/suggestions/[id]` | Simulated review (role-checked) |
| `POST /api/events/[id]/request` | Mock booking request (duplicate → 409) |
| `PATCH /api/profile` | Goals and routine; changes logged atomically to the timeline |

## M3 additions

```
src/proxy.ts                     optimistic gate for /doctor and /api/doctor/* (Next 16 proxy)
src/server/auth/reviewer-session signed reviewer session (Web Crypto HMAC), access code, rate limit
src/components/orb/              Orb (mode switch) + orb-canvas (R3F shader, lazy)
src/components/body/             body-map (3D/2D switch), body-canvas (R3F), body-explorer (selection + detail)
src/components/charts/           range-rail, sparkline, daily-chart (validated chart tokens)
src/components/landing/          how-it-works (the single GSAP moment)
src/lib/preferences.ts           display preferences, reduced motion, WebGL detection (client)
src/server/insights/view-model   server-built, serializable card data (evidence resolved server-side)
src/server/biomarkers/correction user corrections that keep the original reading
```

Rule kept from M2: client components never import server modules (only `import type`), so the evidence corpus and embeddings never ship to the browser. Server pages resolve evidence into display references first.

New routes: `PATCH /api/biomarkers/[id]`, `DELETE /api/documents/[id]`, `GET /api/messages`, `POST|DELETE /api/doctor/session`.
