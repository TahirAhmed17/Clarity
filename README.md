# Clarity

**Know your numbers. Know your next move.**

Clarity is a personal health intelligence companion. It turns blood reports, wearable data, symptoms and goals into understandable insights and one clear next step. Tafasa branding is configurable (`NEXT_PUBLIC_BRAND_ENDORSEMENT`).

> General wellness information, not medical advice. See a healthcare professional for anything flagged.
> All demo data in this repository is **synthetic**. No real person's health data is included.

## Status

**Milestone M1 (Foundation) is complete and waiting for review.** See [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for what's done and what's next, and [TESTING.md](TESTING.md) for actual test results.

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
| `npm run samples:generate` | Regenerate the synthetic PDF, Apple Health XML and invalid fixtures |

## Documentation

- [CONTEXT.md](CONTEXT.md) — project brain: decisions, constraints, current state
- [ARCHITECTURE.md](ARCHITECTURE.md) — structure, service boundaries, flows
- [DATA_MODEL.md](DATA_MODEL.md) — schema and rationale
- [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) — tokens and components
- [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) — milestones and checklist
- [TESTING.md](TESTING.md) — how to test and recorded results
- [SECURITY.md](SECURITY.md) — health-data safety and security controls
