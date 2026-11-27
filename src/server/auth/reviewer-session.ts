/**
 * Signed reviewer session for the (simulated) Doctor workspace.
 * Token: base64url(JSON payload) + "." + base64url(HMAC-SHA256). Web Crypto only, so it runs in
 * proxy.ts and in route handlers alike. This gates a SIMULATED reviewer role for the demo; real
 * clinician access would use Supabase Auth + role claims (M4).
 */

export const REVIEWER_COOKIE = "clarity_reviewer";
export const SESSION_TTL_SECONDS = 8 * 60 * 60;

export interface ReviewerSession {
  role: "reviewer";
  /** Reviewer profile id. */
  sub: string;
  /** Expiry, seconds since epoch. */
  exp: number;
}

const enc = new TextEncoder();

function b64url(bytes: Uint8Array) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string) {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

const store = globalThis as typeof globalThis & { __clarityDevSecret?: string };

/**
 * SESSION_SECRET (≥ 32 chars) is required in production. In development, a random per-process
 * secret is used, so sessions simply end when the server restarts.
 */
export function sessionSecret(): string | null {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV === "production") return null;
  store.__clarityDevSecret ??= b64url(crypto.getRandomValues(new Uint8Array(32)));
  return store.__clarityDevSecret;
}

async function hmac(secret: string, data: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

/** Constant-time comparison of equal-length byte arrays. */
function safeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function signSession(payload: ReviewerSession, secret: string) {
  const body = b64url(enc.encode(JSON.stringify(payload)));
  return `${body}.${b64url(await hmac(secret, body))}`;
}

export async function verifySession(token: string | undefined | null, secret: string | null, now = Date.now()): Promise<ReviewerSession | null> {
  if (!token || !secret) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  try {
    if (!safeEqual(fromB64url(sig), await hmac(secret, body))) return null;
    const p = JSON.parse(new TextDecoder().decode(fromB64url(body))) as ReviewerSession;
    if (p.role !== "reviewer" || typeof p.sub !== "string" || typeof p.exp !== "number" || p.exp * 1000 <= now) return null;
    return p;
  } catch {
    return null;
  }
}

/** Timing-safe check of a submitted access code against REVIEWER_ACCESS_CODE (unset = access disabled). */
export async function checkAccessCode(submitted: string): Promise<"ok" | "wrong" | "not_configured"> {
  const expected = process.env.REVIEWER_ACCESS_CODE;
  if (!expected || expected.length < 8) return "not_configured";
  // Compare digests so length differences don't leak through timing either.
  const [a, b] = await Promise.all([crypto.subtle.digest("SHA-256", enc.encode(submitted)), crypto.subtle.digest("SHA-256", enc.encode(expected))]);
  return safeEqual(new Uint8Array(a), new Uint8Array(b)) ? "ok" : "wrong";
}

/** Small in-memory limiter for sign-in attempts (per key, sliding window). */
const attempts = new Map<string, number[]>();
export function allowAttempt(key: string, limit = 5, windowMs = 60_000, now = Date.now()) {
  const recent = (attempts.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    attempts.set(key, recent);
    return false;
  }
  recent.push(now);
  attempts.set(key, recent);
  return true;
}
