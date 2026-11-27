import { sql } from "drizzle-orm";
import journal from "../../../supabase/migrations/meta/_journal.json";
import type { ClarityDb } from "../data/drizzle-repository";

/** Migration versions the code expects (from the committed migration journal). */
export const EXPECTED_MIGRATIONS = (journal as { entries: { tag: string }[] }).entries.map((e) => e.tag.split("_")[0]);

/**
 * Compares expected migrations with those recorded by the Supabase CLI / GitHub integration.
 * Returns the missing versions, or null when the tracking table isn't there (e.g. a database
 * migrated another way) so the check never blocks startup.
 */
export async function missingMigrations(db: ClarityDb): Promise<string[] | null> {
  try {
    const res = await db.execute(sql`select version from supabase_migrations.schema_migrations`);
    const rows = (Array.isArray(res) ? res : (res as unknown as { rows: { version: string }[] }).rows) as { version: string }[];
    const applied = new Set(rows.map((r) => String(r.version)));
    return EXPECTED_MIGRATIONS.filter((v) => !applied.has(v));
  } catch {
    return null;
  }
}
