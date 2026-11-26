# CONTEXT — project brain

Read this first when resuming work. Keep it current.

## What Clarity is

A hybrid AI companion and health intelligence dashboard. You talk to a conversational orb and get structured results. Core philosophy: do the complexity behind the scenes and show the user **one clear next move**, with understandable evidence and room to explore further.

## Where we are (2026-11-27)

- **M1 Foundation: complete. Waiting for approval before M2.**
- Nothing has been deployed. No Supabase project or AI keys are configured in this environment.

## Confirmed decisions (from the brief, do not re-litigate)

Hybrid companion + dashboard · orb + structured results · contextual interpretation with curated evidence retrieval · minimal progressive onboarding · concise overview with expandable detail · 3D organ overview + organ cards (M3) · longitudinal timeline · premium, bright, editorial UI · balanced density · orb is the signature identity · Clarity independent, Tafasa configurable.

## Decisions made during M1

| Decision | Why |
| --- | --- |
| Next.js **16.4** (create-next-app default) with Cache Components + Partial Prefetching on | Current default. Data reads must `await connection()` and sit inside `<Suspense>`, otherwise they get prerendered at build time. `loadPageData()` in `src/server/session.ts` does this. |
| Bundled docs at `node_modules/next/dist/docs/` are authoritative | AGENTS.md says Next 16 has breaking changes versus older knowledge |
| Repository pattern (`HealthRepository`) with `DrizzleRepository` + `SeedRepository` | Database failure falls back to seed data. The interface is the only data boundary. |
| Repository shared via `globalThis` | Next can load route handlers and pages as separate module instances. Without this, in-memory uploads would vanish between API and page. |
| **PGlite** (in-process Postgres) for tests and `db:verify` | Runs the real migrations on real Postgres without Supabase credentials |
| `numeric` columns for lab values + `value_text` always stored | Keeps exact decimal precision and qualified values such as `>90` |
| Wearables stored as **daily aggregates**, not raw samples | Volume, privacy, and M2/M3 only need daily values |
| Apple Health multi-device dedup: highest-total source per day for sums | Avoids double counting iPhone + Watch. This is a heuristic and is documented. |
| No wearable CSV adapters registered | The brief says to support only verified formats, and none are verified yet |
| OCR: detection + `OcrProvider` interface only | Scanned PDFs return a clear error. Provider choice needs your input (privacy trade-off). |
| AI output = one zod schema for all engines. Safety layer runs **outside** engines. | Fair engine comparison. Safety doesn't depend on model behaviour. |
| Mock engine restates data with fixed wording | Offline dev and tests. It explicitly says it is not interpretation. |
| `GEMINI_MODEL` and `LINGSANTE_MODEL_ID` have **no defaults** | Avoids hard-coding model IDs that may not exist |
| No auth in M1; every request is the synthetic demo profile (`getCurrentProfileId`) | Supabase Auth comes before any real data is allowed |
| Fonts: Fraunces (display, editorial) + Manrope (UI) via `next/font` | Editorial but warm. Avoids the generic AI-dashboard look. |

## Open questions for the product owner

1. **OCR provider**: Gemini document understanding (sends files to Google) or offline tesseract.js (heavier, lower quality)?
2. **Supabase project**: provide `DATABASE_URL` so migrations and RLS can be verified against real Supabase.
3. **Gemini model ID** and key; **LingSante OpenRouter slug** (confirm it exists).
4. **Visual references**: the brief mentions "three supplied visual references" for the palettes. They weren't in the workspace, so the tokens use the brief's suggested hex values.
5. **Apple Health `export.zip`**: should upload accept the zip directly, not only `export.xml`?

## Known limitations / tech debt

- Seed fallback is in-memory: writes are lost on server restart (shown in the UI).
- Request body is buffered in memory before parsing (fine up to the 50 MB limit; real exports can exceed 1 GB, which needs streaming upload to storage in a later milestone).
- `drizzle-kit` pulls a dev-only `esbuild` with a moderate advisory (dev server only; not shipped).
- Biomarker parser handles column-based and single-line layouts. Other lab layouts need real (de-identified) samples to validate.
