import { cookies } from "next/headers";
import { z } from "zod";
import { DEMO_REVIEWER_ID } from "@/data/synthetic/dataset";
import { allowAttempt, checkAccessCode, REVIEWER_COOKIE, SESSION_TTL_SECONDS, sessionSecret, signSession } from "@/server/auth/reviewer-session";
import { json } from "@/server/http";
import { log } from "@/server/log";

const Body = z.object({ code: z.string().min(1).max(200) });

/** POST { code } — sign in to the SIMULATED reviewer workspace. */
export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!allowAttempt(`reviewer:${ip}`)) {
    return json({ error: { code: "rate_limited", message: "Too many attempts. Wait a minute and try again." } }, 429);
  }
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: { code: "bad_request", message: "Enter the reviewer access code." } }, 400);

  const secret = sessionSecret();
  const result = await checkAccessCode(parsed.data.code);
  if (result === "not_configured" || !secret) {
    return json({ error: { code: "not_configured", message: "Reviewer access isn't set up on this server (REVIEWER_ACCESS_CODE / SESSION_SECRET)." } }, 503);
  }
  if (result === "wrong") {
    log.warn("reviewer.sign_in_failed", { route: "doctor.session" });
    return json({ error: { code: "invalid_code", message: "That access code isn't right." } }, 401);
  }

  const token = await signSession({ role: "reviewer", sub: DEMO_REVIEWER_ID, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS }, secret);
  (await cookies()).set(REVIEWER_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return json({ signedIn: true });
}

/** DELETE — sign out. */
export async function DELETE() {
  (await cookies()).delete(REVIEWER_COOKIE);
  return json({ signedIn: false });
}
