import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { DEMO_REVIEWER_ID } from "@/data/synthetic/dataset";
import { proxy } from "@/proxy";
import { allowAttempt, checkAccessCode, REVIEWER_COOKIE, sessionSecret, signSession, verifySession } from "@/server/auth/reviewer-session";

const SECRET = "x".repeat(40);
const future = () => Math.floor(Date.now() / 1000) + 3600;
const saved = { ...process.env };
afterEach(() => {
  process.env = { ...saved };
});

describe("reviewer session tokens", () => {
  it("round-trips a valid token", async () => {
    const t = await signSession({ role: "reviewer", sub: DEMO_REVIEWER_ID, exp: future() }, SECRET);
    expect(await verifySession(t, SECRET)).toMatchObject({ role: "reviewer", sub: DEMO_REVIEWER_ID });
  });

  it("rejects tampering, the wrong secret, expiry, other roles and garbage", async () => {
    const t = await signSession({ role: "reviewer", sub: DEMO_REVIEWER_ID, exp: future() }, SECRET);
    const [body, sig] = t.split(".");
    const forged = Buffer.from(JSON.stringify({ role: "reviewer", sub: "someone-else", exp: future() })).toString("base64url");
    expect(await verifySession(`${forged}.${sig}`, SECRET)).toBeNull();
    expect(await verifySession(`${body}.${sig.slice(0, -2)}AA`, SECRET)).toBeNull();
    expect(await verifySession(t, "y".repeat(40))).toBeNull();
    const expired = await signSession({ role: "reviewer", sub: DEMO_REVIEWER_ID, exp: Math.floor(Date.now() / 1000) - 1 }, SECRET);
    expect(await verifySession(expired, SECRET)).toBeNull();
    const member = await signSession({ role: "member" as "reviewer", sub: "m", exp: future() }, SECRET);
    expect(await verifySession(member, SECRET)).toBeNull();
    expect(await verifySession("not-a-token", SECRET)).toBeNull();
    expect(await verifySession(t, null)).toBeNull();
  });

  it("requires a strong SESSION_SECRET in production and never defaults", () => {
    Object.assign(process.env, { NODE_ENV: "production", SESSION_SECRET: "short" });
    expect(sessionSecret()).toBeNull();
    process.env.SESSION_SECRET = SECRET;
    expect(sessionSecret()).toBe(SECRET);
  });
});

describe("access code and rate limiting", () => {
  it("is disabled unless configured, and compares exactly", async () => {
    delete process.env.REVIEWER_ACCESS_CODE;
    expect(await checkAccessCode("anything")).toBe("not_configured");
    process.env.REVIEWER_ACCESS_CODE = "correct-horse-battery";
    expect(await checkAccessCode("correct-horse-battery")).toBe("ok");
    expect(await checkAccessCode("correct-horse-batter")).toBe("wrong");
  });

  it("allows 5 attempts per minute per key", () => {
    const now = 1_000_000;
    for (let i = 0; i < 5; i++) expect(allowAttempt("k", 5, 60_000, now + i)).toBe(true);
    expect(allowAttempt("k", 5, 60_000, now + 10)).toBe(false);
    expect(allowAttempt("k", 5, 60_000, now + 61_000)).toBe(true);
  });
});

describe("proxy gate", () => {
  it("redirects pages and returns 401 for the API without a valid session; passes with one", async () => {
    process.env.SESSION_SECRET = SECRET;
    const page = await proxy(new NextRequest("http://localhost/doctor"));
    expect(page.status).toBe(307);
    expect(page.headers.get("location")).toContain("/doctor/sign-in?next=%2Fdoctor");

    const api = await proxy(new NextRequest("http://localhost/api/doctor/suggestions/abc", { method: "POST" }));
    expect(api.status).toBe(401);

    const open = await proxy(new NextRequest("http://localhost/doctor/sign-in"));
    expect(open.headers.get("x-middleware-next")).toBe("1");

    const token = await signSession({ role: "reviewer", sub: DEMO_REVIEWER_ID, exp: future() }, SECRET);
    const ok = await proxy(new NextRequest("http://localhost/doctor", { headers: { cookie: `${REVIEWER_COOKIE}=${token}` } }));
    expect(ok.headers.get("x-middleware-next")).toBe("1");

    const bad = await proxy(new NextRequest("http://localhost/doctor", { headers: { cookie: `${REVIEWER_COOKIE}=${token}x` } }));
    expect(bad.status).toBe(307);
  });
});
