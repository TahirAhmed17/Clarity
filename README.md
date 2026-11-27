# Clarity

**Know your numbers. Know your next move.**

Clarity is a personal health intelligence companion. It turns blood reports, wearable data, symptoms and goals into understandable insights and one clear next step. Tafasa branding is configurable (`NEXT_PUBLIC_BRAND_ENDORSEMENT`).

> General wellness information, not medical advice. See a healthcare professional for anything flagged.
> All demo data in this repository is **synthetic**. No real person's health data is included.

## Status

- **M1 Foundation** ✅ ([PR #1](https://github.com/TahirAhmed17/Clarity/pull/1))
- **M2 Health intelligence** ✅: curated evidence, pgvector retrieval, biomarker validation, organ systems, recommendations, supplements (simulated review), events, timeline
- **M3 Premium experience** ✅: 3D signature orb, conversational home, biomarker cards and charts, 3D body map, corrections and per-file deletion, restricted reviewer workspace, editorial landing page
- **M4 / M5**: proposed (production readiness, quality and launch prep); see IMPLEMENTATION_PLAN.md

See [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md), [TESTING.md](TESTING.md) (actual results) and [CONTEXT.md](CONTEXT.md).

## Quick start (fully offline)

Requires Node.js ≥ 22.

```bash
npm install
npm run dev            # http://localhost:3000
```

With no environment variables set, Clarity uses the bundled synthetic seed data and the offline mock AI engine. The header shows which data source and AI engine are active.

Demo flow:

1. Open `/app/upload` and upload `samples/synthetic-blood-report.pdf`, then `samples/synthetic-apple-health-export.xml`.
2. Open `/app/insights` to see extracted results compared with the lab's own ranges, plus 7-day wearable averages.
3. On `/app`, ask "Give me an overview of my results".
4. Try the bad files in `samples/invalid/` to see the error handling.
5. Reviewer workspace: set `REVIEWER_ACCESS_CODE` (and `SESSION_SECRET` in production) in `.env.local`, then open `/doctor`. It is simulated and labelled as such.

To test with synthetic data only, even when a database is configured: `DATA_MODE=seed npm run dev`.

## Using Supabase

```bash
cp .env.example .env.local      # set DATABASE_URL
npm run db:migrate              # applies supabase/migrations
npm run db:seed                 # idempotent synthetic seed
```

Migrations (including Row Level Security) live in `supabase/migrations/`, which the Supabase GitHub integration applies; `npm run db:migrate` applies the same files manually. If the database is unreachable and `DATA_MODE=auto`, the app falls back to seed data and says so.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm run check` | typecheck + lint + tests |
| `npm test` | Vitest suite (includes migrations on in-process Postgres via PGlite) |
| `npm run db:verify` | Apply migrations + seed to PGlite and print table counts (no credentials needed) |
| `npm run db:generate` | Generate a migration after editing `src/server/db/schema.ts` |
| `npm run db:migrate` / `db:seed` | Apply migrations / seed to `DATABASE_URL` |
| `npm run evidence:embed` | Re-embed the evidence catalogue after editing it |
| `npm run bench:retrieval` | pgvector vs Qdrant benchmark (local Supabase + Qdrant) |
| `npm run eval:engines` | Evaluate AI engines on identical synthetic cases |
| `npm run samples:generate` | Regenerate the synthetic PDF, Apple Health XML and invalid fixtures |

## Documentation

- [CONTEXT.md](CONTEXT.md) — project brain: decisions, constraints, current state
- [ARCHITECTURE.md](ARCHITECTURE.md) — structure, service boundaries, flows
- [DATA_MODEL.md](DATA_MODEL.md) — schema and rationale
- [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) — tokens and components
- [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) — milestones and checklist
- [TESTING.md](TESTING.md) — how to test and recorded results
- [SECURITY.md](SECURITY.md) — health-data safety and security controls
- [docs/EVIDENCE.md](docs/EVIDENCE.md) — curated evidence sources
- [docs/RETRIEVAL_BENCHMARK.md](docs/RETRIEVAL_BENCHMARK.md) — pgvector vs Qdrant
