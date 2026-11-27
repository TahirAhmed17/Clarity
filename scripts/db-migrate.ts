/**
 * Applies supabase/migrations to DATABASE_URL using the Supabase CLI, so migration history is
 * tracked in supabase_migrations.schema_migrations — the same table the Supabase GitHub
 * integration uses. (Drizzle's own migrator is only used for the in-process PGlite test DB.)
 * Usage: npm run db:migrate
 */
import { spawnSync } from "node:child_process";
import { config } from "dotenv";

config({ path: ".env.local" });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
  process.exit(1);
}

const res = spawnSync("npx", ["supabase", "db", "push", `--remote=${url}`, "--include-all"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});
process.exit(res.status ?? 1);
