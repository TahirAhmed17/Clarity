import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildSeedDataset, DEMO_PROFILE_ID, DEMO_REVIEWER_ID } from "@/data/synthetic/dataset";
import { DrizzleRepository } from "@/server/data/drizzle-repository";
import { getDataStatus, getRepository, resetRepository } from "@/server/data";
import { SeedRepository } from "@/server/data/seed-repository";
import type { HealthRepository } from "@/server/data/repository";
import { resetEnvCache } from "@/server/config/env";
import { createMigratedPglite, resetDatabase } from "@/server/db/pglite";
import { seedDatabase, tableCounts } from "@/server/db/seed";
import { ingestBloodReport } from "@/server/ingestion/service";
import { _scrubForTest } from "@/server/log";

let pg: Awaited<ReturnType<typeof createMigratedPglite>>;

beforeAll(async () => {
  pg = await createMigratedPglite();
});
afterAll(async () => {
  await pg.client.close();
});

describe("migrations + seed on real Postgres (PGlite)", () => {
  it("applies migrations and seeds idempotently", async () => {
    const first = await seedDatabase(pg.db);
    const second = await seedDatabase(pg.db);
    const d = buildSeedDataset();
    expect(first).toMatchObject({ profiles: 2, biomarkers: d.biomarkers.length, events: d.events.length });
    // Synthetic user data is insert-once; evidence is reference data and is upserted (refreshed), not duplicated.
    const { evidence_chunks: refreshed, ...userData } = second;
    expect(Object.values(userData).every((n) => n === 0)).toBe(true);
    const counts = await tableCounts(pg.db);
    expect(counts.wearable_metrics).toBe(d.wearableMetrics.length);
    expect(counts.evidence_chunks).toBe(refreshed);
    expect(counts.evidence_sources).toBe(22);
  });

  it("every demo profile is labelled synthetic and every event/catalogue item is SAMPLE", () => {
    const d = buildSeedDataset();
    expect(d.profiles.every((p) => p.isSynthetic)).toBe(true);
    expect(d.events.every((e) => e.isSample && e.title.startsWith("SAMPLE"))).toBe(true);
    expect(d.supplementCatalogue.every((s) => s.isSample && s.sourceUrl === null)).toBe(true);
  });
});

/** The same contract must hold for both repository implementations. */
function contract(name: string, make: () => Promise<HealthRepository>) {
  describe(`HealthRepository contract — ${name}`, () => {
    it("isolates profiles", async () => {
      const repo = await make();
      expect((await repo.listBiomarkers(DEMO_PROFILE_ID)).length).toBeGreaterThan(0);
      expect(await repo.listBiomarkers(DEMO_REVIEWER_ID)).toEqual([]);
    });

    it("round-trips an extracted report with original values preserved", async () => {
      const repo = await make();
      const res = await ingestBloodReport(
        DEMO_PROFILE_ID,
        { name: "r.pdf", type: "application/pdf", bytes: new Uint8Array(readFileSync("samples/synthetic-blood-report.pdf")) },
        { repo, maxBytes: 10 * 1024 * 1024 },
      );
      const all = await repo.listBiomarkers(DEMO_PROFILE_ID);
      const egfr = all.find((b) => b.code === "EGFR" && b.documentId === res.document.id)!;
      expect(egfr).toMatchObject({ valueText: ">90", valueNumeric: null, unitAsReported: "mL/min/1.73m2", refText: "> 60", refLow: 60, source: "extracted" });
    });

    it("upserts wearable aggregates", async () => {
      const repo = await make();
      const row = { documentId: null, metricType: "steps" as const, value: 1, unit: "count" as const, aggregation: "sum" as const, day: "2030-01-01", sampleCount: 1, sourceFormat: "test", sourceName: null };
      await repo.upsertWearableMetrics(DEMO_PROFILE_ID, [row]);
      await repo.upsertWearableMetrics(DEMO_PROFILE_ID, [{ ...row, value: 2 }]);
      const rows = (await repo.listWearableMetrics(DEMO_PROFILE_ID)).filter((w) => w.day === "2030-01-01");
      expect(rows).toHaveLength(1);
      expect(rows[0].value).toBe(2);
    });

    it("deletes all health data for a profile (deletion pathway)", async () => {
      const repo = await make();
      await repo.addMessage(DEMO_PROFILE_ID, { role: "user", content: "hi", structured: null, engine: null });
      await repo.deleteProfileHealthData(DEMO_PROFILE_ID);
      expect(await repo.listBiomarkers(DEMO_PROFILE_ID)).toEqual([]);
      expect(await repo.listWearableMetrics(DEMO_PROFILE_ID)).toEqual([]);
      expect(await repo.listMessages(DEMO_PROFILE_ID)).toEqual([]);
      expect(await repo.listDocuments(DEMO_PROFILE_ID)).toEqual([]);
      expect(await repo.getProfile(DEMO_PROFILE_ID)).not.toBeNull();
    });
  });
}

contract("SeedRepository", async () => new SeedRepository());
// One shared instance for the whole contract, reset to the seed before each test.
let contractPg: Awaited<ReturnType<typeof createMigratedPglite>> | undefined;
afterAll(async () => contractPg?.client.close());
contract("DrizzleRepository (PGlite)", async () => {
  contractPg ??= await createMigratedPglite();
  await resetDatabase(contractPg.client);
  await seedDatabase(contractPg.db);
  return new DrizzleRepository(contractPg.db);
});

describe("Row Level Security (Supabase policies on PGlite, auth.uid() stub)", () => {
  it("an authenticated user sees only their own rows; reviewers see suggestions; anon-ish sees nothing", async () => {
    const { client, db } = await createMigratedPglite();
    await seedDatabase(db);
    const userA = "11111111-1111-4111-8111-111111111111";
    const userR = "22222222-2222-4222-8222-222222222222";
    await client.exec(`
      update profiles set auth_user_id = '${userA}' where id = '${DEMO_PROFILE_ID}';
      update profiles set auth_user_id = '${userR}' where id = '${DEMO_REVIEWER_ID}';
      insert into profiles (id, display_name, is_synthetic) values ('33333333-3333-4333-8333-333333333333', 'Other (synthetic)', true);
      insert into biomarkers (profile_id, name_as_reported, value_text, source) values ('33333333-3333-4333-8333-333333333333', 'ALT', '20', 'synthetic_seed');
      insert into supplement_suggestions (profile_id, catalogue_id, rationale)
        select '${DEMO_PROFILE_ID}', id, 'synthetic' from supplement_catalogue limit 1;
    `);
    const asUser = async (sub: string, sql: string) => {
      await client.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${sub}', false);`);
      try {
        return (await client.query<{ n: number }>(sql)).rows[0].n;
      } finally {
        await client.exec(`reset role;`);
      }
    };
    const count = (t: string) => `select count(*)::int as n from ${t}`;
    expect(await asUser(userA, count("biomarkers"))).toBe(9);
    expect(await asUser(userA, count("profiles"))).toBe(1);
    expect(await asUser(userA, count("events"))).toBe(4);
    expect(await asUser(userR, count("biomarkers"))).toBe(0);
    expect(await asUser(userR, count("supplement_suggestions"))).toBe(1);
    expect(await asUser("", count("biomarkers"))).toBe(0);
    // Cannot write into another profile.
    await client.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${userA}', false);`);
    await expect(
      client.query(`insert into biomarkers (profile_id, name_as_reported, value_text, source) values ('33333333-3333-4333-8333-333333333333','X','1','user_provided')`),
    ).rejects.toThrow(/row-level security/);
    await client.exec(`reset role;`);
    await client.close();
  });
});

describe("data mode resolution", () => {
  it("falls back to seed data when the database is unreachable", async () => {
    const prev = { ...process.env };
    Object.assign(process.env, { DATA_MODE: "auto", DATABASE_URL: "postgres://nobody:nothing@127.0.0.1:1/none", DATABASE_CONNECT_TIMEOUT_MS: "1500" });
    resetEnvCache();
    resetRepository();
    try {
      const repo = await getRepository();
      expect(repo.mode).toBe("seed");
      expect((await getDataStatus()).reason).toMatch(/unreachable/);
    } finally {
      process.env = prev;
      resetEnvCache();
      resetRepository();
    }
  });
});

describe("logger", () => {
  it("drops non-allow-listed (potentially sensitive) fields", () => {
    expect(_scrubForTest({ count: 3, valueText: "13", description: "tired" } as never)).toEqual({ count: 3 });
  });
});
