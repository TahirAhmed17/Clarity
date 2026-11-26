# Testing

## How to run

```bash
npm run check        # tsc --noEmit + eslint + vitest
npm run db:verify    # migrations + seed on in-process Postgres (PGlite)
npm run build        # production build
```

Tests live in `tests/`. Database tests use **PGlite**, a real Postgres build running in-process. The same `supabase/migrations/` files that Supabase gets are applied there, so no credentials are needed.

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
