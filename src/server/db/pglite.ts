import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { ClarityDb } from "../data/drizzle-repository";
import * as schema from "./schema";

export const MIGRATIONS_FOLDER = "./supabase/migrations";

/**
 * Minimal stand-in for Supabase's `auth` schema so the RLS migration runs unchanged.
 * Mirrors how Supabase derives auth.uid(): from the `request.jwt.claim.sub` setting.
 */
const SUPABASE_AUTH_STUB = `
  create schema if not exists auth;
  create or replace function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then
      create role authenticated nologin;
    end if;
  end $$;
  -- Supabase puts extensions (pgvector) in the "extensions" schema, which is on the search_path.
  create schema if not exists extensions;
  set search_path to public, extensions;
`;

/**
 * In-process Postgres (PGlite) with the real Supabase migrations applied.
 * Used by tests and `npm run db:verify`. Not used by the running app.
 */
export async function createMigratedPglite() {
  const client = new PGlite({ extensions: { vector } });
  await client.exec(SUPABASE_AUTH_STUB);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  await client.exec(`grant usage on schema public, auth, extensions to authenticated;
    grant select, insert, update, delete on all tables in schema public to authenticated;`);
  return { client, db: db as unknown as ClarityDb };
}
