# Data model

Source of truth: `src/server/db/schema.ts`. Migrations: `supabase/migrations/*_init.sql` (generated) and `*_rls_policies.sql` (hand-written).

## Principles

1. **Profile isolation**: every user-owned row has `profile_id` (FK, `on delete cascade`). RLS policies restrict rows to `auth.uid()`, and the repository layer also scopes every query by profile.
2. **Original values preserved**: `biomarkers.value_text`, `unit_as_reported`, `ref_text` and `flag_as_reported` store exactly what the lab printed. Parsed numbers (`value_numeric`, `ref_low`, `ref_high`) sit alongside them and are `null` when they can't be parsed without guessing.
3. **Explicit provenance**: `record_source` = `extracted | user_provided | calculated | synthetic_seed`. Documents link results back to their source file (`document_id`, `page_number`, `confidence`).
4. **Synthetic labelling**: `is_synthetic` (profiles, documents) and `is_sample` (catalogue, events).
5. **Missing ≠ normal**: no defaults that imply normality. A missing range yields `rangeStatus = no_range`.

## Tables (M1)

| Table | Purpose | Notes |
| --- | --- | --- |
| `profiles` | User profile, goals, routine, preferences, role (`member`/`reviewer`) | `auth_user_id` links to Supabase Auth |
| `documents` | Uploaded files (metadata only, never raw content) | unique `(profile_id, sha256)` gives duplicate detection |
| `biomarkers` | Lab results | index `(profile_id, code, observed_on)` for trends |
| `wearable_metrics` | Daily aggregates | unique `(profile_id, metric_type, day, aggregation, source_format)` enables upserts |
| `symptom_entries` | User-reported symptoms | severity 1–5 optional |
| `supplement_catalogue` | Curated SAMPLE catalogue | **no dose column**; `source_url` null until M2 attaches real sources |
| `supplement_suggestions` | AI-suggested category → reviewer decision | `reviewer_dose` is the only dose field and is set by a reviewer only. `is_simulated_review` defaults true. |
| `events` | SAMPLE wellness events | `how_it_may_help` and `expected_outcome` are required |
| `event_requests` | Mock "request to book" | `is_mock` defaults true |
| `action_plans` | Daily plan: one primary + supporting actions (JSONB with per-action status) | `generated_by` records the engine |
| `messages` | Conversation turns | `structured` stores the validated CompanionResponse |

Enums: `profile_role`, `document_kind`, `document_status`, `record_source`, `suggestion_status`, `event_request_status`, `message_role`, `plan_status`.

## Planned extensions (added only when the milestone needs them)

| Milestone | Tables |
| --- | --- |
| M2.1–2.2 | `evidence_sources`, `evidence_chunks` (+ embeddings; pgvector or Qdrant per benchmark) |
| M2.4 | `biomarker_definitions` (canonical units, conversions) |
| M2.5 | `organ_systems`, `biomarker_organ_mappings` (many-to-many) |
| M2.6–2.7 | `analysis_sessions`, `recommendation_evidence` |
| M2.10 | `health_timeline_events`, `action_history` (replaces per-action status in JSONB) |

## Seed

`npm run db:seed` (or the in-memory fallback) loads: 1 synthetic member + 1 simulated reviewer, 1 historical report (9 results, 2026-04-08), 14 days × 5 wearable metrics, 2 symptoms, 5 catalogue items, 4 events. It is idempotent: fixed IDs + `on conflict do nothing`. The newer report (21 results, 2026-10-14) is **not** seeded. It is uploaded during the demo from `samples/synthetic-blood-report.pdf`.
