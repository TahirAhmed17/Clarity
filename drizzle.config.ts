import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });

/**
 * Migrations are written straight into supabase/migrations with Supabase-style
 * timestamp names, so the Supabase GitHub integration (and `supabase db push`)
 * apply exactly the same SQL that tests run against PGlite.
 */
export default defineConfig({
  schema: "./src/server/db/schema.ts",
  out: "./supabase/migrations",
  dialect: "postgresql",
  migrations: { prefix: "supabase" },
  dbCredentials: { url: process.env.DATABASE_URL ?? "postgres://localhost:5432/clarity" },
  strict: true,
});
