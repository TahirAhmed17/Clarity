import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let sqlClient: ReturnType<typeof postgres> | undefined;

/**
 * Creates (once per process) a postgres-js client for Supabase Postgres.
 * prepare:false keeps it compatible with Supabase's transaction pooler.
 */
export function createDb(url: string, connectTimeoutMs: number) {
  if (!sqlClient) {
    sqlClient = postgres(url, {
      prepare: false,
      max: 5,
      connect_timeout: Math.max(1, Math.ceil(connectTimeoutMs / 1000)),
      idle_timeout: 20,
      onnotice: () => {},
    });
  }
  return drizzle(sqlClient, { schema });
}

export async function closeDb() {
  await sqlClient?.end({ timeout: 2 });
  sqlClient = undefined;
}
