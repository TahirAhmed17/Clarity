import { demoProfile, DEMO_PROFILE_ID } from "@/data/synthetic/dataset";
import type { ServerEnv } from "../config/env";
import { getDatabase, getDataStatus, getRepository, resetSeedStore, type DataStatus } from "../data";
import type { ClarityDb } from "../data/drizzle-repository";
import type { HealthRepository } from "../data/repository";
import { seedDatabase } from "../db/seed";

export type ResetResult =
  | { ok: true; mode: "seed" | "database" }
  | { ok: false; code: "not_allowed"; message: string };

export interface ResetDeps {
  status: () => Promise<DataStatus>;
  repo: () => Promise<HealthRepository>;
  db: () => Promise<ClarityDb | null>;
  resetSeed: () => Promise<boolean>;
}

const defaultDeps: ResetDeps = { status: getDataStatus, repo: getRepository, db: getDatabase, resetSeed: resetSeedStore };

export const NOT_ALLOWED_MESSAGE =
  "Reset is off while connected to a database, because it would delete every record on the demo profile. Run the demo with DATA_MODE=seed, or set DEMO_RESET_ALLOWED=true.";

/**
 * Restores the demo to its starting synthetic state.
 * - Seed mode: swaps in a fresh in-memory synthetic store (nothing persistent is touched).
 * - Database mode: only when DEMO_RESET_ALLOWED=true, because it deletes every health record on
 *   the demo profile (including any file uploaded to it) and re-seeds the synthetic history.
 */
export async function resetDemo(env: ServerEnv, deps: ResetDeps = defaultDeps): Promise<ResetResult> {
  const status = await deps.status();
  if (status.mode === "seed") {
    await deps.resetSeed();
    return { ok: true, mode: "seed" };
  }
  if (env.DEMO_RESET_ALLOWED !== "true") return { ok: false, code: "not_allowed", message: NOT_ALLOWED_MESSAGE };

  const repo = await deps.repo();
  const db = await deps.db();
  await repo.deleteProfileHealthData(DEMO_PROFILE_ID);
  if (db) await seedDatabase(db);
  await repo.updateProfile(DEMO_PROFILE_ID, { displayName: demoProfile.displayName, goals: demoProfile.goals, routine: demoProfile.routine });
  return { ok: true, mode: "database" };
}

/** Whether the Profile page should offer the reset button. */
export async function canResetDemo(env: ServerEnv, status: () => Promise<DataStatus> = getDataStatus) {
  return (await status()).mode === "seed" || env.DEMO_RESET_ALLOWED === "true";
}
