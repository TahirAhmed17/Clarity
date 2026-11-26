/** Seeds the SYNTHETIC demo dataset into DATABASE_URL. Idempotent. Usage: npm run db:seed */
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { ClarityDb } from "../src/server/data/drizzle-repository";
import * as schema from "../src/server/db/schema";
import { seedDatabase, tableCounts } from "../src/server/db/seed";

config({ path: ".env.local" });

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set. The app will use the bundled seed-data fallback instead.");
    process.exit(1);
  }
  const client = postgres(url, { prepare: false, max: 1, onnotice: () => {} });
  try {
    const db = drizzle(client, { schema }) as unknown as ClarityDb;
    const inserted = await seedDatabase(db);
    console.log("Inserted (new rows):", inserted);
    console.log("Table counts:", await tableCounts(db));
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error("Seed failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
