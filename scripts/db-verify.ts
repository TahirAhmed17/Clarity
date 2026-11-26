/**
 * Verifies migrations + seed on an in-process Postgres (PGlite). No credentials needed.
 * Usage: npm run db:verify
 */
import { DEMO_PROFILE_ID } from "../src/data/synthetic/dataset";
import { DrizzleRepository } from "../src/server/data/drizzle-repository";
import { createMigratedPglite } from "../src/server/db/pglite";
import { seedDatabase, tableCounts } from "../src/server/db/seed";

async function main() {
  const started = Date.now();
  const { client, db } = await createMigratedPglite();
  console.log("Migrations applied to PGlite.");
  console.log("Seed run 1 inserted:", await seedDatabase(db));
  console.log("Seed run 2 inserted (idempotency):", await seedDatabase(db));
  console.log("Table counts:", await tableCounts(db));
  const repo = new DrizzleRepository(db);
  const profile = await repo.getProfile(DEMO_PROFILE_ID);
  console.log("Demo profile:", profile?.displayName, "| synthetic:", profile?.isSynthetic);
  console.log("Biomarkers for demo profile:", (await repo.listBiomarkers(DEMO_PROFILE_ID)).length);
  await client.close();
  console.log(`Done in ${Date.now() - started}ms`);
}

main().catch((e) => {
  console.error("Verify failed:", e);
  process.exit(1);
});
