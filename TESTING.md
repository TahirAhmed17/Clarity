# Testing

## How to run

```bash
npm run check        # tsc --noEmit + eslint + vitest
npm run db:verify    # migrations + seed on in-process Postgres (PGlite)
npm run build        # production build
```

Tests live in `tests/`. Database tests use **PGlite**, a real Postgres build running in-process. The same `supabase/migrations/` files that Supabase gets are applied there, so no credentials are needed.

Additional M2 commands:

```bash
npx supabase db start   # local Supabase Postgres 17 (ports 553xx), applies supabase/migrations
npm run db:migrate      # supabase db push to DATABASE_URL
npm run db:seed
npm run bench:retrieval # needs local Supabase + Qdrant on :6333
npm run eval:engines    # engine evaluation; engines without keys are reported as skipped
```

## Recorded results — demo readiness (2026-11-27)

| Check | Result |
| --- | --- |
| `tsc`, `eslint` | ✅ clean |
| `vitest run` | ✅ **78 / 78** (adds 4 demo tests: seed reset restores state and allows re-upload; database reset refused by default; database reset with `DEMO_RESET_ALLOWED=true` wipes and re-seeds on PGlite; warm-up saves no messages) |
| `npm run demo` | ✅ healthy in seed mode; warm-up 771 ms cold (embedding model 720 ms), 18 ms warm; 8 pages pre-rendered in 48–248 ms; access code never printed |
| Reset over HTTP (seed) | ✅ duplicate upload → 409; reset without `confirm` → 400; reset → 200; same upload afterwards → 201 |
| Reset in the browser | ✅ Profile → Reset demo → confirm → "Demo reset to its starting synthetic state."; records back to the seeded history only |

## Recorded results — motion pass (2026-11-27)

| Check | Result |
| --- | --- |
| `tsc`, `eslint` | ✅ clean |
| `vitest run` | ✅ **74 / 74** (adds report-summary tests) |
| `next build` | ✅ |
| Landing intro (1280 px, visible pane) | ✅ `line-up` / `fade-up` / `orb-in` attached; settle to identity transform, opacity 1, no blur within 5 s. In a *hidden* pane Chromium pauses CSS animations; fast-forwarding them confirmed the same end state, so nothing can stay hidden |
| Hero orb scroll | ✅ at 500 px scroll: scale 0.73, drifted, opacity ≈0.48 |
| Hand-off orb | ✅ fades in on approach (≈0.57 → 1); state listening → thinking → answering with the active step; scrolling back up returns to listening |
| Results reveal (synthetic PDF via the companion upload input) | ✅ "Report read: 21 results, 5 outside your lab's range"; counts 21 / 15 / 5; 5 flagged rows; 5 markers mid-glide at 2 s; overview answer follows |
| Reduced motion | ✅ marker glide duration ≈0 and delay 0 |
| 390 px | ✅ reveal stacks, no horizontal overflow |

## Recorded results — M3 (2026-11-27, Windows 11, Node 22.17)

| Check | Result |
| --- | --- |
| `tsc --noEmit`, `eslint` | ✅ 0 errors, 0 warnings |
| `vitest run` | ✅ **71 / 71 passed**, 5 files; 5 consecutive clean runs on the final code |
| `next build` | ✅ (includes `ƒ Proxy`) |
| Browser checks | Production build, **seed mode (synthetic data only)**, see below |

### The intermittent DB test: root cause (not a timeout)

- Earlier a single Drizzle/PGlite test failed once in about five runs. I first raised its timeout to 90 s, which was **wrong**: under deliberate load the failures still happened, within 1–2 s, with `RangeError: Array buffer allocation failed` / `PGlite failed to initialize properly`.
- **Cause:** the repository contract tests created a fresh in-process Postgres (a large WASM memory reservation) for every test and never closed them.
- **Fix:** one shared instance per file, reset between tests (`resetDatabase`: truncate and reseed). The 90 s timeout was reverted.
- **After the fix:** 8/8 normal runs pass, and **6/6 pass with two suites running in parallel**.
- **Still possible:** with three full suites in parallel and only ~4 GB RAM free (Docker running two Supabase stacks), PGlite can still fail to allocate. That's an environment limit; CI runs one suite.

### New tests (M3)

- **Reviewer sessions:** sign/verify; tampered payload or signature; wrong secret; expired; non-reviewer role; garbage. A strong `SESSION_SECRET` is required in production. The access code is disabled unless configured and compared exactly. The rate limit is 5 attempts per minute.
- **Proxy:** pages redirect to `/doctor/sign-in?next=…`; `/api/doctor/*` returns 401; a valid cookie passes and a tampered cookie is redirected.
- **Real-world report layouts (synthetic values):** thousands separators (`7,450`), unit and range in one run, labelled ranges (`< 130 Optimal`), urine microscopy not mapped to blood codes, month-name dates, decimal commas.
- **Unit conversions:** `cells/cmm`, `lakhs/cmm`, `μIU/mL`, `mm after 1hr`; number parsing (`11,860` = 11860, `5,2` = 5.2, `1234,567` treated as ambiguous).

### Bug found by a real (user-uploaded) report, fixed with synthetic fixtures

`11,860` was stored as **11.86**: the comma was read as a decimal point, so the value was 1000× too small. Fixed and regression-tested. No real values were copied into code or tests. Any report uploaded before this fix should be deleted and uploaded again.

### Browser verification (production build, `DATA_MODE=seed`, synthetic data)

| Page / flow | 390 px | Desktop | Observed |
| --- | --- | --- | --- |
| Landing | ✅ no overflow; steps static (no pin) | ✅ pin + step sequence (opacity 1 / 0.25 / 0.25 → progresses) | WebGL orb hero |
| Home | ✅ | ✅ | WebGL orb after hydration; thread restored; colour-managed shader |
| Insights | ✅ | ✅ | Cards, range rails, sparklines, wearable charts |
| Body map | ✅ 2D first, then 3D once three.js loads | ✅ 3D figure | Selecting Kidneys updates the panel; evidence links |
| Plan | ✅ no overflow | — | Next move on coral-tinted tide panel; "Mark done" → Done + Recent activity |
| Profile | ✅ no overflow | — | Routine saved; synthetic Apple Health file deleted via two-step confirm; 3D switch persisted |
| 3D off | ✅ | — | Body map falls back to the 2D SVG |
| Reduce motion | ✅ | — | Orb uses the CSS version; animation duration ≈ 0 |
| Doctor | ✅ | — | No session → `/doctor/sign-in?next=/doctor`. Over HTTP: wrong code 401, right code 200 + HttpOnly cookie, workspace "Signed in as Dr. Demo Reviewer (simulated)", review accepted, sign-out → redirect, 6th rapid attempt → 429 |

Note: the browser pane was hidden during testing, so hydration and lazy chunks were throttled (5–20 s). Timings here are not representative of a visible tab.

### Not tested yet (M3)

- Real mobile hardware (only the 390 px emulation was used); GPU-less devices beyond the 3D-off switch.
- Screen-reader pass (planned for M5).
- Migrations from this branch on the hosted Supabase project (applied only when merged).

## Recorded results — M2 (2026-11-27, Windows 11, Node 22.17)

| Check | Result |
| --- | --- |
| `tsc --noEmit`, `eslint` | ✅ 0 errors, 0 warnings |
| `vitest run` | ✅ **62 / 62 passed**, 4 files |
| `next build` | ✅ |
| Migrations on **real Supabase Postgres 17** (`supabase db start`) | ✅ all 8 migrations applied from scratch (`supabase db reset`), including pgvector in the `extensions` schema and every RLS migration |
| RLS on real Supabase (`authenticated` role with JWT claims) | ✅ the owner sees only their 9 results and 1 profile; `anon` sees 0 health rows but can read the shared events |
| Retrieval benchmark | ✅ see [docs/RETRIEVAL_BENCHMARK.md](docs/RETRIEVAL_BENCHMARK.md) |
| Engine evaluation | Mock: 4/4 cases OK (correct flag, no dose in output, 0 unsupplied citations, next move matches). **Gemini and LingSante: skipped, no API keys.** |

### New tests (M2)

- **Evidence integrity**: every note cites a recorded https source with a date or date note; blocked sources are never cited; embeddings are in sync with the catalogue text; no doses in notes.
- **Retrieval**: lexical retrieval plus filters; real MiniLM semantic retrieval on a paraphrased question; pgvector vector, full-text and filtered hybrid on Postgres.
- **Biomarker intelligence**: SI/conventional conversions (creatinine, glucose, HbA1c affine formula, vitamin D, µg→ug); refuses ambiguous (urea mg/dL) and unknown units; implausible values, same-day conflicts, qualified values, missing ranges; cross-unit history with provenance; refuses unsafe comparisons.
- **Organ systems**: partial or complete or no-data states, missing markers, next steps, evidence, no scores or diagnostic language; "Not enough data" rather than normal.
- **Recommendations**: consolidated professional action first when flagged; safety-first even when lifestyle actions score higher, until marked done; uses goals and wearables; fallback; adaptation after two skips.
- **AI turn**: citations are a subset of the supplied sources; deterministic next move; at most 3 supporting actions.
- **Safety regression**: lab concentrations (`13 ug/L`, `124 g/L`, `38 U/L`) survive; doses (`65 mg a day`, `200 mg/day`) are removed.
- **Supplements**: eligible categories only, once, no dose; approval requires a dose (zod); reject clears the dose; reviewer queue.
- **Events**: personal ranking with explanation; mock booking.
- **Plans and timeline**: supersede, complete or skip, history, adaptation, every timeline kind; Drizzle M2 operations on Postgres; **atomic profile + timeline update** (forced failure rolls back).

### End-to-end synthetic journey: database mode against local Supabase (dev server)

| Step | Observed |
| --- | --- |
| `/api/health` | `mode: database`, "Connected to Postgres" |
| Upload synthetic PDF and Apple Health XML | 21 results (2026-10-14); 56 daily wearable values |
| Ask "Why am I tired in the afternoons?" | Next move "Book a GP appointment to go through your flagged results" (safety first, 5 flagged); 3 supporting actions in distinct categories; 3 citations, all from the 8 supplied sources; question-specific sleep chunks retrieved through pgvector; 0 safety interventions |
| Generate plan → complete primary, skip one supporting | Statuses saved; invalid body → 400; the next plan's primary moves to "Swap one lunch… fibre-rich option" |
| Supplements | 3 pending categories (vitamin D, iron, soluble fibre), no doses; approve without dose → 400; approve with dose → `approved`, `simulated: true` |
| Event request, then a duplicate | 201 mock request, then 409 |
| Goal removed then re-added | Both logged in `health_timeline_events` |
| Screens at 390 px | Body, Plan, Discover, Doctor, Timeline and Insights render database data; no horizontal scroll on Body |

### Bugs found and fixed during M2 testing

1. **Safety filter redacted lab values.** "13 ug/L" was treated as a dose. Found by the engine evaluation; fixed, with a regression test.
2. **Professional review outranked.** A tiredness question let a lifestyle action outrank the flagged-results action. Now safety-first, with a test.
3. **Question-specific evidence crowded out** by recommendation evidence. Fixed with a slot budget.
4. **Non-atomic goal update.** A goal could change without its timeline note being written. Now transactional, with a test.
5. **Stale instances on dev hot reload.** Cached repositories and retrievers kept old methods. Only state is cached now.
6. **Advisor finding on production (M1)**: RLS helper functions were callable over RPC. Hardened in a new migration and verified on Supabase PG17 (see SECURITY.md).

### Not tested yet (M2)

- Live Gemini and LingSante calls (no keys).
- Migrations on the hosted Supabase project (only runs once PR #1 merges into `main`; preview branches are disabled).
- Retrieval quality on a larger, independently labelled query set.

## Recorded results — M1 checkpoint (2026-11-27, Windows 11, Node 22.17)

All results below were produced in this environment. Nothing is estimated.

| Check | Result |
| --- | --- |
| `tsc --noEmit` | ✅ 0 errors |
| `eslint` | ✅ 0 errors, 0 warnings |
| `vitest run` | ✅ **39 / 39 passed**, 3 files |
| `npm run db:verify` | ✅ migrations applied. Seed run 1 inserted 2 profiles, 1 document, 9 biomarkers, 70 wearable rows, 2 symptoms, 5 catalogue items, 4 events. Seed run 2 inserted 0 rows (idempotent). |
| `next build` | ✅ compiled; `/app/*` pages partially prerendered, `/api/*` dynamic |

### Unit / integration coverage (39 tests)

- **Upload validation (4)**: real PDF accepted; text renamed `.pdf` rejected by magic bytes; wrong extension, empty and oversized files rejected (413); filename path and control characters stripped.
- **PDF extraction (6)**: all 21 lines of the synthetic report extracted with exact value, unit, range and flag; `>90` kept as qualified (numeric null); ambiguous `03/04/2026` date not guessed; flag/range disagreement warned; unknown test kept with `code=null`; space-separated rows; scanned PDF gives `pdf_no_text_layer`; truncated PDF rejected; duplicate upload gives 409.
- **Apple Health (4)**: daily aggregation; iPhone + Watch dedup (5,500 steps, not ~10,450); sleep sums asleep stages only (375 min, Awake/InBed excluded); HR avg/min/max; kJ→kcal; unsupported unit skipped; malformed XML and wrong root rejected; re-upload upserts.
- **Environment (2)**: offline-safe defaults; secret values never appear in validation errors.
- **Context (2)**: no names or IDs sent to engines; overlapping seed and import data produces one value per day (regression test for a bug found during manual testing).
- **Mock engine (2)**, **safety validator (1)**: doses, diagnosis sentences and unsupplied citations removed; flag never lowered; disclaimer present.
- **AI service (3)**: mock mode makes **zero `fetch` calls**; Gemini without a key falls back with a visible notice; invalid engine output falls back, and errors when fallback is disabled.
- **Adapters (3)**: honest unavailability; LingSante request shape verified against a stubbed HTTP response; JSON extraction.
- **Data (10)**: migrations and seed on Postgres; synthetic/SAMPLE labelling; repository contract run against **both** Seed and Drizzle (PGlite) implementations (profile isolation, original-value round trip, wearable upsert, deletion pathway); unreachable DB falls back to seed; logger drops sensitive fields.

### Manual end-to-end (dev server, seed mode, mock AI)

| Scenario | Observed |
| --- | --- |
| `GET /api/health` | `mode: seed` with reason "DATABASE_URL not set"; Gemini/LingSante reported unavailable with reasons; mock selected |
| Upload synthetic report | 201; 21 results; collected 2026-10-14; flagged FERRITIN↓ ALT↑ CHOL_TOTAL↑ LDL↑ VITD25OH↓ |
| Upload same report again | 409 duplicate |
| Scanned PDF / fake PDF / no file | 422 `pdf_no_text_layer` / 415 `content_mismatch` / 400 `missing_file` |
| Upload Apple Health XML / malformed XML | 201 / 422 `xml_malformed` |
| `POST /api/ai/respond` | mock engine, next move "Book a GP chat about your low ferritin", professional flag with 5 deterministic reasons, disclaimer present |
| Invalid JSON body to AI route | 400 with a helpful message |
| `/app/insights` after uploads | Shows uploaded results with "was X on 2026-04-08" trends, provenance tags and 7-day wearable averages, which confirms API routes and pages share one repository |
| Home at **390×844** | Renders; `scrollWidth == clientWidth` (no horizontal scroll); companion flow works |
| Home at 1280×800 | Sidebar layout; concise next-move card with details collapsed |
| Browser console | No errors |

### Bug found and fixed during testing

The 7-day wearable average mixed seed data and imported Apple Health data on overlapping days, giving a wrong steps average. Fixed in `ai/context.ts` (one value per metric per day; an import outranks the seed) and covered by a regression test.

## Not tested yet (honest gaps)

- **Real Supabase**: no `DATABASE_URL` available. Migrations and RLS were verified on PGlite (Postgres 17) with a stub `auth.uid()` that mirrors Supabase's implementation, not on a hosted Supabase project.
- **Live Gemini and LingSante calls**: no keys. The adapters are covered only by offline and stubbed tests.
- **Real lab PDFs and real Apple Health exports**: only synthetic files have been tested. Large exports (>50 MB) are not supported yet.
- Reduced-motion, WebGL fallback and a formal accessibility audit are scheduled for M3.10.
