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

type Resolved = Promise<{ repo: HealthRepository; status: DataStatus }>;

/**
 * Stored on globalThis so route handlers and pages (which Next may load as separate
 * module instances) and dev hot-reloads share ONE repository — essential for the
 * in-memory seed fallback, where a second instance would silently lose uploads.
 */
const store = globalThis as typeof globalThis & { __clarityRepo?: Resolved };

let resolved: Resolved | undefined = store.__clarityRepo;

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

async function resolveRepository(): Promise<{ repo: HealthRepository; status: DataStatus }> {
  const env = getEnv();

  if (env.DATA_MODE === "seed") {
    return { repo: new SeedRepository(), status: { mode: "seed", reason: "DATA_MODE=seed" } };
  }
  if (!env.DATABASE_URL) {
    if (env.DATA_MODE === "database") throw new Error("DATA_MODE=database but DATABASE_URL is not set");
    return { repo: new SeedRepository(), status: { mode: "seed", reason: "DATABASE_URL not set — using bundled synthetic seed data" } };
  }

  try {
    const db = createDb(env.DATABASE_URL, env.DATABASE_CONNECT_TIMEOUT_MS) as unknown as ClarityDb;
    await withTimeout(db.execute(sql`select 1`), env.DATABASE_CONNECT_TIMEOUT_MS);
    return { repo: new DrizzleRepository(db), status: { mode: "database", reason: "Connected to Postgres" } };
  } catch (err) {
    if (env.DATA_MODE === "database") throw err;
    const reason = `Database unreachable (${err instanceof Error ? err.message : "unknown error"}) — using bundled synthetic seed data`;
    log.warn("data.fallback", { reason });
    return { repo: new SeedRepository(), status: { mode: "seed", reason } };
  }
}

/** Resolves the repository once per server process. */
function ensureResolved(): Resolved {
  resolved ??= store.__clarityRepo ??= resolveRepository();
  return resolved;
}

export async function getRepository(): Promise<HealthRepository> {
  return (await ensureResolved()).repo;
}

export async function getDataStatus(): Promise<DataStatus> {
  return (await ensureResolved()).status;
}

/** Test helper. */
export function resetRepository() {
  resolved = undefined;
  store.__clarityRepo = undefined;
}
