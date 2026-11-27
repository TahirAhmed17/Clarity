import { cookies } from "next/headers";
import { connection } from "next/server";
import { REVIEWER_COOKIE, sessionSecret, verifySession } from "./auth/reviewer-session";
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

/**
 * The signed-in (SIMULATED) reviewer, or null. Requires BOTH a valid signed reviewer session cookie
 * AND a profile whose role is "reviewer" — proxy.ts is only an optimistic first check.
 */
export async function getReviewer(repo: { getProfile(id: string): Promise<import("@/lib/domain").Profile | null> }) {
  const token = (await cookies()).get(REVIEWER_COOKIE)?.value;
  const session = await verifySession(token, sessionSecret());
  if (!session) return null;
  const p = await repo.getProfile(session.sub);
  return p && p.role === "reviewer" ? p : null;
}
