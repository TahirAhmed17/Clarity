import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { demoProfile, DEMO_PROFILE_ID } from "@/data/synthetic/dataset";
import { parseEnv, resetEnvCache } from "@/server/config/env";
import { getRepository, resetRepository } from "@/server/data";
import { DrizzleRepository } from "@/server/data/drizzle-repository";
import { createMigratedPglite } from "@/server/db/pglite";
import { seedDatabase } from "@/server/db/seed";
import { canResetDemo, resetDemo } from "@/server/demo/reset";
import { warmUp } from "@/server/demo/warmup";
import { ingestBloodReport } from "@/server/ingestion/service";

const MB = 1024 * 1024;
const pdf = () => ({ name: "r.pdf", type: "application/pdf", bytes: new Uint8Array(readFileSync("samples/synthetic-blood-report.pdf")) });
const saved = { ...process.env };

function seedMode() {
  Object.assign(process.env, { DATA_MODE: "seed", AI_ENGINE: "mock" });
  resetEnvCache();
  resetRepository();
}

afterEach(() => {
  process.env = { ...saved };
  resetEnvCache();
  resetRepository();
});

describe("Reset demo", () => {
  it("seed mode: restores the starting synthetic state, including after uploads and messages", async () => {
    seedMode();
    const repo = await getRepository();
    const before = (await repo.listBiomarkers(DEMO_PROFILE_ID)).length;
    await ingestBloodReport(DEMO_PROFILE_ID, pdf(), { repo, maxBytes: 10 * MB });
    await repo.addMessage(DEMO_PROFILE_ID, { role: "user", content: "hi", structured: null, engine: null });
    expect((await repo.listBiomarkers(DEMO_PROFILE_ID)).length).toBeGreaterThan(before);

    const res = await resetDemo(parseEnv(process.env));
    expect(res).toEqual({ ok: true, mode: "seed" });
    const fresh = await getRepository();
    expect((await fresh.listBiomarkers(DEMO_PROFILE_ID)).length).toBe(before);
    expect(await fresh.listMessages(DEMO_PROFILE_ID)).toEqual([]);
    // The same file can be uploaded again for the next run-through (no duplicate block).
    await expect(ingestBloodReport(DEMO_PROFILE_ID, pdf(), { repo: fresh, maxBytes: 10 * MB })).resolves.toBeTruthy();
  });

  it("database mode: refuses by default (it would delete uploads on the demo profile)", async () => {
    const env = parseEnv({ NODE_ENV: "test" });
    const deps = {
      status: async () => ({ mode: "database" as const, reason: "test" }),
      repo: async () => {
        throw new Error("must not touch the repository");
      },
      db: async () => null,
      resetSeed: async () => false,
    };
    const res = await resetDemo(env, deps);
    expect(res).toMatchObject({ ok: false, code: "not_allowed" });
    expect(await canResetDemo(env, deps.status)).toBe(false);
  });

  it("database mode with DEMO_RESET_ALLOWED=true: wipes the demo profile and re-seeds it (real Postgres)", async () => {
    const { client, db } = await createMigratedPglite();
    try {
      await seedDatabase(db);
      const repo = new DrizzleRepository(db);
      const seeded = (await repo.listBiomarkers(DEMO_PROFILE_ID)).length;
      await ingestBloodReport(DEMO_PROFILE_ID, pdf(), { repo, maxBytes: 10 * MB });
      await repo.updateProfile(DEMO_PROFILE_ID, { goals: ["Something else"] });

      const env = parseEnv({ NODE_ENV: "test", DEMO_RESET_ALLOWED: "true" });
      const res = await resetDemo(env, {
        status: async () => ({ mode: "database", reason: "test" }),
        repo: async () => repo,
        db: async () => db,
        resetSeed: async () => false,
      });
      expect(res).toEqual({ ok: true, mode: "database" });
      expect((await repo.listBiomarkers(DEMO_PROFILE_ID)).length).toBe(seeded);
      expect((await repo.listDocuments(DEMO_PROFILE_ID)).map((d) => d.originalFilename)).toEqual(["synthetic-history-2026-04.pdf"]);
      expect((await repo.getProfile(DEMO_PROFILE_ID))!.goals).toEqual(demoProfile.goals);
    } finally {
      await client.close();
    }
  });
});

describe("Warm-up", () => {
  it("runs every step and saves nothing to the conversation", async () => {
    seedMode();
    process.env.EVIDENCE_EMBEDDINGS = "off"; // keep the unit test offline and fast
    const res = await warmUp(parseEnv(process.env));
    expect(res.ok).toBe(true);
    expect(res.steps.map((s) => s.name)).toEqual(["data", "evidence search (loads embedding model)", "AI turn (not saved)"]);
    expect(res.steps[1].note).toMatch(/memory, lexical/);
    expect(await (await getRepository()).listMessages(DEMO_PROFILE_ID)).toEqual([]);
  });
});
