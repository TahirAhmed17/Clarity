-- pgvector for evidence embeddings. Installed in the `extensions` schema, as Supabase recommends.
-- Supabase's roles have `extensions` on their search_path, so the unqualified `vector` type resolves.
create schema if not exists extensions;
--> statement-breakpoint
create extension if not exists vector with schema extensions;
