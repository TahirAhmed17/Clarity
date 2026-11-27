import { NextResponse, type NextRequest } from "next/server";
import { REVIEWER_COOKIE, sessionSecret, verifySession } from "@/server/auth/reviewer-session";

/**
 * Optimistic gate for the reviewer workspace (Next 16 "proxy", formerly middleware).
 * The page and the review API verify the session again themselves — this is not the only check.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/doctor/sign-in" || pathname === "/api/doctor/session") return NextResponse.next();

  const session = await verifySession(request.cookies.get(REVIEWER_COOKIE)?.value, sessionSecret());
  if (session) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Reviewer sign-in required." } }, { status: 401 });
  }
  const url = new URL("/doctor/sign-in", request.url);
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/doctor/:path*", "/api/doctor/:path*"],
};
