import { connection } from "next/server";
import { DEMO_PROFILE_ID } from "@/data/synthetic/dataset";
import { getEnv } from "./config/env";
import { getDataStatus, getRepository } from "./data";

/**
 * Current-profile resolution.
 * M1: there is no authentication yet — every request acts as the SYNTHETIC demo profile.
 * Replaced by Supabase Auth (auth.uid() → profiles.auth_user_id) before any real data is allowed.
 */
export function getCurrentProfileId(): string {
  return DEMO_PROFILE_ID;
}

/** For Server Components: marks the render as request-time, then returns the repository. */
export async function loadPageData() {
  await connection();
  const [repo, status] = await Promise.all([getRepository(), getDataStatus()]);
  return { repo, status, env: getEnv(), profileId: getCurrentProfileId() };
}
