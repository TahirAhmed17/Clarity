/** Applies Drizzle migrations to DATABASE_URL (Supabase Postgres). Usage: npm run db:migrate */
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

config({ path: ".env.local" });

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
    process.exit(1);
  }
  const client = postgres(url, { prepare: false, max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(client), { migrationsFolder: "./supabase/migrations" });
    console.log("Migrations applied.");
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error("Migration failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
