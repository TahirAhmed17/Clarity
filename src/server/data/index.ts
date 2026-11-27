import { sql } from "drizzle-orm";
import { getEnv } from "../config/env";
import { createDb } from "../db/client";
import { log } from "../log";
import { DrizzleRepository, type ClarityDb } from "./drizzle-repository";
import type { HealthRepository } from "./repository";
import { SeedRepository } from "./seed-repository";

export interface DataStatus {
  mode: "database" | "seed";
  reason: string;
}

/**
 * Only state that must be shared is cached: the DB connection, or the in-memory seed store.
 * It lives on globalThis so route handlers and pages (which Next may load as separate module
 * instances) share it — otherwise seed-mode uploads would vanish between API and page.
 * The Drizzle repository itself is stateless and built per call, so code changes always apply
 * (a cached instance would keep stale methods across dev hot-reloads).
 * Note: the in-memory SeedRepository is kept across hot reloads to preserve demo data;
 * restart the dev server after editing seed-repository.ts.
 */
type Resolution = { status: DataStatus; db?: ClarityDb; seed?: SeedRepository };
type Resolved = Promise<Resolution>;

const store = globalThis as typeof globalThis & { __clarityData?: Resolved };

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

async function resolveData(): Promise<Resolution> {
  const env = getEnv();

  if (env.DATA_MODE === "seed") {
    return { seed: new SeedRepository(), status: { mode: "seed", reason: "DATA_MODE=seed" } };
  }
  if (!env.DATABASE_URL) {
    if (env.DATA_MODE === "database") throw new Error("DATA_MODE=database but DATABASE_URL is not set");
    return { seed: new SeedRepository(), status: { mode: "seed", reason: "DATABASE_URL not set — using bundled synthetic seed data" } };
  }

  try {
    const db = createDb(env.DATABASE_URL, env.DATABASE_CONNECT_TIMEOUT_MS) as unknown as ClarityDb;
    await withTimeout(db.execute(sql`select 1`), env.DATABASE_CONNECT_TIMEOUT_MS);
    return { db, status: { mode: "database", reason: "Connected to Postgres" } };
  } catch (err) {
    if (env.DATA_MODE === "database") throw err;
    const reason = `Database unreachable (${err instanceof Error ? err.message : "unknown error"}) — using bundled synthetic seed data`;
    log.warn("data.fallback", { reason });
    return { seed: new SeedRepository(), status: { mode: "seed", reason } };
  }
}

/** Resolves the data source once per server process. */
function ensureResolved(): Resolved {
  store.__clarityData ??= resolveData();
  return store.__clarityData;
}

export async function getRepository(): Promise<HealthRepository> {
  const r = await ensureResolved();
  return r.db ? new DrizzleRepository(r.db) : r.seed!;
}

/** The Drizzle client when running in database mode (null in seed mode). */
export async function getDatabase(): Promise<ClarityDb | null> {
  return (await ensureResolved()).db ?? null;
}

export async function getDataStatus(): Promise<DataStatus> {
  return (await ensureResolved()).status;
}

/** Test helper. */
export function resetRepository() {
  store.__clarityData = undefined;
}
