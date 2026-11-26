# Security & health-data safety

## Health safety rules (enforced in code)

| Rule | Where |
| --- | --- |
| Never diagnose | System prompt + `ai/safety.ts` replaces diagnostic sentences |
| Never set a supplement dose | Prompt + safety strips dose patterns. The schema has no AI-writable dose field. `reviewer_dose` is set by reviewers only. |
| Never fabricate sources | Safety drops evidence IDs not in the supplied context. The catalogue `source_url` stays null until curated sources exist (M2). |
| Missing data ≠ normal | `rangeStatus = no_range / not_numeric`, neutral UI, `missing[]` in AI context, added limitations |
| Lab range ≠ diagnostic threshold | Comparisons use only the lab-supplied range and are worded "above/below the lab's range" |
| Flag for professional attention | Deterministic flag from out-of-range results or severe symptoms. AI can raise it, never lower it. |
| Mandatory disclaimer | Attached by the safety layer to every AI response; shown on health screens |
| Simulated approvals visible | `is_simulated_review` defaults true; "SIMULATED" badge on `/doctor` |
| Synthetic data only in demo | `is_synthetic` / `is_sample` flags; "Synthetic demo data" badge in the app header |

## Application security

- **Secrets**: only from environment variables (`.env.local`, git-ignored). The env validator reports variable names, never values.
- **Uploads**: extension + size + magic-byte/content sniffing; declared MIME is a hint only. Filenames are sanitised. Duplicates are detected by SHA-256. Raw file bytes are **not stored** in M1, only extracted records and metadata.
- **XML**: strict sax streaming parser, no DTD/external entity resolution, root-element check.
- **PDF**: parsed by pdf.js (via unpdf) from a copied buffer. Unreadable or encrypted files fail closed with a generic message.
- **Logging**: `server/log.ts` emits only allow-listed metadata keys (counts, durations, codes) and never health values, text, filenames or keys.
- **Errors**: API responses use safe codes and messages. Stack traces are never returned.
- **Profile isolation**: RLS policies (`supabase/migrations/*_rls_policies.sql`, tested on Postgres as the `authenticated` role) plus profile-scoped repository methods.
- **Deletion and correction pathway**: `GET /api/profile/data` exports everything. `DELETE /api/profile/data` (requires `{"confirm":"DELETE"}`) removes all health records. Per-value correction comes in M3.7.
- **AI providers**: the context sent excludes names, IDs and filenames. Gemini and OpenRouter calls are made only when explicitly configured.

## Known gaps (tracked)

- **No authentication yet (M1).** Every request acts as the synthetic demo profile. Supabase Auth must be wired in, and `getCurrentProfileId()` replaced, before any real user data is accepted, and before any public deployment.
- The `/doctor` route is not role-restricted yet (M3.8).
- No rate limiting on `/api/ai/respond` or the upload routes (needed before deployment).
- `drizzle-kit` dev dependency carries a moderate `esbuild` dev-server advisory (not part of the runtime bundle).

## M2 additions

- **Evidence**: only verified sources; the AI can cite only chunk IDs supplied in that request (enforced by the safety layer and by tests); blocked sources are recorded and never cited.
- **Dose safety**: the AI never writes `reviewer_dose`; approval requires a reviewer-entered dose (zod). The dose filter distinguishes concentrations from doses (regression-tested).
- **Safety-first recommendations**: flagged results always produce a primary "see a GP" action until the user marks it done.
- **Simulated reviewer**: `/doctor` and `POST /api/doctor/suggestions/[id]` act as a role-checked synthetic reviewer and are labelled SIMULATED everywhere. Real authentication and role restriction come in M3.8 / before deploy.
- **New routes** validate input with zod and return safe errors; the mock booking makes no external calls.
- **RLS** covers every new table and was verified on the real Supabase Postgres image.
